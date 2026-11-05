require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Inicializa o cliente Groq com a chave de ambiente segura no servidor
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Lista priorizada de modelos: tenta llama-3.3-70b-versatile e faz fallback automático
// para os modelos equivalentes de baixa latência ativos na conta Groq
const MODEL_CANDIDATES = [
  process.env.GROQ_MODEL,
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
].filter(Boolean);

let activeModelIndex = 0;

// System Prompt definindo a personalidade e regras de fala da personagem "Bloub"
const SYSTEM_PROMPT = `Você é o Bloub, um assistente virtual interativo, carismático e prestativo que vive dentro de um totem digital inteligente (modo kiosk em um tablet).
A frase de ativação por voz do totem é "Unimed" — portanto, os usuários podem chamar você dizendo "Unimed" antes de fazer uma pergunta.
Visualmente, você é uma simpática forma orgânica escura e minimalista com dois olhos expressivos brilhantes que reagem enquanto você conversa.

DIRETRIZES DE PERSONALIDADE E COMPORTAMENTO:
1. Tom de voz: Acolhedor, amigável, educado, levemente entusiasmado e muito prestativo, como um excelente recepcionista e guia interativo.
2. Idioma: Responda sempre em Português do Brasil (pt-BR) natural e fluido.
3. Otimização para Síntese de Voz (TTS): Suas respostas serão lidas em voz alta pelo navegador no totem. Portanto:
   - Seja conciso e direto (idealmente entre 1 e 3 frases curtas por resposta, a menos que o usuário peça uma explicação detalhada).
   - NÃO utilize formatação Markdown complexa (evite asteriscos **, hashtags #, listas com traços, tabelas ou blocos de código), pois o leitor de voz lê esses símbolos de forma artificial.
   - Escreva números ou siglas de forma fácil de pronunciar quando necessário.
4. Interatividade de Totem: Sempre que apropriado, finalize de forma convidativa para manter a conversa fluida e engajar a pessoa que está em frente ao tablet.`;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Servir arquivos estáticos do frontend (pasta public)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint de verificação de saúde (Health Check para o Render)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    character: 'Bloub',
    model: MODEL_CANDIDATES[activeModelIndex],
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Remove tags de pensamento (<think>) e marcações residuais de Markdown
 * para exibição limpa e leitura fluida no Web Speech API
 */
function cleanReplyText(text) {
  if (!text) return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

function sanitizeForSpeech(text) {
  if (!text) return '';
  return cleanReplyText(text)
    .replace(/[*_~`#>-]+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Executa a chamada à Groq API com fallback automático caso um modelo tenha sido
 * atualizado/descontinuado no catálogo da Groq.
 */
async function createGroqCompletion(messages, stream = false) {
  let lastError = null;

  for (let i = activeModelIndex; i < MODEL_CANDIDATES.length; i++) {
    const model = MODEL_CANDIDATES[i];
    try {
      const response = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.65,
        max_tokens: 600,
        top_p: 0.9,
        stream,
      });
      activeModelIndex = i; // Memoriza o modelo ativo para evitar retentativas futuras
      return { response, model };
    } catch (err) {
      lastError = err;
      const errCode = err?.error?.error?.code || err?.code || '';
      const isModelUnavailable =
        err?.status === 404 ||
        errCode === 'model_not_found' ||
        errCode === 'model_decommissioned';

      if (isModelUnavailable && i + 1 < MODEL_CANDIDATES.length) {
        console.warn(
          `[Groq] Modelo "${model}" indisponível. Alternando automaticamente para "${MODEL_CANDIDATES[i + 1]}".`
        );
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

// Endpoint Principal de Chat: POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: 'Chave GROQ_API_KEY não configurada no servidor.',
      });
    }

    const { messages, stream = false } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'O campo "messages" é obrigatório e deve ser uma lista não vazia.',
      });
    }

    // Filtra e sanitiza as últimas 12 mensagens para manter contexto com baixa latência
    const sanitizedHistory = messages
      .filter(
        (msg) =>
          msg &&
          typeof msg.content === 'string' &&
          msg.content.trim().length > 0 &&
          ['user', 'assistant'].includes(msg.role)
      )
      .slice(-12)
      .map((msg) => ({
        role: msg.role,
        content: msg.content.trim().slice(0, 2000),
      }));

    if (sanitizedHistory.length === 0) {
      return res.status(400).json({
        error: 'Nenhuma mensagem válida encontrada na requisição.',
      });
    }

    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...sanitizedHistory,
    ];

    // Suporte opcional a Streaming via Server-Sent Events (SSE)
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      const { response: completionStream, model: usedModel } =
        await createGroqCompletion(fullMessages, true);

      let fullReply = '';
      for await (const chunk of completionStream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullReply += delta;
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
      }

      const cleaned = cleanReplyText(fullReply);
      res.write(
        `data: ${JSON.stringify({
          done: true,
          reply: cleaned,
          speechText: sanitizeForSpeech(cleaned),
          model: usedModel,
        })}\n\n`
      );
      return res.end();
    }

    // Resposta padrão em JSON de baixa latência
    const { response: completion, model: usedModel } = await createGroqCompletion(
      fullMessages,
      false
    );

    const rawReply =
      cleanReplyText(completion.choices[0]?.message?.content) ||
      'Olá! Tive um pequeno soluço digital aqui no totem. Pode repetir para mim?';

    return res.status(200).json({
      reply: rawReply,
      speechText: sanitizeForSpeech(rawReply),
      model: completion.model || usedModel,
      usage: completion.usage || null,
    });
  } catch (error) {
    console.error('[Erro na chamada Groq API]:', error);
    const statusCode = error?.status || 500;
    return res.status(statusCode).json({
      error: 'Não foi possível processar sua mensagem no momento.',
      details: error?.message || 'Erro interno no servidor',
    });
  }
});

// Fallback SPA para entregar o index.html em qualquer rota não-API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`🤖 Totem Interativo Bloub rodando em http://${HOST}:${PORT}`);
  console.log(`📡 Endpoint de Chat: POST http://127.0.0.1:${PORT}/api/chat`);
  console.log(`====================================================`);
});

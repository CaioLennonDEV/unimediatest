# 🤖 Bloub — Totem / Kiosk Interativo com IA (Groq + Web Speech API)

Aplicação web full-stack projetada para rodar em **modo totem/kiosk em tablets**, apresentando a assistente virtual interativa **Bloub**.

O usuário interage por **voz (Speech-to-Text)** ou **texto/toque**. O servidor backend em **Node.js + Express** atua como proxy seguro para a **Groq API (`llama-3.3-70b-versatile`)**, e o frontend reproduz a resposta audivelmente em Português do Brasil (`pt-BR`) via **Web Speech API (`window.speechSynthesis`)** sincronizada com animações vetoriais em tempo real do avatar SVG.

---

## 📁 1. Estrutura de Arquivos do Projeto

```text
├── public/
│   ├── index.html          # Interface Kiosk para Tablet (Tailwind CSS + SVG Bloub)
│   ├── css/
│   │   └── kiosk.css       # Estilos dark mode, auras reativas e equalizador de ondas
│   └── js/
│       ├── avatar.js       # Motor de animação procedural 60fps do SVG Bloub
│       ├── speech.js       # Integração Web Speech API (TTS pt-BR + STT Microfone)
│       └── app.js          # Orquestração da UI, histórico e chamadas à API
├── server.js               # Backend Express + SDK Oficial da Groq + Entrega Estática
├── package.json            # Dependências e scripts npm (start, dev, build)
├── render.yaml             # Blueprint para deploy automatizado no Render
├── .env                    # Variáveis de ambiente locais (não versionado)
├── .env.example            # Exemplo de configuração de variáveis de ambiente
└── .gitignore              # Ignora node_modules e .env
```

---

## 🚀 2. Como Rodar Localmente

### Pré-requisitos
- **Node.js** `v18.0.0` ou superior instalado.
- Navegador moderno com suporte à Web Speech API (Google Chrome, Microsoft Edge ou Safari em iPad/Android Tablet).

### Passo a Passo

1. **Instale as dependências no diretório do projeto:**
   ```bash
   npm install
   ```

2. **Verifique o arquivo `.env` na raiz do projeto:**
   ```env
   GROQ_API_KEY=sua_chave_groq_aqui
   PORT=3000
   ```

3. **Inicie o servidor:**
   ```bash
   npm start
   ```
   *(Ou `npm run dev` para reiniciar automaticamente durante alterações).*

4. **Acesse no navegador ou tablet na mesma rede:**
   - Local: `http://localhost:3000`
   - Clique no botão **"Iniciar Interação"** para desbloquear o sintetizador de voz do navegador e ouvir a saudação inicial do Bloub.

---

## ☁️ 3. Deploy Passo a Passo no Render

O projeto já está pronto para deploy no **Render** como um **Web Service** único que serve tanto a API (`/api/chat`) quanto os arquivos estáticos do frontend.

### Opção A — Usando o painel Web Service do Render
1. Suba este projeto para um repositório no **GitHub** ou **GitLab** (o arquivo `.env` já está no `.gitignore` para proteger sua chave).
2. Acesse [dashboard.render.com](https://dashboard.render.com/) e clique em **New +** → **Web Service**.
3. Conecte seu repositório Git.
4. Preencha as configurações do serviço:
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Na seção **Environment Variables**, clique em **Add Environment Variable** e adicione:
   - **Key:** `GROQ_API_KEY`
   - **Value:** `sua_chave_groq_aqui` *(cole sua chave gerada em console.groq.com)*
   - *(Não é necessário definir `PORT` manualmente, pois o Render injeta `process.env.PORT` automaticamente e o `server.js` já escuta em `0.0.0.0`).*
6. Clique em **Create Web Service**. Assim que o build terminar, a URL HTTPS do seu totem estará ativa!
   > **Importante:** O acesso via **HTTPS** fornecido automaticamente pelo Render permite que o microfone (`SpeechRecognition`) funcione normalmente no tablet.

### Opção B — Usando Blueprint (`render.yaml`)
1. No painel do Render, clique em **New +** → **Blueprint** e selecione o repositório.
2. O Render lerá automaticamente o arquivo `render.yaml` e solicitará apenas o preenchimento da variável secreta `GROQ_API_KEY`.


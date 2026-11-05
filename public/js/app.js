/**
 * ============================================================================
 * App Controller — Totem Minimalista (Apenas os Olhos)
 * ============================================================================
 * - NENHUM texto, botão ou símbolo na tela: apenas os olhos do avatar
 * - Estados visuais por cor dos olhos:
 *     * Standby (aguardando "Unimed") : Olhos BRANCOS
 *     * Ativo (ouvindo a pessoa)      : Olhos VERDES
 *     * Respondendo (pensando/falando): Olhos AZUIS / CIANO
 * - Toque em qualquer lugar da tela desbloqueia o áudio e ativa o microfone
 */

document.addEventListener('DOMContentLoaded', () => {
  const WAKE_WORD = 'Unimed';
  const kioskScreen = document.getElementById('kiosk-screen');

  let conversationHistory = [];
  let isWaitingResponse = false;
  let isStarted = false;

  const INITIAL_GREETING =
    'Olá! Eu sou o assistente do totem. Você pode dizer Unimed a qualquer momento para falar comigo, ou tocar na tela. Como posso ajudar?';

  // 1. Inicializa o controlador dos Olhos do Avatar
  const avatar = new window.BloubAvatarController();

  // 2. Inicializa o gerenciador de Voz (TTS + STT + Wake Word "Unimed")
  const speech = new window.SpeechManager({
    wakeWord: WAKE_WORD,
    onSpeakStart: () => {
      // RESPONDENDO: Olhos azuis pulsando
      avatar.setState('speaking');
    },
    onSpeakBoundary: () => {
      avatar.triggerWordPulse(1.2);
    },
    onSpeakEnd: () => {
      if (!isWaitingResponse && speech.listenMode !== 'active') {
        // Retorna a STANDBY: Olhos brancos, escutando "Unimed"
        avatar.setState('idle');
      }
    },
    onWakeWordDetected: () => {
      // ATIVO: Olhos verdes
      avatar.setState('listening');
    },
    onRecognitionStateChange: (mode) => {
      if (mode === 'active') {
        // ATIVO: Olhos verdes
        avatar.setState('listening');
      } else if (mode === 'wakeword') {
        if (!isWaitingResponse && !speech.isSpeaking) {
          // STANDBY: Olhos brancos
          avatar.setState('idle');
        }
      } else {
        if (!isWaitingResponse && !speech.isSpeaking) {
          avatar.setState('idle');
        }
      }
    },
    onRecognitionResult: ({ final }) => {
      if (final && final.trim().length > 0) {
        sendMessage(final.trim());
      }
    },
    onRecognitionError: (err) => {
      console.warn('[Voz]', err);
    },
  });

  /**
   * Envia a fala do usuário para a IA e sintetiza a resposta por voz
   */
  async function sendMessage(text) {
    if (!text || isWaitingResponse) return;

    speech.stopSpeaking();
    speech.pauseRecognitionTemporarily();

    conversationHistory.push({ role: 'user', content: text });

    // RESPONDENDO / PENSANDO: Olhos mudam de cor (pensando)
    isWaitingResponse = true;
    avatar.setState('thinking');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro no servidor');
      }

      const replyText = data.reply;
      const speechText = data.speechText || replyText;

      conversationHistory.push({ role: 'assistant', content: replyText });
      isWaitingResponse = false;

      // RESPONDENDO / FALANDO: Dispara a voz (olhos azuis)
      speech.speak(speechText);
    } catch (err) {
      console.error('[Chat]', err);
      isWaitingResponse = false;
      avatar.setState('idle');

      const fallbackMsg = 'Tive uma oscilação na conexão. Pode repetir dizendo Unimed?';
      speech.speak(fallbackMsg);
    }
  }

  /**
   * Toque em qualquer ponto da tela:
   * - No primeiro toque: desbloqueia o áudio do tablet e saúda o usuário
   * - Nos toques seguintes: alterna para o modo ATIVO (olhos verdes, pronto para ouvir)
   */
  function handleScreenTouch() {
    speech.unlockAudio();

    if (!isStarted) {
      isStarted = true;
      conversationHistory = [{ role: 'assistant', content: INITIAL_GREETING }];
      speech.speak(INITIAL_GREETING);
      return;
    }

    if (speech.isSpeaking) {
      speech.stopSpeaking();
      avatar.setState('listening');
      speech.toggleManualListening();
      return;
    }

    // Ativa escuta imediata (olhos verdes)
    speech.toggleManualListening();
  }

  // Previne arrastar elementos ou gestos acidentais do navegador no tablet
  window.addEventListener('dragstart', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  if (kioskScreen) {
    kioskScreen.addEventListener('click', handleScreenTouch);
    kioskScreen.addEventListener('touchstart', (e) => {
      // Previne zoom ou scroll acidental no tablet
      e.preventDefault();
      handleScreenTouch();
    }, { passive: false });
  }
});

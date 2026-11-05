/**
 * ============================================================================
 * App Controller - Totem / Kiosk Interativo Bloub (Frase de Ativação: "Unimed")
 * ============================================================================
 * Gerencia o fluxo de interação entre Usuário, Avatar SVG, Web Speech API
 * (com detecção de Wake Word "Unimed") e Backend Proxy (Groq API).
 */

document.addEventListener('DOMContentLoaded', () => {
  const WAKE_WORD = 'Unimed';

  // Elementos da UI
  const startOverlay = document.getElementById('kiosk-start-overlay');
  const startKioskBtn = document.getElementById('start-kiosk-btn');
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');
  const wakewordBadge = document.getElementById('wakeword-badge');
  const currentSpeechText = document.getElementById('bloub-speech-bubble');
  const chatHistoryContainer = document.getElementById('chat-history');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const micBtn = document.getElementById('mic-btn');
  const micBtnLabel = document.getElementById('mic-btn-label');
  const muteBtn = document.getElementById('mute-btn');
  const muteIconOn = document.getElementById('mute-icon-on');
  const muteIconOff = document.getElementById('mute-icon-off');
  const resetBtn = document.getElementById('reset-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const quickPromptBtns = document.querySelectorAll('.quick-prompt-btn');

  // Histórico de mensagens da sessão atual
  let conversationHistory = [];
  let isWaitingResponse = false;

  const INITIAL_GREETING =
  'Olá! Eu sou o Bloub, seu assistente virtual. Diga "Unimed" a qualquer momento para falar comigo, ou use os botões na tela. Como posso ajudar você hoje?';

  // 1. Inicializa o controlador do Avatar SVG Bloub
  const avatar = new window.BloubAvatarController();

  // 2. Inicializa o gerenciador de Voz (TTS + STT + Wake Word "Unimed")
  const speech = new window.SpeechManager({
    wakeWord: WAKE_WORD,
    onSpeakStart: () => {
      avatar.setState('speaking');
      updateStatusBadge('speaking', 'Bloub está falando...');
    },
    onSpeakBoundary: () => {
      avatar.triggerWordPulse(1.1);
    },
    onSpeakEnd: () => {
        if (!isWaitingResponse && speech.listenMode !== 'active') {
          avatar.setState('idle');
          updateStatusBadge('wakeword', 'Diga "Unimed" para falar');
        }
      },
          onWakeWordDetected: ({ immediateCommand }) => {
            if (!immediateCommand) {
              avatar.setState('listening');
              updateStatusBadge('listening', 'Ativado por "Unimed" — Pode falar!');
              if (currentSpeechText) {
                currentSpeechText.innerHTML =
                  '<span class="text-emerald-300 font-semibold">Sim! Ouvi você chamar "Unimed". Pode fazer sua pergunta!</span>';
              }
            }
          },
            onRecognitionStateChange: (mode) => {
              if (mode === 'active') {
                avatar.setState('listening');
                updateStatusBadge('listening', 'Ouvindo sua pergunta...');
                micBtn.classList.add('ring-4', 'ring-emerald-500/40', 'bg-emerald-500', 'text-slate-950');
                micBtn.classList.remove('bg-slate-800/90', 'text-emerald-400');
                if (micBtnLabel) micBtnLabel.textContent = 'Ouvindo...';
                if (wakewordBadge) {
                  wakewordBadge.classList.replace('border-emerald-500/30', 'border-emerald-400');
                  wakewordBadge.classList.replace('bg-emerald-500/10', 'bg-emerald-500/25');
                }
              } else if (mode === 'wakeword') {
                micBtn.classList.remove('ring-4', 'ring-emerald-500/40', 'bg-emerald-500', 'text-slate-950');
                micBtn.classList.add('bg-slate-800/90', 'text-emerald-400');
                if (micBtnLabel) micBtnLabel.textContent = 'Falar';
                if (wakewordBadge) {
                  wakewordBadge.classList.replace('border-emerald-400', 'border-emerald-500/30');
                  wakewordBadge.classList.replace('bg-emerald-500/25', 'bg-emerald-500/10');
                }
                if (!isWaitingResponse && !speech.isSpeaking) {
                  avatar.setState('idle');
                  updateStatusBadge('wakeword', 'Diga "Unimed" para falar');
                }
              } else {
                micBtn.classList.remove('ring-4', 'ring-emerald-500/40', 'bg-emerald-500', 'text-slate-950');
                micBtn.classList.add('bg-slate-800/90', 'text-emerald-400');
                if (micBtnLabel) micBtnLabel.textContent = 'Falar';
                  if (!isWaitingResponse && !speech.isSpeaking) {
                    avatar.setState('idle');
                    updateStatusBadge('idle', 'Pronto para conversar');
                  }
                }
              },
              onRecognitionResult: ({ interim, final }) => {
                if (interim) {
                  chatInput.value = interim;
                }
                if (final) {
                  chatInput.value = final;
                  sendMessage(final);
                }
              },
                onRecognitionError: (errorType) => {
                  if (errorType === 'not-supported') {
                    showSystemNotice('Reconhecimento de voz não suportado neste navegador. Use o teclado abaixo.');
                  } else if (errorType === 'not-allowed') {
                    showSystemNotice('Permissão de microfone negada. Libere o microfone para ativar por voz com "Unimed".');
                  }
                },
  });

  if (!speech.hasSTTSupport() && micBtn) {
    micBtn.title = 'Reconhecimento de voz indisponível neste navegador';
    micBtn.classList.add('opacity-50');
  }

  /**
   * Atualiza o indicador visual de status no topo do Kiosk
   */
  function updateStatusBadge(state, text) {
    if (!statusLabel || !statusDot) return;
    statusLabel.textContent = text;

    statusDot.className = 'w-3 h-3 rounded-full transition-colors duration-300 ';
    if (state === 'listening') {
      statusDot.className += 'bg-emerald-400 animate-ping';
    } else if (state === 'wakeword') {
      statusDot.className += 'bg-emerald-400 animate-pulse';
    } else if (state === 'thinking') {
      statusDot.className += 'bg-purple-400 animate-pulse';
    } else if (state === 'speaking') {
      statusDot.className += 'bg-sky-400 animate-pulse';
    } else {
      statusDot.className += 'bg-indigo-400';
    }
  }

  /**
   * Adiciona um item ao histórico lateral e atualiza o balão principal do Bloub
   */
  function appendMessageToUI(role, content) {
    if (role === 'assistant' && currentSpeechText) {
      currentSpeechText.textContent = content;
    }

    if (!chatHistoryContainer) return;

    const wrapper = document.createElement('div');
    wrapper.className =
      role === 'user'
        ? 'flex justify-end animate-fade-in'
        : 'flex justify-start animate-fade-in';

    const bubble = document.createElement('div');
    bubble.className =
      role === 'user'
        ? 'max-w-[82%] rounded-2xl rounded-br-sm bg-indigo-600/90 text-white px-4 py-2.5 text-sm md:text-base shadow-md selectable-text'
        : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-800/90 border border-slate-700/70 text-slate-100 px-4 py-2.5 text-sm md:text-base shadow-md selectable-text';

    bubble.textContent = content;
    wrapper.appendChild(bubble);
    chatHistoryContainer.appendChild(wrapper);
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
  }

  function showSystemNotice(notice) {
    if (currentSpeechText) {
      currentSpeechText.textContent = notice;
    }
  }

  /**
   * Envia a mensagem do usuário para o Backend (/api/chat) e reproduz a resposta
   */
  async function sendMessage(rawText) {
    const text = (rawText || '').trim();
    if (!text || isWaitingResponse) return;

    // Pausa fala e microfone enquanto processa a resposta
    speech.stopSpeaking();
    speech.pauseRecognitionTemporarily();
    chatInput.value = '';

    // Adiciona mensagem do usuário na tela e no histórico
    appendMessageToUI('user', text);
    conversationHistory.push({ role: 'user', content: text });

    // Ativa estado THINKING no avatar e na interface
    isWaitingResponse = true;
    sendBtn.disabled = true;
    avatar.setState('thinking');
    updateStatusBadge('thinking', 'Bloub está pensando...');
    if (currentSpeechText) {
      currentSpeechText.innerHTML =
        '<span class="inline-flex items-center gap-2 text-purple-300/90 italic">Pensando na melhor resposta<span class="animate-bounce">.</span><span class="animate-bounce" style="animation-delay:150ms">.</span><span class="animate-bounce" style="animation-delay:300ms">.</span></span>';
    }

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
        throw new Error(data.error || 'Erro ao comunicar com o servidor.');
      }

      const replyText = data.reply;
      const speechText = data.speechText || replyText;

      conversationHistory.push({ role: 'assistant', content: replyText });
      appendMessageToUI('assistant', replyText);

      isWaitingResponse = false;
      sendBtn.disabled = false;

      // Dispara a síntese de voz (que ao terminar reativa o modo Wake Word "Unimed")
      speech.speak(speechText);
    } catch (error) {
      console.error('[App] Falha ao consultar /api/chat:', error);
      isWaitingResponse = false;
      sendBtn.disabled = false;
      avatar.setState('idle');
      updateStatusBadge('wakeword', 'Diga "Unimed" para falar');

      const fallbackMsg =
        'Ops! Tive uma pequena falha de conexão agora. Pode tentar enviar novamente?';
      appendMessageToUI('assistant', fallbackMsg);
      speech.speak(fallbackMsg);
    }
  }

  /**
   * Desbloqueio inicial do Totem (necessário para Web Speech API em tablets)
   */
  if (startKioskBtn) {
    startKioskBtn.addEventListener('click', () => {
      speech.unlockAudio();

      if (startOverlay) {
        startOverlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
          startOverlay.style.display = 'none';
        }, 400);
      }

      // Saudação inicial do Bloub (ao terminar de falar, inicia escuta da palavra "Unimed")
      conversationHistory = [{ role: 'assistant', content: INITIAL_GREETING }];
      chatHistoryContainer.innerHTML = '';
      appendMessageToUI('assistant', INITIAL_GREETING);
      speech.speak(INITIAL_GREETING);
    });
  }

  // Envio pelo formulário de texto
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage(chatInput.value);
    });
  }

  // Botão de Microfone (Falar diretamente ou alternar modo)
  if (micBtn) {
    micBtn.addEventListener('click', () => {
      speech.unlockAudio();
      speech.toggleManualListening();
    });
  }

  // Botões de Sugestão Rápida (Touch-Friendly para Totem)
  quickPromptBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const promptText = btn.getAttribute('data-prompt');
      if (promptText) {
        speech.unlockAudio();
        sendMessage(promptText);
      }
    });
  });

  // Botão de Ativar/Desativar Voz (Mute)
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const muted = speech.toggleMute();
      if (muteIconOn && muteIconOff) {
        muteIconOn.classList.toggle('hidden', muted);
        muteIconOff.classList.toggle('hidden', !muted);
      }
      muteBtn.setAttribute(
        'title',
        muted ? 'Áudio silenciado (Toque para ativar)' : 'Áudio ativo (Toque para silenciar)'
      );
    });
  }

  // Botão de Reiniciar Sessão do Totem
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      speech.stopSpeaking();
      conversationHistory = [{ role: 'assistant', content: INITIAL_GREETING }];
      if (chatHistoryContainer) chatHistoryContainer.innerHTML = '';
      appendMessageToUI('assistant', INITIAL_GREETING);
      avatar.setState('idle');
      updateStatusBadge('wakeword', 'Sessão reiniciada');
      speech.speak(INITIAL_GREETING);
    });
  }

  // Botão de Tela Cheia (Modo Kiosk no Tablet)
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => { });
      } else {
        document.exitFullscreen?.().catch(() => { });
      }
    });
  }
});

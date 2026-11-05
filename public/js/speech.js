/**
 * ============================================================================
 * SpeechManager - Integração Web Speech API (TTS + STT + Wake Word "Unimed")
 * ============================================================================
 * - Síntese de voz (window.speechSynthesis) com priorização de vozes pt-BR
 * - Desbloqueio de autoplay e sinal sonoro via Web Audio API
 * - Escuta contínua da frase de ativação "Unimed" + modo de comando direto
 */

class SpeechManager {
  constructor({
    wakeWord = 'Unimed',
    onSpeakStart,
    onSpeakBoundary,
    onSpeakEnd,
    onWakeWordDetected,
    onRecognitionResult,
    onRecognitionStateChange,
    onRecognitionError,
  }) {
    this.wakeWord = wakeWord;
    // Regex tolerante a pequenas variações de transcrição do navegador para "Unimed"
    this.wakeWordRegex = /\b(unimed|uni\s*med|unimede)\b/i;

    this.synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.voices = [];
    this.selectedVoice = null;
    this.isMuted = false;
    this.isAudioUnlocked = false;
    this.isSpeaking = false;
    this.keepAliveTimer = null;
    this.audioCtx = null;

    // Callbacks de sincronização com o Avatar e UI
    this.onSpeakStart = onSpeakStart || (() => {});
    this.onSpeakBoundary = onSpeakBoundary || (() => {});
    this.onSpeakEnd = onSpeakEnd || (() => {});
    this.onWakeWordDetected = onWakeWordDetected || (() => {});
    this.onRecognitionResult = onRecognitionResult || (() => {});
    this.onRecognitionStateChange = onRecognitionStateChange || (() => {});
    this.onRecognitionError = onRecognitionError || (() => {});

    this.recognition = null;
    this.isRecognizing = false;
    // 'off' | 'wakeword' (aguardando "Unimed") | 'active' (ouvindo a pergunta do usuário)
    this.listenMode = 'off';
    this.wakeWordAutoStandby = true;
    this.pausedForProcessing = false;
    this.commandTimeout = null;

    this.initTTS();
    this.initSTT();
  }

  /**
   * Inicializa e seleciona a melhor voz em Português do Brasil (pt-BR)
   */
  initTTS() {
    if (!this.synth) {
      console.warn('[SpeechManager] Web Speech API (speechSynthesis) não suportada neste navegador.');
      return;
    }

    const loadVoices = () => {
      const available = this.synth.getVoices();
      if (!available || available.length === 0) return;

      this.voices = available;

      const ptBrVoices = available.filter((v) =>
        v.lang.toLowerCase().replace('_', '-').startsWith('pt-br')
      );
      const anyPtVoices = available.filter((v) =>
        v.lang.toLowerCase().startsWith('pt')
      );

      const preferredNames = [
        'francisca',
        'antonio',
        'thalita',
        'google português do brasil',
        'luciana',
        'felipe',
        'natural',
        'brasil',
      ];

      const pool = ptBrVoices.length > 0 ? ptBrVoices : anyPtVoices;

      let bestVoice = null;
      for (const keyword of preferredNames) {
        bestVoice = pool.find((v) => v.name.toLowerCase().includes(keyword));
        if (bestVoice) break;
      }

      this.selectedVoice = bestVoice || pool[0] || available[0] || null;

      const voiceBadge = document.getElementById('voice-name-label');
      if (voiceBadge && this.selectedVoice) {
        voiceBadge.textContent = `${this.selectedVoice.name} (${this.selectedVoice.lang})`;
      }
    };

    loadVoices();
    if (typeof this.synth.onvoiceschanged !== 'undefined') {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Desbloqueia o motor de síntese de voz e Web Audio API após toque inicial no tablet
   */
  unlockAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    if (!this.synth || this.isAudioUnlocked) return;

    try {
      this.synth.cancel();
      const warmUpUtterance = new SpeechSynthesisUtterance('');
      warmUpUtterance.volume = 0;
      warmUpUtterance.lang = 'pt-BR';
      this.synth.speak(warmUpUtterance);
      this.isAudioUnlocked = true;
    } catch (err) {
      console.warn('[SpeechManager] Aviso ao desbloquear áudio:', err);
    }
  }

  /**
   * Emite um bip harmônico suave quando a frase de ativação "Unimed" é detectada
   */
  playWakeChime() {
    if (this.isMuted) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) this.audioCtx = new AudioContextClass();
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // Dó (C5)
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.14); // Sol (G5)

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      // Ignora caso o contexto de áudio ainda não esteja disponível
    }
  }

  /**
   * Limpa o texto antes de enviar para o sintetizador de voz
   */
  cleanTextForTTS(text) {
    if (!text) return '';
    return text
      .replace(/[*_~`#>-]+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Reproduz um texto em voz alta sincronizando o estado do avatar Bloub
   */
  speak(text) {
    if (!this.synth || this.isMuted || !text) {
      this.isSpeaking = false;
      this.onSpeakEnd();
      this.resumeStandbyIfNeeded();
      return;
    }

    // Pausa o reconhecimento de voz enquanto o Bloub fala para não ouvir a própria voz
    this.pauseRecognitionTemporarily();

    this.synth.cancel();
    clearInterval(this.keepAliveTimer);

    const cleanedText = this.cleanTextForTTS(text);
    if (!cleanedText) {
      this.isSpeaking = false;
      this.onSpeakEnd();
      this.resumeStandbyIfNeeded();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.04;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.onSpeakStart();

      this.keepAliveTimer = setInterval(() => {
        if (this.synth.speaking && !this.synth.paused) {
          this.synth.pause();
          this.synth.resume();
        } else {
          clearInterval(this.keepAliveTimer);
        }
      }, 10000);
    };

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        this.onSpeakBoundary(event);
      }
    };

    const finishSpeech = () => {
      clearInterval(this.keepAliveTimer);
      this.isSpeaking = false;
      this.onSpeakEnd();
      // Retoma a escuta da palavra de ativação "Unimed" após terminar de falar
      setTimeout(() => {
        this.resumeStandbyIfNeeded();
      }, 350);
    };

    utterance.onend = finishSpeech;

    utterance.onerror = (event) => {
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.warn('[SpeechManager] Aviso no TTS:', event.error);
      }
      finishSpeech();
    };

    this.synth.speak(utterance);
  }

  /**
   * Interrompe imediatamente qualquer fala em andamento
   */
  stopSpeaking() {
    clearInterval(this.keepAliveTimer);
    this.isSpeaking = false;
    if (this.synth) {
      this.synth.cancel();
    }
    this.onSpeakEnd();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopSpeaking();
    }
    return this.isMuted;
  }

  /**
   * Extrai o texto após a palavra de ativação "Unimed"
   */
  extractPostWakeWordText(transcript) {
    const match = this.wakeWordRegex.exec(transcript);
    if (!match) return null;
    const afterWakeWord = transcript
      .slice(match.index + match[0].length)
      .replace(/^[,.:;?!-\s]+/, '')
      .trim();
    return afterWakeWord;
  }

  /**
   * Inicializa Reconhecimento de Voz (Speech-to-Text) com suporte a Wake Word ("Unimed")
   */
  initSTT() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.info('[SpeechManager] SpeechRecognition não disponível neste navegador.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'pt-BR';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isRecognizing = true;
      this.onRecognitionStateChange(this.listenMode);
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const combinedInterim = interimTranscript.trim();
      const combinedFinal = finalTranscript.trim();

      // MODO 1: Aguardando a frase de ativação "Unimed"
      if (this.listenMode === 'wakeword') {
        // Verifica se "Unimed" apareceu no resultado parcial (interim) para reação instantânea
        if (combinedInterim && this.wakeWordRegex.test(combinedInterim)) {
          const postText = this.extractPostWakeWordText(combinedInterim);
          this.activateFromWakeWord(postText);
          return;
        }

        // Verifica se "Unimed" apareceu no resultado final
        if (combinedFinal && this.wakeWordRegex.test(combinedFinal)) {
          const postText = this.extractPostWakeWordText(combinedFinal);
          this.playWakeChime();

          // Se o usuário já falou a pergunta logo após "Unimed" (ex: "Unimed quem é você?")
          if (postText && postText.length >= 3) {
            this.onWakeWordDetected({ immediateCommand: postText });
            this.onRecognitionResult({ interim: '', final: postText });
          } else {
            // O usuário disse apenas "Unimed" -> entra em escuta ativa da pergunta
            this.activateFromWakeWord('');
          }
        }
        return;
      }

      // MODO 2: Escuta Ativa (após dizer "Unimed" ou tocar no botão Falar)
      if (this.listenMode === 'active') {
        this.resetCommandTimeout();

        // Remove a palavra "Unimed" do início caso ainda esteja no mesmo buffer
        const cleanInterim = combinedInterim.replace(/^.*?\b(unimed|uni\s*med|unimede)\b[,.:;?!-\s]*/i, '').trim();
        const cleanFinal = combinedFinal.replace(/^.*?\b(unimed|uni\s*med|unimede)\b[,.:;?!-\s]*/i, '').trim();

        if (cleanInterim || cleanFinal) {
          this.onRecognitionResult({
            interim: cleanInterim,
            final: cleanFinal,
          });
        }
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.wakeWordAutoStandby = false;
        this.listenMode = 'off';
        this.isRecognizing = false;
        this.onRecognitionStateChange('off');
        this.onRecognitionError(event.error);
      }
    };

    this.recognition.onend = () => {
      this.isRecognizing = false;

      // Se não estiver falando nem aguardando resposta e o modo standby estiver ativo, reinicia escuta
      if (
        this.wakeWordAutoStandby &&
        !this.isSpeaking &&
        !this.pausedForProcessing &&
        this.listenMode !== 'off'
      ) {
        setTimeout(() => {
          if (
            this.wakeWordAutoStandby &&
            !this.isSpeaking &&
            !this.pausedForProcessing &&
            !this.isRecognizing
          ) {
            try {
              this.recognition.start();
            } catch (e) {
              // Ignora caso já tenha sido iniciado
            }
          }
        }, 250);
      } else {
        this.onRecognitionStateChange('off');
      }
    };
  }

  /**
   * Transiciona do modo standby ("Unimed") para o modo de escuta ativa da pergunta
   */
  activateFromWakeWord(initialInterim = '') {
    if (this.listenMode === 'active') return;
    this.listenMode = 'active';
    this.playWakeChime();
    this.onWakeWordDetected({ immediateCommand: null });
    this.onRecognitionStateChange('active');

    if (initialInterim) {
      this.onRecognitionResult({ interim: initialInterim, final: '' });
    }

    this.resetCommandTimeout();
  }

  /**
   * Se o usuário ativar com "Unimed" mas não falar nada por 9 segundos, volta para standby
   */
  resetCommandTimeout() {
    clearTimeout(this.commandTimeout);
    this.commandTimeout = setTimeout(() => {
      if (this.listenMode === 'active' && !this.pausedForProcessing) {
        this.listenMode = 'wakeword';
        this.onRecognitionStateChange('wakeword');
      }
    }, 9000);
  }

  hasSTTSupport() {
    return Boolean(this.recognition);
  }

  /**
   * Inicia o monitoramento contínuo da palavra de ativação "Unimed"
   */
  startWakeWordStandby() {
    if (!this.recognition) return;
    this.pausedForProcessing = false;
    this.listenMode = 'wakeword';
    this.onRecognitionStateChange('wakeword');

    if (!this.isRecognizing && !this.isSpeaking) {
      try {
        this.recognition.start();
      } catch (e) {
        // Ignora se já estiver rodando
      }
    }
  }

  /**
   * Pausa o microfone temporariamente enquanto consulta a IA ou fala a resposta
   */
  pauseRecognitionTemporarily() {
    clearTimeout(this.commandTimeout);
    this.pausedForProcessing = true;
    if (this.recognition && this.isRecognizing) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  /**
   * Retoma o modo standby ("Unimed") quando o Bloub termina de falar
   */
  resumeStandbyIfNeeded() {
    this.pausedForProcessing = false;
    if (this.wakeWordAutoStandby && this.recognition && !this.isSpeaking) {
      this.startWakeWordStandby();
    }
  }

  /**
   * Alterna escuta ativa quando o usuário toca manualmente no botão "Falar"
   */
  toggleManualListening() {
    if (!this.recognition) {
      this.onRecognitionError('not-supported');
      return;
    }

    this.stopSpeaking();

    if (this.listenMode === 'active' && this.isRecognizing) {
      // Volta para standby se já estava em escuta ativa
      this.startWakeWordStandby();
    } else {
      // Ativa escuta imediata sem precisar falar "Unimed"
      this.pausedForProcessing = false;
      this.listenMode = 'active';
      this.playWakeChime();
      this.onRecognitionStateChange('active');
      this.resetCommandTimeout();

      if (!this.isRecognizing) {
        try {
          this.recognition.start();
        } catch (err) {
          console.warn('[SpeechManager] Erro ao iniciar microfone:', err);
        }
      }
    }
  }
}

window.SpeechManager = SpeechManager;

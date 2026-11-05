/**
 * ============================================================================
 * BloubAvatarController - Controle e Expressão dos Olhos do Avatar
 * ============================================================================
 * Animação fluida e reativa dos dois olhos originais do Bloub (test.txt):
 *   - 'idle'      : Standby (cor Branca), piscar natural e respiração
 *   - 'listening' : ATIVO (cor Verde Esmeralda Neon), olhos bem abertos e atentos
 *   - 'thinking'  : RESPONDENDO / Pensando (cor Violeta/Azul), olhar reflexivo
 *   - 'speaking'  : RESPONDENDO / Falando (cor Azul Elétrico), pulsando ao som da voz
 */

class BloubAvatarController {
  constructor() {
    this.stageEl = document.getElementById('avatar-stage');
    this.svgEl = document.getElementById('bloub-eyes-svg');
    this.eyeLeftPath = document.getElementById('bloub-eye-left');
    this.eyeRightPath = document.getElementById('bloub-eye-right');

    this.state = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking'

    // Posições base extraídas da geometria original de test.txt
    this.eyeCurrent = {
      leftX: 11.67,
      leftY: -45.56,
      rightX: 55.89,
      rightY: -56.47,
      scaleY: 0.83,
      scaleX: 1.0,
    };

    this.eyeTarget = {
      leftX: 11.67,
      leftY: -45.56,
      rightX: 55.89,
      rightY: -56.47,
      scaleY: 0.83,
      scaleX: 1.0,
    };

    this.isBlinking = false;
    this.speechEnergy = 0;
    this.targetSpeechEnergy = 0;
    this.startTime = performance.now();

    this.initTimers();
    this.initPointerTracking();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  /**
   * Altera o estado visual dos olhos
   * 'idle' = Standby (Branco)
   * 'listening' = ATIVO (Verde)
   * 'thinking' | 'speaking' = RESPONDENDO (Azul/Ciano)
   */
  setState(newState) {
    if (!['idle', 'listening', 'thinking', 'speaking'].includes(newState)) {
      return;
    }
    this.state = newState;

    if (this.stageEl) {
      this.stageEl.setAttribute('data-state', newState);
    }

    this.updateEyePoseForState(newState);
  }

  /**
   * Pulso nos olhos sincronizado com cada palavra pronunciada no TTS
   */
  triggerWordPulse(intensity = 1.0) {
    this.targetSpeechEnergy = Math.min(1.5, 0.7 + Math.random() * 0.7 * intensity);
  }

  updateEyePoseForState(state) {
    if (state === 'listening') {
      // ATIVO: Olhos frontais bem abertos e atentos ao usuário
      this.eyeTarget.leftX = 18;
      this.eyeTarget.leftY = -42;
      this.eyeTarget.rightX = 58;
      this.eyeTarget.rightY = -46;
      this.eyeTarget.scaleY = 0.98;
      this.eyeTarget.scaleX = 1.06;
    } else if (state === 'thinking') {
      // RESPONDENDO (gerando resposta): Olhar pensativo para cima
      this.eyeTarget.leftX = 8;
      this.eyeTarget.leftY = -55;
      this.eyeTarget.rightX = 50;
      this.eyeTarget.rightY = -62;
      this.eyeTarget.scaleY = 0.78;
      this.eyeTarget.scaleX = 0.95;
    } else if (state === 'speaking') {
      // RESPONDENDO (falando): Olhos vivos, ligeiramente expressivos
      this.eyeTarget.leftX = 15;
      this.eyeTarget.leftY = -44;
      this.eyeTarget.rightX = 56;
      this.eyeTarget.rightY = -48;
      this.eyeTarget.scaleY = 0.9;
      this.eyeTarget.scaleX = 1.02;
    } else {
      // IDLE / STANDBY: Pose original elegante de test.txt
      this.eyeTarget.leftX = 11.67;
      this.eyeTarget.leftY = -45.56;
      this.eyeTarget.rightX = 55.89;
      this.eyeTarget.rightY = -56.47;
      this.eyeTarget.scaleY = 0.83;
      this.eyeTarget.scaleX = 1.0;
    }
  }

  /**
   * Piscar orgânico e variações periódicas de olhar em repouso
   */
  initTimers() {
    const scheduleBlink = () => {
      const delay = 2400 + Math.random() * 2600;
      setTimeout(() => {
        this.blink();
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();

    setInterval(() => {
      if (this.state === 'idle') {
        const presets = [
          { lx: 11.67, ly: -45.56, rx: 55.89, ry: -56.47 },
          { lx: 18.0, ly: -40.0, rx: 62.0, ry: -48.0 },
          { lx: 5.0, ly: -48.0, rx: 48.0, ry: -58.0 },
          { lx: 22.0, ly: -38.0, rx: 64.0, ry: -42.0 },
        ];
        const chosen = presets[Math.floor(Math.random() * presets.length)];
        this.eyeTarget.leftX = chosen.lx;
        this.eyeTarget.leftY = chosen.ly;
        this.eyeTarget.rightX = chosen.rx;
        this.eyeTarget.rightY = chosen.ry;
      }
    }, 2800);
  }

  /**
   * Os olhos acompanham suavemente a posição do toque na tela do tablet
   */
  initPointerTracking() {
    window.addEventListener(
      'pointermove',
      (e) => {
        if (this.state !== 'idle') return;
        const normX = (e.clientX / window.innerWidth - 0.5) * 2;
        const normY = (e.clientY / window.innerHeight - 0.5) * 2;

        this.eyeTarget.leftX = 11.67 + normX * 14;
        this.eyeTarget.leftY = -45.56 + normY * 10;
        this.eyeTarget.rightX = 55.89 + normX * 14;
        this.eyeTarget.rightY = -56.47 + normY * 10;
      },
      { passive: true }
    );
  }

  blink() {
    if (this.isBlinking) return;
    this.isBlinking = true;
    setTimeout(() => {
      this.isBlinking = false;
    }, 140);
  }

  animate(now) {
    const timeSec = (now - this.startTime) / 1000;

    if (this.state === 'speaking') {
      const speechMod = 0.5 + 0.5 * Math.abs(Math.sin(timeSec * 8) * Math.cos(timeSec * 5));
      this.targetSpeechEnergy = Math.max(this.targetSpeechEnergy * 0.9, speechMod);
    } else {
      this.targetSpeechEnergy = 0;
    }

    this.speechEnergy += (this.targetSpeechEnergy - this.speechEnergy) * 0.25;

    // Interpolação suave
    const lerp = 0.1;
    this.eyeCurrent.leftX += (this.eyeTarget.leftX - this.eyeCurrent.leftX) * lerp;
    this.eyeCurrent.leftY += (this.eyeTarget.leftY - this.eyeCurrent.leftY) * lerp;
    this.eyeCurrent.rightX += (this.eyeTarget.rightX - this.eyeCurrent.rightX) * lerp;
    this.eyeCurrent.rightY += (this.eyeTarget.rightY - this.eyeCurrent.rightY) * lerp;

    const targetScaleY = this.isBlinking
      ? 0.05
      : this.eyeTarget.scaleY + (this.state === 'speaking' ? this.speechEnergy * 0.12 : 0);
    this.eyeCurrent.scaleY += (targetScaleY - this.eyeCurrent.scaleY) * (this.isBlinking ? 0.5 : 0.25);

    // Flutuação orgânica sutil
    const floatY = Math.sin(timeSec * 1.8) * 1.8;

    if (this.eyeLeftPath && this.eyeRightPath) {
      const sy = this.eyeCurrent.scaleY.toFixed(3);
      const lx = this.eyeCurrent.leftX.toFixed(2);
      const ly = (this.eyeCurrent.leftY + floatY).toFixed(2);
      const rx = this.eyeCurrent.rightX.toFixed(2);
      const ry = (this.eyeCurrent.rightY + floatY).toFixed(2);

      this.eyeLeftPath.setAttribute(
        'transform',
        `matrix(0.89,-0.34,0.43,${sy},${lx},${ly})`
      );
      this.eyeRightPath.setAttribute(
        'transform',
        `matrix(0.70,-0.06,0.43,${sy},${rx},${ry})`
      );
    }

    requestAnimationFrame(this.animate);
  }
}

window.BloubAvatarController = BloubAvatarController;

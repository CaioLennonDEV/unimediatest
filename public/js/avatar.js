/**
 * ============================================================================
 * BloubAvatarController - Motor de Animação Procedural do Avatar SVG "Bloub"
 * ============================================================================
 * Preserva a geometria original de `test.txt` / `bloub-cercle-neutre-encre.svg`
 * (corpo orgânico de 60 vértices + máscara com dois olhos expressivos) e
 * anima de forma fluida os estados:
 *   - 'idle'      : Respiração suave, piscar natural e olhar curioso
 *   - 'listening' : Atenção focada no usuário, olhos dilatados e alerta verde
 *   - 'thinking'  : Olhar pensativo para o alto, flutuação e oscilação rápida
 *   - 'speaking'  : Pulso labial/contorno sincronizado com a voz e ondas sonoras
 */

class BloubAvatarController {
  constructor() {
    this.stageEl = document.getElementById('avatar-stage');
    this.svgEl = document.getElementById('bloub-svg');
    this.maskBodyPath = document.getElementById('bloub-mask-body');
    this.outerBodyPath = document.getElementById('bloub-outer-body');
    this.eyeLeftPath = document.getElementById('bloub-eye-left');
    this.eyeRightPath = document.getElementById('bloub-eye-right');
    this.eyeHighlightRect = document.getElementById('bloub-eye-glow');
    this.soundwaveEl = document.getElementById('soundwave-container');
    this.soundwaveBars = Array.from(document.querySelectorAll('.soundwave-bar'));

    this.state = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking'
    this.numPoints = 60;
    this.baseRadius = 100;

    // Estado de animação dos olhos (baseado nas matrizes originais do test.txt)
    this.eyeCurrent = {
      leftX: 11.67,
      leftY: -45.56,
      rightX: 55.89,
      rightY: -56.47,
      scaleY: 0.83,
    };

    this.eyeTarget = {
      leftX: 11.67,
      leftY: -45.56,
      rightX: 55.89,
      rightY: -56.47,
      scaleY: 0.83,
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
   * Altera o estado visual da personagem ('idle', 'listening', 'thinking', 'speaking')
   */
  setState(newState) {
    if (!['idle', 'listening', 'thinking', 'speaking'].includes(newState)) {
      return;
    }
    this.state = newState;

    if (this.stageEl) {
      this.stageEl.setAttribute('data-state', newState);
    }

    if (this.soundwaveEl) {
      this.soundwaveEl.classList.toggle(
        'active',
        newState === 'speaking' || newState === 'listening'
      );
      this.soundwaveEl.classList.toggle('listening', newState === 'listening');
    }

    // Ajusta cor da luz dos olhos vazados e contorno conforme o estado
    if (this.outerBodyPath) {
      if (newState === 'listening') {
        this.outerBodyPath.setAttribute('fill', '#d1fae5');
      } else if (newState === 'thinking') {
        this.outerBodyPath.setAttribute('fill', '#ede9fe');
      } else if (newState === 'speaking') {
        this.outerBodyPath.setAttribute('fill', '#e0f2fe');
      } else {
        this.outerBodyPath.setAttribute('fill', '#f9f9f9');
      }
    }

    // Define pose alvo dos olhos para cada estado
    this.updateEyePoseForState(newState);
  }

  /**
   * Dispara um pulso extra de energia quando cada palavra é pronunciada no TTS (onboundary)
   */
  triggerWordPulse(intensity = 1.0) {
    this.targetSpeechEnergy = Math.min(1.4, 0.65 + Math.random() * 0.65 * intensity);
  }

  updateEyePoseForState(state) {
    if (state === 'thinking') {
      // Olha para cima e para a esquerda como quem está pensando
      this.eyeTarget.leftX = -18;
      this.eyeTarget.leftY = -58;
      this.eyeTarget.rightX = 26;
      this.eyeTarget.rightY = -66;
      this.eyeTarget.scaleY = 0.78;
    } else if (state === 'listening') {
      // Olha centralizado e atento para o usuário em frente ao totem
      this.eyeTarget.leftX = -20;
      this.eyeTarget.leftY = -28;
      this.eyeTarget.rightX = 24;
      this.eyeTarget.rightY = -28;
      this.eyeTarget.scaleY = 0.96;
    } else if (state === 'speaking') {
      // Olhar expressivo voltado ao interlocutor
      this.eyeTarget.leftX = -12;
      this.eyeTarget.leftY = -34;
      this.eyeTarget.rightX = 32;
      this.eyeTarget.rightY = -38;
      this.eyeTarget.scaleY = 0.9;
    } else {
      // Posição clássica original do Bloub (test.txt)
      this.eyeTarget.leftX = 11.67;
      this.eyeTarget.leftY = -45.56;
      this.eyeTarget.rightX = 55.89;
      this.eyeTarget.rightY = -56.47;
      this.eyeTarget.scaleY = 0.83;
    }
  }

  /**
   * Configura piscar automático e pequenas mudanças de olhar em repouso
   */
  initTimers() {
    // Piscar natural a cada 2.8s ~ 5.2s
    const scheduleBlink = () => {
      const delay = 2600 + Math.random() * 2800;
      setTimeout(() => {
        this.blink();
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();

    // Movimento espontâneo dos olhos quando em IDLE
    setInterval(() => {
      if (this.state === 'idle') {
        const presets = [
          { lx: 11.67, ly: -45.56, rx: 55.89, ry: -56.47 }, // Original test.txt
          { lx: 19.82, ly: -42.1, rx: 62.5, ry: -52.21 },   // Variante bloub-cercle-neutre-encre.svg
          { lx: -16.0, ly: -34.0, rx: 28.0, ry: -36.0 },    // Olhando de frente para o usuário
          { lx: -32.0, ly: -42.0, rx: 12.0, ry: -48.0 },    // Olhando para o lado esquerdo
          { lx: 2.0, ly: -26.0, rx: 46.0, ry: -32.0 },      // Olhando levemente para baixo (input)
        ];
        const chosen = presets[Math.floor(Math.random() * presets.length)];
        this.eyeTarget.leftX = chosen.lx;
        this.eyeTarget.leftY = chosen.ly;
        this.eyeTarget.rightX = chosen.rx;
        this.eyeTarget.rightY = chosen.ry;
      } else if (this.state === 'speaking') {
        // Pequena variação expressiva enquanto fala
        const offsetX = (Math.random() - 0.5) * 16;
        const offsetY = (Math.random() - 0.5) * 10;
        this.eyeTarget.leftX = -14 + offsetX;
        this.eyeTarget.leftY = -34 + offsetY;
        this.eyeTarget.rightX = 30 + offsetX;
        this.eyeTarget.rightY = -38 + offsetY;
      }
    }, 2200);
  }

  /**
   * Permite que o Bloub acompanhe sutilmente o toque do usuário na tela do tablet
   */
  initPointerTracking() {
    window.addEventListener(
      'pointermove',
      (e) => {
        if (this.state !== 'idle') return;
        const normX = (e.clientX / window.innerWidth - 0.5) * 2;
        const normY = (e.clientY / window.innerHeight - 0.5) * 2;

        this.eyeTarget.leftX = -12 + normX * 26;
        this.eyeTarget.leftY = -35 + normY * 20;
        this.eyeTarget.rightX = 32 + normX * 26;
        this.eyeTarget.rightY = -40 + normY * 20;
      },
      { passive: true }
    );
  }

  blink() {
    if (this.isBlinking) return;
    this.isBlinking = true;
    setTimeout(() => {
      this.isBlinking = false;
    }, 150);
  }

  /**
   * Gera o path SVG de 60 pontos orgânicos com deformação harmônica suave
   */
  buildBlobPath(timeSec, radiusOffsetX = 0, radiusOffsetY = 0, extraScale = 1) {
    let amp1 = 1.4;
    let amp2 = 0.9;
    let speed = 1.6;

    if (this.state === 'listening') {
      amp1 = 2.6;
      amp2 = 1.8;
      speed = 2.8;
    } else if (this.state === 'thinking') {
      amp1 = 3.8;
      amp2 = 2.6;
      speed = 4.2;
    } else if (this.state === 'speaking') {
      amp1 = 3.2 + this.speechEnergy * 5.2;
      amp2 = 2.4 + this.speechEnergy * 4.0;
      speed = 5.4;
    }

    const points = [];
    for (let i = 0; i < this.numPoints; i++) {
      const angle = (i / this.numPoints) * Math.PI * 2;
      const wave1 = Math.sin(angle * 3 + timeSec * speed) * amp1;
      const wave2 = Math.cos(angle * 4 - timeSec * (speed * 1.25)) * amp2;
      const wave3 =
        this.state === 'speaking'
          ? Math.sin(angle * 6 + timeSec * 9.5) * (this.speechEnergy * 2.5)
          : 0;

      const r = (this.baseRadius + wave1 + wave2 + wave3) * extraScale;
      const x = Math.cos(angle) * r + radiusOffsetX;
      const y = Math.sin(angle) * r + radiusOffsetY;
      points.push({ x, y });
    }

    // Constrói curvas cúbicas suaves como no SVG original do Bloub
    let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 0; i < this.numPoints; i++) {
      const p0 = points[(i - 1 + this.numPoints) % this.numPoints];
      const p1 = points[i];
      const p2 = points[(i + 1) % this.numPoints];
      const p3 = points[(i + 2) % this.numPoints];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += `C${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d + 'Z';
  }

  /**
   * Atualiza as barras de ondas sonoras quando o Bloub está falando ou ouvindo
   */
  updateSoundwaveBars(timeSec) {
    if (!this.soundwaveBars.length) return;

    const isActive = this.state === 'speaking' || this.state === 'listening';
    this.soundwaveBars.forEach((bar, idx) => {
      if (!isActive) {
        bar.style.height = '6px';
        return;
      }

      const multiplier = this.state === 'speaking' ? 18 + this.speechEnergy * 12 : 14;
      const wave =
        Math.abs(Math.sin(timeSec * 7.5 + idx * 0.7) * Math.cos(timeSec * 4.2 - idx * 0.4));
      const heightPx = Math.max(6, Math.round(6 + wave * multiplier));
      bar.style.height = `${heightPx}px`;
    });
  }

  /**
   * Loop principal de renderização (60fps)
   */
  animate(now) {
    const timeSec = (now - this.startTime) / 1000;

    // Simula modulação contínua de fala enquanto no estado speaking
    if (this.state === 'speaking') {
      const naturalModulation =
        0.45 + 0.4 * Math.abs(Math.sin(timeSec * 8.5) * Math.cos(timeSec * 5.1));
      this.targetSpeechEnergy = Math.max(this.targetSpeechEnergy * 0.92, naturalModulation);
    } else {
      this.targetSpeechEnergy = 0;
    }

    this.speechEnergy += (this.targetSpeechEnergy - this.speechEnergy) * 0.22;

    // Interpolação suave da posição dos olhos
    const lerpFactor = 0.08;
    this.eyeCurrent.leftX += (this.eyeTarget.leftX - this.eyeCurrent.leftX) * lerpFactor;
    this.eyeCurrent.leftY += (this.eyeTarget.leftY - this.eyeCurrent.leftY) * lerpFactor;
    this.eyeCurrent.rightX += (this.eyeTarget.rightX - this.eyeCurrent.rightX) * lerpFactor;
    this.eyeCurrent.rightY += (this.eyeTarget.rightY - this.eyeCurrent.rightY) * lerpFactor;

    const targetScaleY = this.isBlinking ? 0.06 : this.eyeTarget.scaleY;
    this.eyeCurrent.scaleY += (targetScaleY - this.eyeCurrent.scaleY) * (this.isBlinking ? 0.45 : 0.25);

    // Aplica matrizes de transformação aos dois olhos dentro da máscara SVG
    if (this.eyeLeftPath && this.eyeRightPath) {
      const sy = this.eyeCurrent.scaleY.toFixed(3);
      const lx = this.eyeCurrent.leftX.toFixed(2);
      const ly = this.eyeCurrent.leftY.toFixed(2);
      const rx = this.eyeCurrent.rightX.toFixed(2);
      const ry = this.eyeCurrent.rightY.toFixed(2);

      this.eyeLeftPath.setAttribute(
        'transform',
        `matrix(0.89,-0.34,0.43,${sy},${lx},${ly})`
      );
      this.eyeRightPath.setAttribute(
        'transform',
        `matrix(0.70,-0.06,0.43,${sy},${rx},${ry})`
      );
    }

    // Atualiza o contorno orgânico do Bloub
    const floatY = Math.sin(timeSec * 2.1) * 2.2;
    const maskPathData = this.buildBlobPath(timeSec, -0.5, floatY, 1.0);
    const outerRimPathData = this.buildBlobPath(
      timeSec + 0.08,
      0.8,
      floatY - 0.8,
      1.012 + this.speechEnergy * 0.018
    );

    if (this.maskBodyPath) {
      this.maskBodyPath.setAttribute('d', maskPathData);
    }
    if (this.outerBodyPath) {
      this.outerBodyPath.setAttribute('d', outerRimPathData);
    }

    this.updateSoundwaveBars(timeSec);

    requestAnimationFrame(this.animate);
  }
}

window.BloubAvatarController = BloubAvatarController;

// Visualizer.js - Web Audio API Audio Visualizer
// Supports microphone input, file upload, multiple visualization modes

class AudioVisualizer {
  constructor() {
    this.canvas = document.getElementById('visualizerCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.bufferLength = 0;
    this.animationId = null;
    this.isRunning = false;
    this.mediaStream = null;

    // Configuration
    this.mode = 'circular';
    this.colorScheme = 'neon';
    this.sensitivity = 1;
    this.smoothing = 0.8;

    // Color schemes
    this.colorSchemes = {
      neon: {
        primary: '#0099ff',
        secondary: '#00ffff',
        accent: '#ff00ff',
        background: 'rgba(0, 0, 0, 0.9)',
        glow: '#0099ff'
      },
      rainbow: {
        primary: '#ff0000',
        secondary: '#ffff00',
        accent: '#00ff00',
        background: 'rgba(0, 0, 0, 0.9)',
        glow: '#ffffff'
      },
      fire: {
        primary: '#ff3300',
        secondary: '#ff9900',
        accent: '#ffff00',
        background: 'rgba(20, 0, 0, 0.9)',
        glow: '#ff6600'
      },
      ocean: {
        primary: '#0066ff',
        secondary: '#00ccff',
        accent: '#00ffcc',
        background: 'rgba(0, 10, 30, 0.9)',
        glow: '#00ffff'
      },
      matrix: {
        primary: '#00ff00',
        secondary: '#00aa00',
        accent: '#88ff88',
        background: 'rgba(0, 20, 0, 0.9)',
        glow: '#00ff00'
      }
    };

    // Frequency bands for legend
    this.frequencyBands = [
      { name: 'Sub-Bass', min: 20, max: 60 },
      { name: 'Bass', min: 60, max: 250 },
      { name: 'Low-Mid', min: 250, max: 500 },
      { name: 'Mid', min: 500, max: 2000 },
      { name: 'High-Mid', min: 2000, max: 4000 },
      { name: 'Presence', min: 4000, max: 6000 },
      { name: 'Brilliance', min: 6000, max: 20000 }
    ];

    // Smoothed data for smooth animations
    this.smoothedData = null;
    this.prevData = null;

    // Debug
    this.debugLog = [];
    this.debugExpanded = false;
    this.debugContent = null;
    this.debugPanel = null;

    this.init();
  }

  init() {
    this.bindEvents();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.drawIdle();
  }

  bindEvents() {
    // Mic button - handle click to resume AudioContext immediately
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
      micBtn.addEventListener('click', async (e) => {
        await this.ensureAudioContextResumed();
        this.toggleMicrophone();
      });
    }

    // File input
    const fileBtn = document.getElementById('fileBtn');
    const audioFile = document.getElementById('audioFile');
    if (fileBtn && audioFile) {
      fileBtn.addEventListener('click', () => audioFile.click());
      audioFile.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // Mode selector
    const modeSelect = document.getElementById('visualizerMode');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this.mode = e.target.value;
        this.drawIdle();
      });
    }

    // Color scheme selector
    const colorSelect = document.getElementById('colorScheme');
    if (colorSelect) {
      colorSelect.addEventListener('change', (e) => {
        this.colorScheme = e.target.value;
        this.drawIdle();
      });
    }

    // Sensitivity slider
    const sensSlider = document.getElementById('sensitivity');
    if (sensSlider) {
      sensSlider.addEventListener('input', (e) => {
        this.sensitivity = parseFloat(e.target.value);
        const val = document.getElementById('sensitivityValue');
        if (val) val.textContent = this.sensitivity.toFixed(1) + 'x';
      });
    }

    // Smoothing slider (in options)
    const smoothSlider = document.getElementById('smoothing');
    if (smoothSlider) {
      smoothSlider.addEventListener('input', (e) => {
        this.smoothing = parseFloat(e.target.value);
        const val = document.getElementById('smoothingValue');
        if (val) val.textContent = parseFloat(e.target.value).toFixed(2);
        if (this.analyser) {
          this.analyser.smoothingTimeConstant = this.smoothing;
        }
      });
    }

    // Canvas click to start (if overlay visible)
    if (this.canvas) {
      this.canvas.addEventListener('click', async () => {
        if (!this.isRunning && document.getElementById('canvasOverlay')?.hidden === false) {
          await this.ensureAudioContextResumed();
          this.startMicrophone();
        }
      });
    }

    // Debug Panel
    this.debugPanel = document.getElementById('debugPanel');
    this.debugContent = document.getElementById('debugContent');
    const debugToggleBtn = document.getElementById('debugToggleBtn');
    const clearDebugBtn = document.getElementById('clearDebugBtn');
    const smoothingSlider = document.getElementById('smoothingSlider');
    const smoothingValue = document.getElementById('smoothingValue');

    if (debugToggleBtn && this.debugPanel) {
      debugToggleBtn.addEventListener('click', () => {
        this.debugExpanded = !this.debugExpanded;
        this.debugPanel.hidden = !this.debugExpanded;
        debugToggleBtn.innerHTML = this.debugExpanded 
          ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg> Debug'
          : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> Debug';
      });
    }

    if (clearDebugBtn && this.debugContent) {
      clearDebugBtn.addEventListener('click', () => {
        this.debugLog = [];
        this.renderDebug();
      });
    }

    if (smoothingSlider && smoothingValue) {
      smoothingSlider.addEventListener('input', (e) => {
        this.smoothing = parseFloat(e.target.value);
        smoothingValue.textContent = parseFloat(e.target.value).toFixed(2);
        if (this.analyser) {
          this.analyser.smoothingTimeConstant = this.smoothing;
        }
      });
    }
  }

  toggleMicrophone() {
    if (this.isRunning) {
      this.stopAudio();
    } else {
      this.startMicrophone();
    }
  }

  async ensureAudioContextResumed() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.logDebug('AudioContext', { action: 'created', state: this.audioContext.state });
    }
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        this.logDebug('AudioContext', { action: 'resumed', state: this.audioContext.state });
        console.log('AudioContext resumed, state:', this.audioContext.state);
      } catch (e) {
        this.logDebug('AudioContext', { action: 'resume_failed', error: e.message });
        console.error('Failed to resume AudioContext:', e);
      }
    }
    return this.audioContext;
  }

  resizeCanvas() {
    const container = document.getElementById('visualizerContainer');
    if (!container || !this.canvas) return;
    
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.scale(dpr, dpr);

    this.centerX = rect.width / 2;
    this.centerY = rect.height / 2;
    this.radius = Math.min(this.centerX, this.centerY) - 20;

    this.drawIdle();
  }

  async startMicrophone() {
    try {
      this.updateStatus('Mikrofon wird angefordert...', 'loading');
      this.logDebug('getUserMedia', { action: 'requesting', secureContext: window.isSecureContext });
      console.log('Requesting microphone access...');
      
      // Check if we're in a secure context
      if (!window.isSecureContext) {
        this.logDebug('getUserMedia', { action: 'failed', reason: 'not_secure_context' });
        console.warn('Not in secure context - microphone may not work');
        this.updateStatus('HTTPS erforderlich für Mikrofon', 'error');
        alert('Mikrofonzugriff erfordert HTTPS. Bitte über https:// aufrufen oder localhost verwenden.');
        return;
      }

      // Ensure AudioContext is ready BEFORE getUserMedia
      await this.ensureAudioContextResumed();

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      this.logDebug('getUserMedia', { action: 'granted', tracks: this.mediaStream.getTracks().length });
      console.log('Microphone access granted');
      await this.initAudioContext(this.mediaStream);
      this.updateStatus('Mikrofon aktiv 🎤', 'active');
      
      const micBtn = document.getElementById('micBtn');
      if (micBtn) {
        micBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-6-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
          <span>Mikrofon stoppen
        `;
        micBtn.onclick = () => this.stopAudio();
        micBtn.classList.add('active');
      }

      this.showVisualizer();
      this.startVisualization();

    } catch (err) {
      this.logDebug('getUserMedia', { action: 'error', name: err.name, message: err.message });
      console.error('Microphone error:', err);
      this.updateStatus('Mikrofon-Zugriff verweigert', 'error');
      
      let msg = 'Mikrofon-Zugriff verweigert.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg += '\n\nBitte in Browser-Einstellungen Mikrofon-Berechtigung für diese Seite erlauben und Seite neu laden.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg += '\n\nKein Mikrofon gefunden.';
      } else if (err.name === 'NotReadableError') {
        msg += '\n\nMikrofon wird von anderer Anwendung verwendet.';
      } else {
        msg += `\n\nFehler: ${err.message}`;
      }
      alert(msg);
    }
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Bitte eine Audio-Datei wählen (MP3, WAV, OGG, M4A, FLAC)');
      return;
    }

    this.stopAudio();

    try {
      this.updateStatus('Datei wird geladen...', 'loading');

      // Ensure AudioContext is ready
      await this.ensureAudioContextResumed();

      const arrayBuffer = await file.arrayBuffer();
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await this.audioContext.resume(); // Explicit resume
      
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      this.source = this.audioContext.createBufferSource();
      this.source.buffer = audioBuffer;
      this.source.loop = true;

      await this.initAudioContextFromSource(this.source);

      // For file playback: connect source to destination for audio output
      this.source.connect(this.audioContext.destination);

      this.source.start(0);
      this.isRunning = true;

      this.updateStatus(`Wiedergabe: ${file.name}`, 'active');
      
      const micBtn = document.getElementById('micBtn');
      if (micBtn) {
        micBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
          <span>Wiedergabe stoppen
        `;
        micBtn.onclick = () => this.stopAudio();
        micBtn.classList.add('active');
      }

      this.showAudioInfo(file, audioBuffer);
      this.showVisualizer();
      this.startVisualization();

    } catch (err) {
      console.error('File upload error:', err);
      this.updateStatus('Fehler beim Laden', 'error');
      alert('Fehler beim Laden der Audio-Datei.');
    }
  }

  async initAudioContext(stream) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // CRITICAL: Resume AudioContext immediately
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = this.smoothing;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;

    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.smoothedData = new Float32Array(this.bufferLength);
    this.prevData = new Uint8Array(this.bufferLength);

    if (stream) {
      this.source = this.audioContext.createMediaStreamSource(stream);
    }
    this.source.connect(this.analyser);
    // NOTE: analyser NOT connected to destination - prevents feedback loop
    // Visualization only needs frequency data, not audio output
  }

  async initAudioContextFromSource(source) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // CRITICAL: Resume AudioContext immediately
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = this.smoothing;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;

    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.smoothedData = new Float32Array(this.bufferLength);
    this.prevData = new Uint8Array(this.bufferLength);

    source.connect(this.analyser);
    // NOTE: analyser NOT connected to destination - prevents feedback loop
    // For file playback, source is already connected to destination via audio element
    // Visualization only needs frequency data
  }

  stopAudio() {
    this.logDebug('Audio', { action: 'stop' });
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.source) {
      this.source.onended = null;
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.isRunning = false;

    this.updateStatus('Gestoppt', 'inactive');
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
      micBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-6-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
        </svg>
        <span>Mikrofon starten
      `;
      micBtn.onclick = () => this.startMicrophone();
      micBtn.classList.remove('active');
    }
    document.getElementById('audioInfo').hidden = true;
    document.getElementById('frequencyLegend').hidden = true;

    // Show overlay again
    const overlay = document.getElementById('canvasOverlay');
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.remove('hidden');
    }

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.drawIdle();
  }

  startVisualization() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.isRunning = true;
    this._animateLogged = false; // Reset for new session
    this._drawLogged = false; // Reset for new session
    this.logDebug('startVisualization', { action: 'called' });
    this.animate();
  }

  animate() {
    // Robust check
    if (!this.isRunning || !this.analyser || !this.audioContext) {
      this.logDebug('animate', { action: 'stopped', reason: 'not_running_or_missing_context' });
      this.animationId = null;
      return;
    }

    // Log on first frame
    if (!this._animateLogged) {
      this._animateLogged = true;
      this.logDebug('animate', { action: 'started', mode: this.mode, bufferLength: this.bufferLength });
    }

    // Check AudioContext state
    if (this.audioContext.state !== 'running') {
      this.logDebug('animate', { action: 'audioContext_not_running', state: this.audioContext.state });
      console.warn('AudioContext not running, state:', this.audioContext.state);
      // Try to resume (non-blocking)
      this.audioContext.resume().catch(console.error);
    }

    try {
      this.analyser.getByteFrequencyData(this.dataArray);

      // Apply smoothing with safety checks
      if (this.smoothedData && this.dataArray && this.bufferLength) {
        for (let i = 0; i < this.bufferLength; i++) {
          this.smoothedData[i] = this.smoothedData[i] * this.smoothing + this.dataArray[i] * (1 - this.smoothing);
        }
      }

      this.drawVisualizer();
      this.updateAudioInfo();

    } catch (e) {
      this.logDebug('animate', { action: 'error', error: e.message });
      console.error('Error in animate loop:', e);
      // Don't stop the loop, just log and continue
    }

    if (this.isRunning) {
      this.animationId = requestAnimationFrame(() => this.animate());
    }
  }

  drawVisualizer() {
    console.log('>>> drawVisualizer CALLED');
    const ctx = this.ctx;
    if (!ctx || !this.canvas) {
      console.log('>>> drawVisualizer SKIPPED: no ctx or canvas');
      this.logDebug('drawVisualizer', { action: 'skipped', reason: 'no_ctx_or_canvas' });
      return;
    }
    
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    console.log('>>> drawVisualizer canvas:', width, height, 'radius:', radius);

    // Log on first draw
    if (!this._drawLogged) {
      this._drawLogged = true;
      this.logDebug('drawVisualizer', { action: 'started', width, height, radius, mode: this.mode, hasData: !!this.smoothedData });
    }

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    const scheme = this.colorSchemes[this.colorScheme];
    ctx.fillStyle = scheme.background;
    ctx.fillRect(0, 0, width, height);

    // Get frequency data (use smoothed)
    const data = this.smoothedData;
    const bufferLength = this.bufferLength;

    // Map frequency data to our needs
    const maxFreq = this.analyser?.frequencyBinCount || bufferLength;
    const nyquist = this.audioContext?.sampleRate / 2 || 24000;

    try {
      switch (this.mode) {
        case 'circular':
          this.drawCircularVisualizer(ctx, centerX, centerY, radius, data, scheme);
          break;
        case 'bars':
          this.drawBarsVisualizer(ctx, centerX, centerY, radius, data, scheme);
          break;
        case 'wave':
          this.drawWaveVisualizer(ctx, centerX, centerY, radius, data, scheme);
          break;
        case 'particles':
          this.drawParticlesVisualizer(ctx, centerX, centerY, radius, data, scheme);
          break;
      }
      console.log('>>> drawVisualizer mode rendered:', this.mode);
    } catch (e) {
      console.log('>>> drawVisualizer ERROR:', e);
      this.logDebug('drawVisualizer', { action: 'error', error: e.message });
      console.error('Error in drawVisualizer:', e);
    }

    // Draw center info
    this.drawCenterInfo(ctx, centerX, centerY, scheme);
  }

  drawCircularVisualizer(ctx, cx, cy, radius, data, scheme) {
    if (!ctx || !data) return;
    
    const numBars = 128;
    const slice = Math.PI * 2 / numBars;
    const maxRadius = radius;

    // Get frequency range we care about (up to ~8kHz)
    const maxFreqIndex = Math.floor((8000 / (this.audioContext?.sampleRate / 2 || 12000)) * this.bufferLength);
    const step = Math.max(1, Math.floor(maxFreqIndex / numBars));

    // Draw multiple rings for depth
    for (let ring = 0; ring < 3; ring++) {
      const ringOffset = ring * 30;
      const ringRadius = Math.max(20, radius - ring * 50);

      ctx.beginPath();
      for (let i = 0; i < numBars; i++) {
        const dataIndex = Math.min(i * step, maxFreqIndex - 1);
        const value = (data[dataIndex] || 0) / 255 * this.sensitivity;
        const barHeight = value * (radius * 0.6);
        const angle = i * slice - Math.PI / 2;
        const r = ringRadius + barHeight;

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Gradient stroke
      const gradient = ctx.createRadialGradient(cx, cy, ringRadius * 0.5, cx, cy, ringRadius + radius * 0.6);
      const hue = this.getHueForScheme(scheme, ring);
      gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.3)`);
      gradient.addColorStop(0.5, `hsla(${hue}, 100%, 50%, 0.6)`);
      gradient.addColorStop(1, `hsla(${(hue + 60) % 360}, 100%, 70%, 0.2)`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3 - ring;
      ctx.shadowColor = scheme.glow;
      ctx.shadowBlur = 15 - ring * 5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Inner glow circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.15, 0, Math.PI * 2);
    const innerGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.15);
    innerGradient.addColorStop(0, scheme.primary);
    innerGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = innerGradient;
    ctx.fill();
    ctx.shadowColor = scheme.glow;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawBarsVisualizer(ctx, cx, cy, radius, data, scheme) {
    if (!ctx || !data) return;
    
    const numBars = 80;
    const maxFreqIndex = Math.floor((8000 / (this.audioContext?.sampleRate / 2 || 12000)) * this.bufferLength);
    const step = Math.max(1, Math.floor(maxFreqIndex / numBars));
    const barWidth = (radius * 2) / numBars * 0.8;
    const gap = (radius * 2) / numBars * 0.2;
    const startX = cx - radius;

    for (let i = 0; i < numBars; i++) {
      const dataIndex = Math.min(i * step, maxFreqIndex - 1);
      const value = (data[dataIndex] || 0) / 255 * this.sensitivity;
      const barHeight = Math.max(2, value * radius * 1.5);
      const x = startX + i * (barWidth + gap) + barWidth / 2;
      const baseY = cy;

      // Gradient for each bar
      const gradient = ctx.createLinearGradient(x, baseY, x, baseY - barHeight);
      const progress = i / numBars;
      const hue = (progress * 240 + 200) % 360; // Blue to purple range
      gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.9)`);
      gradient.addColorStop(0.5, `hsla(${(hue + 30) % 360}, 100%, 50%, 0.7)`);
      gradient.addColorStop(1, `hsla(${(hue + 60) % 360}, 100%, 40%, 0.3)`);

      ctx.fillStyle = gradient;
      ctx.shadowColor = scheme.glow;
      ctx.shadowBlur = 10;

      // Draw bar with rounded top
      const barX = x - barWidth / 2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(barX, baseY - barHeight, barWidth, barHeight, barWidth / 2);
      } else {
        // Fallback for older browsers
        ctx.rect(barX, baseY - barHeight, barWidth, barHeight);
      }
      ctx.fill();

      // Mirror below center (subtle)
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(barX, baseY, barWidth, barHeight * 0.5, barWidth / 2);
      } else {
        ctx.rect(barX, baseY, barWidth, barHeight * 0.5);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;
  }

  drawWaveVisualizer(ctx, cx, cy, radius, data, scheme) {
    if (!ctx || !data) return;
    
    const numPoints = 256;
    const maxFreqIndex = Math.floor((8000 / (this.audioContext?.sampleRate / 2 || 12000)) * this.bufferLength);
    const step = Math.max(1, Math.floor(maxFreqIndex / numPoints));
    const width = radius * 2;

    // Draw multiple wave layers
    for (let layer = 0; layer < 4; layer++) {
      ctx.beginPath();
      const amplitude = radius * (0.3 + layer * 0.15);
      const offset = (layer - 1.5) * 30;

      for (let i = 0; i <= numPoints; i++) {
        const dataIndex = Math.min(i * step, maxFreqIndex - 1);
        const value = (data[dataIndex] || 0) / 255 * this.sensitivity;
        const x = cx - radius + (i / numPoints) * width;
        const y = cy + offset + Math.sin(i * 0.1 + Date.now() * 0.002) * 10 + value * amplitude * Math.sin(i * 0.05);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const gradient = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
      const hue = (200 + layer * 40) % 360;
      gradient.addColorStop(0, `hsla(${hue}, 100%, 50%, ${0.4 - layer * 0.08})`);
      gradient.addColorStop(0.5, `hsla(${(hue + 60) % 360}, 100%, 60%, ${0.6 - layer * 0.1})`);
      gradient.addColorStop(1, `hsla(${hue}, 100%, 50%, ${0.4 - layer * 0.08})`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3 - layer * 0.5;
      ctx.shadowColor = scheme.glow;
      ctx.shadowBlur = 10;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  drawParticlesVisualizer(ctx, cx, cy, radius, data, scheme) {
    if (!ctx || !data) return;
    
    const numParticles = 100;
    const maxFreqIndex = Math.floor((8000 / (this.audioContext?.sampleRate / 2 || 12000)) * this.bufferLength);

    if (!this.particles) {
      this.particles = [];
      for (let i = 0; i < numParticles; i++) {
        this.particles.push({
          angle: Math.random() * Math.PI * 2,
          radius: Math.random() * radius * 0.8,
          speed: 0.0005 + Math.random() * 0.002,
          size: 1 + Math.random() * 3,
          hue: Math.random() * 60 + 180,
          alpha: 0.3 + Math.random() * 0.7
        });
      }
    }

    // Update and draw particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const dataIndex = Math.min(i * Math.floor(maxFreqIndex / numParticles), maxFreqIndex - 1);
      const intensity = (data[dataIndex] || 0) / 255 * this.sensitivity;

      p.angle += p.speed * (1 + intensity * 2);
      const r = p.radius + intensity * 50;
      const x = cx + Math.cos(p.angle) * r;
      const y = cy + Math.sin(p.angle) * r;

      ctx.beginPath();
      ctx.arc(x, y, p.size * (1 + intensity), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${p.alpha * (0.5 + intensity * 0.5)})`;
      ctx.shadowColor = scheme.glow;
      ctx.shadowBlur = 10;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Center pulse
    const avgIntensity = data.slice(0, 10).reduce((a, b) => a + b, 0) / 10 / 255 * this.sensitivity;
    ctx.beginPath();
    ctx.arc(cx, cy, 10 + avgIntensity * 40, 0, Math.PI * 2);
    const pulseGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 + avgIntensity * 50);
    pulseGradient.addColorStop(0, `hsla(200, 100%, 70%, ${0.5 + avgIntensity * 0.3})`);
    pulseGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = pulseGradient;
    ctx.fill();
  }

  drawCenterInfo(ctx, cx, cy, scheme) {
    if (!ctx || !this.dataArray) return;
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < 32; i++) sum += this.dataArray[i];
    const avgVolume = sum / 32 / 255;

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    const centerGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
    centerGradient.addColorStop(0, scheme.primary + 'CC');
    centerGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = centerGradient;
    ctx.fill();
    ctx.shadowColor = scheme.glow;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Volume text
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillStyle = scheme.primary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(avgVolume * 100)}%`, cx, cy - 4);

    // dB estimate
    const db = Math.round(20 * Math.log10(avgVolume + 0.001));
    ctx.font = '10px Azeret Mono, monospace';
    ctx.fillStyle = scheme.secondary;
    ctx.fillText(`${db} dB`, cx, cy + 14);
  }

  getHueForScheme(scheme, ring) {
    const baseHues = {
      neon: [200, 180, 220],
      rainbow: [0, 120, 240],
      fire: [0, 20, 40],
      ocean: [190, 210, 170],
      matrix: [120, 140, 100]
    };
    return baseHues[this.colorScheme]?.[ring] || 200;
  }

  drawIdle() {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    const cx = width / 2;
    const cy = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Subtle animated background
    const time = Date.now() * 0.001;
    const scheme = this.colorSchemes[this.colorScheme];

    // Rotating rings
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath();
      const r = 50 + ring * 40 + Math.sin(time + ring) * 5;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `${scheme.primary}22`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Center pulse
    ctx.beginPath();
    ctx.arc(cx, cy, 15 + Math.sin(time * 2) * 5, 0, Math.PI * 2);
    const pulseGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
    pulseGradient.addColorStop(0, scheme.primary + '44');
    pulseGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = pulseGradient;
    ctx.fill();
  }

  showVisualizer() {
    console.log('>>> showVisualizer CALLED');
    this.logDebug('showVisualizer', { action: 'called' });
    const overlay = document.getElementById('canvasOverlay');
    console.log('>>> overlay element:', overlay);
    const audioInfo = document.getElementById('audioInfo');
    const freqLegend = document.getElementById('frequencyLegend');
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.add('hidden'); // Also add class for CSS
      console.log('>>> overlay.hidden = true, classList.add(hidden)');
      this.logDebug('showVisualizer', { action: 'overlay_hidden' });
    }
    if (audioInfo) audioInfo.hidden = false;
    if (freqLegend) freqLegend.hidden = false;
  }

  updateStatus(text, type) {
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    const indicator = document.getElementById('statusIndicator');

    if (statusText) statusText.textContent = text;
    if (statusDot) statusDot.className = 'status-dot';
    if (indicator) indicator.className = 'status-indicator';

    switch (type) {
      case 'active':
        if (statusDot) statusDot.classList.add('active');
        if (indicator) indicator.classList.add('active');
        break;
      case 'loading':
        if (statusDot) statusDot.classList.add('loading');
        if (indicator) indicator.classList.add('loading');
        break;
      case 'error':
        if (statusDot) statusDot.classList.add('error');
        if (indicator) indicator.classList.add('error');
        break;
      default:
        // inactive
        break;
    }
  }

  updateAudioInfo() {
    if (!this.dataArray || !this.audioContext) return;

    // Calculate metrics
    let sum = 0, peak = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      const val = this.dataArray[i] / 255;
      sum += val;
      if (val > peak) peak = val;
    }
    const avg = sum / this.bufferLength;
    const volumePercent = Math.round(avg * 100 * this.sensitivity);
    const peakPercent = Math.round(peak * 100 * this.sensitivity);

    // Update UI
    const volOut = document.getElementById('volumeOutput');
    const meterFill = document.getElementById('meterFill');
    const peakInfo = document.getElementById('peakInfo');
    if (volOut) volOut.textContent = `${volumePercent}%`;
    if (meterFill) meterFill.style.width = `${Math.min(100, volumePercent)}%`;
    if (peakInfo) peakInfo.textContent = `${peakPercent}%`;

    // Frequency band levels
    const bands = document.querySelectorAll('.legend-bar');
    this.frequencyBands.forEach((band, index) => {
      const minIdx = Math.floor((band.min / (this.audioContext?.sampleRate / 2 || 12000)) * this.bufferLength);
      const maxIdx = Math.floor((band.max / (this.audioContext?.sampleRate / 2 || 12000)) * this.bufferLength);
      let bandSum = 0;
      for (let i = minIdx; i < maxIdx && i < this.bufferLength; i++) {
        bandSum += this.dataArray[i];
      }
      const bandAvg = bandSum / (maxIdx - minIdx) / 255 * this.sensitivity;
      const bar = bands[index];
      if (bar) {
        bar.style.setProperty('--level', bandAvg);
        const colorEl = bar.querySelector('.legend-color');
        if (colorEl) colorEl.style.width = `${Math.max(8, bandAvg * 100)}px`;
      }
    });
  }

  showAudioInfo(file, audioBuffer) {
    const duration = audioBuffer.duration;
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);

    const srcInfo = document.getElementById('sourceInfo');
    const srInfo = document.getElementById('sampleRateInfo');
    const chInfo = document.getElementById('channelsInfo');
    const durInfo = document.getElementById('durationInfo');
    const audioInfo = document.getElementById('audioInfo');
    
    if (srcInfo) srcInfo.textContent = file.name;
    if (srInfo) srInfo.textContent = `${this.audioContext?.sampleRate / 1000 || 0} kHz`;
    if (chInfo) chInfo.textContent = audioBuffer.numberOfChannels;
    if (durInfo) durInfo.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    if (audioInfo) audioInfo.hidden = false;
  }

  getColorForIndex(index, total, scheme) {
    const progress = index / total;
    const hue = (progress * 240 + 200) % 360;
    return `hsl(${hue}, 100%, 50%)`;
  }

  // Debug logging
  logDebug(source, data) {
    const entry = { 
      time: new Date().toLocaleTimeString(), 
      source, 
      data 
    };
    this.debugLog.push(entry);
    if (this.debugLog.length > 100) this.debugLog.shift();
    this.renderDebug();
    console.log('DEBUG LOG:', source, data);
  }

  renderDebug() {
    if (!this.debugContent) {
      console.error('debugContent element not found!');
      return;
    }
    this.debugContent.innerHTML = this.debugLog.map(e =>
      `<div class="debug-entry"><span class="debug-time">[${e.time}]</span> <span class="debug-source">${e.source}</span> ${JSON.stringify(e.data)}</div>`
    ).join('');
    this.debugContent.scrollTop = this.debugContent.scrollHeight;
  }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.visualizer = new AudioVisualizer();
});

// Handle visibility change to pause/resume
document.addEventListener('visibilitychange', () => {
  if (window.visualizer) {
    if (document.hidden) {
      // Optional: pause visualization
    } else {
      // Resume - ensure AudioContext is resumed
      if (window.visualizer.audioContext?.state === 'suspended') {
        window.visualizer.audioContext.resume().catch(console.error);
      }
    }
  }
});
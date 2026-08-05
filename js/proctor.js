/**
 * ProctorEngine - Anti-Cheating & Integrity Shield (Mobile + Desktop Optimized)
 * Comprehensive app-switching detection via Page Visibility, Page Lifecycle,
 * Blur/Focus, Touch Shields, Haptic Alerts, and Canvas Watermarking.
 */

export class ProctorEngine {
  constructor({ studentName = 'Alex Johnson (STU-8842)', maxStrikes = 3, onViolation, onStrikeLimitExceeded }) {
    this.studentName = studentName;
    this.maxStrikes = maxStrikes;
    this.strikes = 0;
    this.isActive = false;
    this.onViolation = onViolation;
    this.onStrikeLimitExceeded = onStrikeLimitExceeded;

    this.wasAway = false;
    this.lastViolation = null;

    // Bound listeners for clean lifecycle handling
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
    this.handlePageHide = this.handlePageHide.bind(this);
    this.handlePageShow = this.handlePageShow.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleCopyPaste = this.handleCopyPaste.bind(this);
    this.handleFullscreenChange = this.handleFullscreenChange.bind(this);

    this.watermarkInterval = null;
  }

  start() {
    this.isActive = true;
    this.strikes = 0;
    this.wasAway = false;

    // Core Browser & Mobile Event Listeners
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    window.addEventListener('pagehide', this.handlePageHide);
    window.addEventListener('pageshow', this.handlePageShow);

    // Security Shields
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('copy', this.handleCopyPaste);
    document.addEventListener('paste', this.handleCopyPaste);
    document.addEventListener('cut', this.handleCopyPaste);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);

    // Initialize Canvas Watermark & Fullscreen
    this.initWatermark();
    this.enterFullscreen();
  }

  stop() {
    this.isActive = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('pagehide', this.handlePageHide);
    window.removeEventListener('pageshow', this.handlePageShow);

    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('copy', this.handleCopyPaste);
    document.removeEventListener('paste', this.handleCopyPaste);
    document.removeEventListener('cut', this.handleCopyPaste);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);

    if (this.watermarkInterval) {
      clearInterval(this.watermarkInterval);
    }
    document.body.classList.remove('screen-blurred');
  }

  enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen && !document.fullscreenElement) {
      elem.requestFullscreen().catch(() => {});
    }
  }

  handleFullscreenChange() {
    if (!this.isActive) return;
    if (!document.fullscreenElement) {
      this.recordViolation({
        type: 'FULLSCREEN_EXIT',
        severity: 'high',
        details: 'Exited Fullscreen mode.'
      });
    }
  }

  // Called when student switches app on mobile or tab on desktop
  handleVisibilityChange() {
    if (!this.isActive) return;

    if (document.hidden || document.visibilityState === 'hidden') {
      this.wasAway = true;
      document.body.classList.add('screen-blurred');
      this.recordViolation({
        type: 'APP_SWITCH',
        severity: 'high',
        details: 'Switched app or tab away from the exam screen.'
      });
    } else {
      // Returned to exam screen
      this.triggerReturnAlert();
    }
  }

  handlePageHide() {
    if (!this.isActive) return;
    this.wasAway = true;
    document.body.classList.add('screen-blurred');
    this.recordViolation({
      type: 'APP_MINIMIZED',
      severity: 'high',
      details: 'Browser minimized or sent to background.'
    });
  }

  handlePageShow() {
    if (!this.isActive) return;
    this.triggerReturnAlert();
  }

  handleWindowBlur() {
    if (!this.isActive) return;
    this.wasAway = true;
    document.body.classList.add('screen-blurred');
  }

  handleWindowFocus() {
    if (!this.isActive) return;
    this.triggerReturnAlert();
  }

  // Guaranteed Alert trigger on Return
  triggerReturnAlert() {
    document.body.classList.remove('screen-blurred');

    if (this.wasAway && this.lastViolation) {
      this.wasAway = false;

      // Mobile Haptic Vibration Alert if available
      if (navigator.vibrate) {
        try { navigator.vibrate([200, 100, 200]); } catch (e) {}
      }

      if (this.onViolation) {
        this.onViolation({
          violation: this.lastViolation,
          currentStrikes: this.strikes,
          maxStrikes: this.maxStrikes
        });
      }
    }
  }

  handleKeyDown(e) {
    if (!this.isActive) return;

    const isPrintScreen = e.key === 'PrintScreen' || e.keyCode === 44;
    const isF12 = e.key === 'F12' || e.keyCode === 123;
    const isDevTools = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j');
    const isCopy = (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C');
    const isPaste = (e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V');

    if (isPrintScreen || isF12 || isDevTools || isCopy || isPaste) {
      e.preventDefault();
      e.stopPropagation();

      let keyName = e.key;
      if (isPrintScreen) keyName = 'PrintScreen';
      else if (isDevTools) keyName = 'DevTools Shortcut';

      this.recordViolation({
        type: isPrintScreen ? 'SCREENSHOT_ATTEMPT' : 'FORBIDDEN_KEY',
        severity: 'medium',
        details: `Forbidden shortcut blocked: ${keyName}`
      });
    }
  }

  handleContextMenu(e) {
    if (!this.isActive) return;
    e.preventDefault();
    this.recordViolation({
      type: 'CONTEXT_MENU',
      severity: 'low',
      details: 'Right-click or tap-hold context menu blocked.'
    });
  }

  handleCopyPaste(e) {
    if (!this.isActive) return;
    e.preventDefault();
  }

  recordViolation({ type, severity, details }) {
    this.strikes++;

    const storageObj = window.StorageManager || (typeof StorageManager !== 'undefined' ? StorageManager : null);
    
    let violation = {
      studentName: this.studentName,
      type,
      severity,
      details,
      strikesCount: this.strikes
    };

    if (storageObj) {
      violation = storageObj.logViolation(violation);
    }

    this.lastViolation = violation;

    if (this.onViolation) {
      this.onViolation({
        violation,
        currentStrikes: this.strikes,
        maxStrikes: this.maxStrikes
      });
    }

    if (this.strikes >= this.maxStrikes) {
      if (this.onStrikeLimitExceeded) {
        this.onStrikeLimitExceeded(this.strikes);
      }
    }
  }

  initWatermark() {
    const canvas = document.getElementById('watermarkCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const updateCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.font = '600 14px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.textAlign = 'center';

      const timestamp = new Date().toLocaleTimeString();
      const text = `${this.studentName} | SECURE EXAM SESSION | ${timestamp}`;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 6);

      const stepY = 120;
      for (let y = -canvas.height; y < canvas.height; y += stepY) {
        ctx.fillText(text, 0, y);
      }
      ctx.restore();
    };

    updateCanvas();
    this.watermarkInterval = setInterval(updateCanvas, 1000);
  }
}

/**
 * ProctorGuard - Standalone Bundled Script (Mobile + Desktop Optimized)
 * Combines StorageManager, ExamTimer, ProctorEngine, and App for zero-CORS file:// compatibility.
 */

// 1. STORAGE MANAGER
const STORAGE_KEYS = {
  EXAMS: 'proctor_guard_exams',
  ACTIVE_SESSION: 'proctor_guard_active_session',
  PROCTOR_LOGS: 'proctor_guard_logs',
  SUBMISSIONS: 'proctor_guard_submissions'
};

const DEFAULT_MOCK_EXAM = {
  id: 'exam-101',
  title: 'Advanced Computer Science & Web Security Assessment',
  description: 'Official online evaluation covering Web APIs, Cyber Security, Cryptography, and System Architecture.',
  durationMinutes: 15,
  passingScore: 70,
  questions: [
    {
      id: 'q1',
      type: 'mcq',
      text: 'Which HTML5 Web API is primarily used to detect when a student switches tabs or minimizes the browser window during an online exam?',
      options: [
        'WebSockets API',
        'Page Visibility API (document.hidden & visibilitychange)',
        'Full Screen API',
        'Service Worker API'
      ],
      correctIndex: 1,
      points: 10
    },
    {
      id: 'q2',
      type: 'mcq',
      text: 'In web application proctoring, what is the primary security vulnerability of relying solely on JavaScript keydown interceptors for blocking screenshots?',
      options: [
        'OS-level screen capture tools (like Snipping Tool/Win+Shift+S) run outside the browser process and do not trigger browser keydown events.',
        'JavaScript cannot run when the mouse is moving.',
        'CSS user-select property overrides keyboard listeners.',
        'Keyboard shortcuts are handled exclusively by HTML input elements.'
      ],
      correctIndex: 0,
      points: 10
    },
    {
      id: 'q3',
      type: 'mcq',
      text: 'Which HTTP header prevents clickjacking attacks by prohibiting an exam page from being embedded inside an unauthorized iframe?',
      options: [
        'Content-Type: application/json',
        'X-Frame-Options: DENY (or SAMEORIGIN)',
        'Cache-Control: no-cache',
        'Access-Control-Allow-Origin: *'
      ],
      correctIndex: 1,
      points: 10
    },
    {
      id: 'q4',
      type: 'mcq',
      text: 'What is the purpose of applying a dynamic HTML5 Canvas watermark (containing Student ID and Timestamp) over exam questions?',
      options: [
        'To speed up rendering times of text elements.',
        'To prevent dark mode CSS themes from loading.',
        'To deter and identify physical camera photo leaks of the question paper.',
        'To automatically grade student submissions.'
      ],
      correctIndex: 2,
      points: 10
    },
    {
      id: 'q5',
      type: 'text',
      text: 'Briefly explain how the Fullscreen API combined with the blur event helps maintain academic integrity during an online test.',
      correctAnswer: 'Fullscreen mode prevents split-screen viewing, while blur event detects window focus loss to obfuscate content and flag violations.',
      points: 10
    }
  ]
};

class StorageManager {
  static initStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.EXAMS)) {
      localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify([DEFAULT_MOCK_EXAM]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROCTOR_LOGS)) {
      localStorage.setItem(STORAGE_KEYS.PROCTOR_LOGS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([]));
    }
  }

  static getExams() {
    this.initStorage();
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAMS) || '[]');
  }

  static getExamById(id) {
    const exams = this.getExams();
    return exams.find(e => e.id === id) || exams[0];
  }

  static saveActiveSession(sessionData) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(sessionData));
  }

  static getActiveSession() {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    return data ? JSON.parse(data) : null;
  }

  static clearActiveSession() {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  }

  static logViolation(violation) {
    this.initStorage();
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROCTOR_LOGS) || '[]');
    const newEntry = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      studentName: violation.studentName || 'Alex Johnson (STU-8842)',
      examId: violation.examId || 'exam-101',
      type: violation.type,
      severity: violation.severity || 'high',
      details: violation.details,
      strikesCount: violation.strikesCount || 1
    };
    logs.unshift(newEntry);
    localStorage.setItem(STORAGE_KEYS.PROCTOR_LOGS, JSON.stringify(logs));
    return newEntry;
  }

  static getProctorLogs() {
    this.initStorage();
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROCTOR_LOGS) || '[]');
  }

  static saveSubmission(submission) {
    this.initStorage();
    const submissions = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
    submissions.unshift(submission);
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
    this.clearActiveSession();
  }

  static getSubmissions() {
    this.initStorage();
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
  }
}

window.StorageManager = StorageManager;

// 2. EXAM TIMER
class ExamTimer {
  constructor({ durationMinutes, mode = 'countdown', onTick, onWarning, onExpire }) {
    this.totalSeconds = (durationMinutes || 15) * 60;
    this.remainingSeconds = this.totalSeconds;
    this.elapsedSeconds = 0;
    this.mode = mode;
    this.onTick = onTick;
    this.onWarning = onWarning;
    this.onExpire = onExpire;

    this.timerId = null;
    this.isRunning = false;
    this.warningTriggered = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timerId = setInterval(() => {
      if (this.mode === 'countdown') {
        this.remainingSeconds--;
        this.elapsedSeconds++;

        if (!this.warningTriggered && this.remainingSeconds <= this.totalSeconds * 0.2) {
          this.warningTriggered = true;
          if (this.onWarning) this.onWarning(this.remainingSeconds);
        }

        if (this.remainingSeconds <= 0) {
          this.stop();
          if (this.onExpire) this.onExpire();
        }
      } else {
        this.elapsedSeconds++;
      }

      if (this.onTick) {
        this.onTick({
          formattedTime: this.getFormattedTime(),
          remainingSeconds: this.remainingSeconds,
          elapsedSeconds: this.elapsedSeconds,
          percentageLeft: (this.remainingSeconds / this.totalSeconds) * 100
        });
      }
    }, 1000);
  }

  pause() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
  }

  stop() {
    this.pause();
  }

  getFormattedTime() {
    const target = this.mode === 'countdown' ? this.remainingSeconds : this.elapsedSeconds;
    const hrs = Math.floor(target / 3600);
    const mins = Math.floor((target % 3600) / 60);
    const secs = target % 60;

    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  toggleMode() {
    this.mode = this.mode === 'countdown' ? 'stopwatch' : 'countdown';
    return this.mode;
  }
}

// 3. PROCTOR ENGINE (Mobile + Desktop Optimized)
class ProctorEngine {
  constructor({ studentName = 'Alex Johnson (STU-8842)', maxStrikes = 3, onViolation, onStrikeLimitExceeded }) {
    this.studentName = studentName;
    this.maxStrikes = maxStrikes;
    this.strikes = 0;
    this.isActive = false;
    this.onViolation = onViolation;
    this.onStrikeLimitExceeded = onStrikeLimitExceeded;

    this.wasAway = false;
    this.lastViolation = null;

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

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    window.addEventListener('pagehide', this.handlePageHide);
    window.addEventListener('pageshow', this.handlePageShow);

    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('copy', this.handleCopyPaste);
    document.addEventListener('paste', this.handleCopyPaste);
    document.addEventListener('cut', this.handleCopyPaste);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);

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

  triggerReturnAlert() {
    document.body.classList.remove('screen-blurred');

    if (this.wasAway && this.lastViolation) {
      this.wasAway = false;

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

// 4. MAIN APP ORCHESTRATOR
class App {
  constructor() {
    this.currentExam = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.flaggedQuestions = new Set();
    this.timer = null;
    this.proctor = null;
    this.startTime = null;
    this.isExamSubmitted = false;

    this.initDOM();
    this.bindEvents();
    this.loadInitialState();
  }

  initDOM() {
    this.views = {
      onboarding: document.getElementById('viewOnboarding'),
      activeExam: document.getElementById('viewActiveExam'),
      results: document.getElementById('viewResults'),
      admin: document.getElementById('viewAdminDashboard')
    };

    this.btnStudentView = document.getElementById('btnStudentView');
    this.btnAdminView = document.getElementById('btnAdminView');
    this.securityBadge = document.getElementById('securityBadge');
    this.securityBadgeText = document.getElementById('securityBadgeText');
    this.timerContainer = document.getElementById('timerContainer');
    this.timerDisplay = document.getElementById('timerDisplay');

    this.onboardExamTitle = document.getElementById('onboardExamTitle');
    this.onboardExamDesc = document.getElementById('onboardExamDesc');
    this.btnStartExam = document.getElementById('btnStartExam');

    this.qNumberDisplay = document.getElementById('qNumberDisplay');
    this.qTextDisplay = document.getElementById('qTextDisplay');
    this.qOptionsContainer = document.getElementById('qOptionsContainer');
    this.btnPrevQ = document.getElementById('btnPrevQ');
    this.btnNextQ = document.getElementById('btnNextQ');
    this.btnFlagQuestion = document.getElementById('btnFlagQuestion');
    this.flagText = document.getElementById('flagText');
    this.flagIcon = document.getElementById('flagIcon');
    this.questionPaletteGrid = document.getElementById('questionPaletteGrid');
    this.strikeDotsContainer = document.getElementById('strikeDotsContainer');
    this.btnSubmitExamTrigger = document.getElementById('btnSubmitExamTrigger');

    this.modalViolation = document.getElementById('modalViolation');
    this.violationModalTitle = document.getElementById('violationModalTitle');
    this.violationModalDesc = document.getElementById('violationModalDesc');
    this.violationStrikeText = document.getElementById('violationStrikeText');
    this.btnDismissViolationModal = document.getElementById('btnDismissViolationModal');

    this.modalSubmitConfirm = document.getElementById('modalSubmitConfirm');
    this.submitConfirmText = document.getElementById('submitConfirmText');
    this.btnCancelSubmit = document.getElementById('btnCancelSubmit');
    this.btnConfirmSubmit = document.getElementById('btnConfirmSubmit');

    this.resultScoreNum = document.getElementById('resultScoreNum');
    this.resultScoreLabel = document.getElementById('resultScoreLabel');
    this.resultTimeSpent = document.getElementById('resultTimeSpent');
    this.resultAnsweredCount = document.getElementById('resultAnsweredCount');
    this.resultViolationsCount = document.getElementById('resultViolationsCount');
    this.btnRestartDemo = document.getElementById('btnRestartDemo');

    this.adminAuditLogBody = document.getElementById('adminAuditLogBody');
    this.btnRefreshAdminLogs = document.getElementById('btnRefreshAdminLogs');
  }

  bindEvents() {
    this.btnStudentView.addEventListener('click', () => this.switchView('onboarding'));
    this.btnAdminView.addEventListener('click', () => {
      this.switchView('admin');
      this.renderAdminAuditLogs();
    });

    this.btnStartExam.addEventListener('click', () => this.startExam());
    this.btnPrevQ.addEventListener('click', () => this.navigateQuestion(-1));
    this.btnNextQ.addEventListener('click', () => this.navigateQuestion(1));
    this.btnFlagQuestion.addEventListener('click', () => this.toggleFlagQuestion());

    this.btnSubmitExamTrigger.addEventListener('click', () => this.showSubmitModal());
    this.btnCancelSubmit.addEventListener('click', () => this.hideSubmitModal());
    this.btnConfirmSubmit.addEventListener('click', () => this.submitExam('manual'));

    this.btnDismissViolationModal.addEventListener('click', () => {
      this.modalViolation.classList.remove('active');
      if (this.proctor) this.proctor.enterFullscreen();
    });

    this.btnRestartDemo.addEventListener('click', () => {
      this.isExamSubmitted = false;
      this.switchView('onboarding');
    });

    this.btnRefreshAdminLogs.addEventListener('click', () => this.renderAdminAuditLogs());
  }

  loadInitialState() {
    StorageManager.initStorage();
    this.currentExam = StorageManager.getExams()[0];

    if (this.currentExam) {
      this.onboardExamTitle.textContent = this.currentExam.title;
      this.onboardExamDesc.textContent = this.currentExam.description;
    }
  }

  switchView(viewName) {
    Object.keys(this.views).forEach(key => {
      this.views[key].classList.remove('active');
    });

    if (viewName === 'onboarding') {
      this.views.onboarding.classList.add('active');
      this.btnStudentView.classList.add('active');
      this.btnAdminView.classList.remove('active');
      this.timerContainer.style.display = 'none';
      this.updateSecurityBadge('STANDBY', 'success');
    } else if (viewName === 'activeExam') {
      this.views.activeExam.classList.add('active');
      this.btnStudentView.classList.add('active');
      this.btnAdminView.classList.remove('active');
      this.timerContainer.style.display = 'flex';
      this.updateSecurityBadge('PROCTORING ACTIVE', 'success');
    } else if (viewName === 'results') {
      this.views.results.classList.add('active');
      this.timerContainer.style.display = 'none';
      this.updateSecurityBadge('EXAM ENDED', 'success');
    } else if (viewName === 'admin') {
      this.views.admin.classList.add('active');
      this.btnAdminView.classList.add('active');
      this.btnStudentView.classList.remove('active');
      this.timerContainer.style.display = 'none';
      this.updateSecurityBadge('ADMIN DASHBOARD', 'success');
    }
  }

  updateSecurityBadge(text, state) {
    this.securityBadgeText.textContent = text;
    this.securityBadge.className = 'security-badge';
    if (state === 'warning') this.securityBadge.classList.add('warning');
    if (state === 'danger') this.securityBadge.classList.add('danger');
  }

  startExam() {
    this.isExamSubmitted = false;
    this.userAnswers = {};
    this.flaggedQuestions.clear();
    this.currentQuestionIndex = 0;
    this.startTime = Date.now();

    this.proctor = new ProctorEngine({
      studentName: 'Alex Johnson (STU-8842)',
      maxStrikes: 3,
      onViolation: (data) => this.handleProctorViolation(data),
      onStrikeLimitExceeded: (strikes) => this.handleStrikeLimitExceeded(strikes)
    });
    this.proctor.start();

    this.timer = new ExamTimer({
      durationMinutes: this.currentExam.durationMinutes || 15,
      mode: 'countdown',
      onTick: (tickData) => this.handleTimerTick(tickData),
      onWarning: () => this.handleTimerWarning(),
      onExpire: () => this.submitExam('time_expired')
    });
    this.timer.start();

    this.switchView('activeExam');
    this.renderCurrentQuestion();
    this.renderQuestionPalette();
    this.updateStrikeDots(0);
  }

  handleTimerTick(tickData) {
    this.timerDisplay.textContent = tickData.formattedTime;
  }

  handleTimerWarning() {
    this.timerContainer.classList.add('timer-warning');
  }

  handleProctorViolation({ violation, currentStrikes, maxStrikes }) {
    this.updateStrikeDots(currentStrikes);

    if (currentStrikes >= 2) {
      this.updateSecurityBadge(`HIGH RISK (${currentStrikes}/${maxStrikes} STRIKES)`, 'danger');
    } else {
      this.updateSecurityBadge(`VIOLATION FLAGGED (${currentStrikes}/${maxStrikes})`, 'warning');
    }

    this.violationModalTitle.textContent = `PROCTORING VIOLATION (${violation.type})`;
    this.violationModalDesc.textContent = violation.details;
    this.violationStrikeText.textContent = `Strike ${currentStrikes} of ${maxStrikes}. Further violations will result in automatic exam submission.`;
    this.modalViolation.classList.add('active');
  }

  handleStrikeLimitExceeded(strikes) {
    alert('Maximum proctoring strike limit (3/3) exceeded! Your exam is being automatically submitted now.');
    this.submitExam('strike_limit_exceeded');
  }

  updateStrikeDots(count) {
    const dots = Array.from(this.strikeDotsContainer.children);
    dots.forEach((dot, idx) => {
      if (idx < count) dot.classList.add('active');
      else dot.classList.remove('active');
    });
  }

  renderCurrentQuestion() {
    const q = this.currentExam.questions[this.currentQuestionIndex];
    this.qNumberDisplay.textContent = `Question ${this.currentQuestionIndex + 1} of ${this.currentExam.questions.length}`;
    this.qTextDisplay.textContent = q.text;

    if (this.flaggedQuestions.has(q.id)) {
      this.btnFlagQuestion.classList.add('flagged');
      this.flagText.textContent = 'Flagged';
    } else {
      this.btnFlagQuestion.classList.remove('flagged');
      this.flagText.textContent = 'Flag for Review';
    }

    this.btnPrevQ.disabled = this.currentQuestionIndex === 0;
    this.btnNextQ.disabled = this.currentQuestionIndex === this.currentExam.questions.length - 1;

    this.qOptionsContainer.innerHTML = '';
    if (q.type === 'mcq') {
      q.options.forEach((optText, idx) => {
        const optionEl = document.createElement('div');
        optionEl.className = 'option-item';
        if (this.userAnswers[q.id] === idx) {
          optionEl.classList.add('selected');
        }

        const keyChar = String.fromCharCode(65 + idx);
        optionEl.innerHTML = `
          <div class="option-key">${keyChar}</div>
          <div class="option-content">${optText}</div>
        `;

        optionEl.addEventListener('click', () => {
          this.userAnswers[q.id] = idx;
          this.renderCurrentQuestion();
          this.renderQuestionPalette();
        });

        this.qOptionsContainer.appendChild(optionEl);
      });
    } else if (q.type === 'text') {
      const textarea = document.createElement('textarea');
      textarea.className = 'short-answer-input';
      textarea.placeholder = 'Type your answer here...';
      textarea.value = this.userAnswers[q.id] || '';

      textarea.addEventListener('input', (e) => {
        this.userAnswers[q.id] = e.target.value;
        this.renderQuestionPalette();
      });

      this.qOptionsContainer.appendChild(textarea);
    }
  }

  renderQuestionPalette() {
    this.questionPaletteGrid.innerHTML = '';
    this.currentExam.questions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.className = 'palette-item';
      btn.textContent = idx + 1;

      if (idx === this.currentQuestionIndex) {
        btn.classList.add('current');
      }
      if (this.userAnswers[q.id] !== undefined && this.userAnswers[q.id] !== '') {
        btn.classList.add('answered');
      }
      if (this.flaggedQuestions.has(q.id)) {
        btn.classList.add('flagged');
      }

      btn.addEventListener('click', () => {
        this.currentQuestionIndex = idx;
        this.renderCurrentQuestion();
        this.renderQuestionPalette();
      });

      this.questionPaletteGrid.appendChild(btn);
    });
  }

  navigateQuestion(direction) {
    const newIdx = this.currentQuestionIndex + direction;
    if (newIdx >= 0 && newIdx < this.currentExam.questions.length) {
      this.currentQuestionIndex = newIdx;
      this.renderCurrentQuestion();
      this.renderQuestionPalette();
    }
  }

  toggleFlagQuestion() {
    const q = this.currentExam.questions[this.currentQuestionIndex];
    if (this.flaggedQuestions.has(q.id)) {
      this.flaggedQuestions.delete(q.id);
    } else {
      this.flaggedQuestions.add(q.id);
    }
    this.renderCurrentQuestion();
    this.renderQuestionPalette();
  }

  showSubmitModal() {
    const answeredCount = Object.keys(this.userAnswers).length;
    const totalCount = this.currentExam.questions.length;
    this.submitConfirmText.textContent = `You have answered ${answeredCount} of ${totalCount} questions. Are you sure you want to finish and submit?`;
    this.modalSubmitConfirm.classList.add('active');
  }

  hideSubmitModal() {
    this.modalSubmitConfirm.classList.remove('active');
  }

  submitExam(reason = 'manual') {
    if (this.isExamSubmitted) return;
    this.isExamSubmitted = true;

    this.hideSubmitModal();
    this.modalViolation.classList.remove('active');

    if (this.proctor) this.proctor.stop();
    if (this.timer) this.timer.stop();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    let totalPoints = 0;
    let earnedPoints = 0;
    let answeredCount = 0;

    this.currentExam.questions.forEach(q => {
      totalPoints += q.points;
      const userAns = this.userAnswers[q.id];

      if (userAns !== undefined && userAns !== '') {
        answeredCount++;
        if (q.type === 'mcq' && userAns === q.correctIndex) {
          earnedPoints += q.points;
        } else if (q.type === 'text' && String(userAns).trim().length > 10) {
          earnedPoints += q.points;
        }
      }
    });

    const scorePercentage = Math.round((earnedPoints / totalPoints) * 100);
    const timeSpentSec = this.timer ? this.timer.elapsedSeconds : 0;
    const strikes = this.proctor ? this.proctor.strikes : 0;

    const submission = {
      id: 'sub-' + Date.now(),
      studentName: 'Alex Johnson (STU-8842)',
      examId: this.currentExam.id,
      timestamp: new Date().toISOString(),
      score: scorePercentage,
      earnedPoints,
      totalPoints,
      timeSpentSeconds: timeSpentSec,
      violationsCount: strikes,
      submissionReason: reason
    };
    StorageManager.saveSubmission(submission);

    this.resultScoreNum.textContent = `${scorePercentage}%`;
    this.resultScoreLabel.textContent = scorePercentage >= (this.currentExam.passingScore || 70) ? 'PASSED' : 'FAILED';
    this.resultScoreLabel.style.color = scorePercentage >= 70 ? 'var(--success)' : 'var(--danger)';
    
    const mins = Math.floor(timeSpentSec / 60);
    const secs = timeSpentSec % 60;
    this.resultTimeSpent.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.resultAnsweredCount.textContent = `${answeredCount} / ${this.currentExam.questions.length}`;
    this.resultViolationsCount.textContent = `${strikes} Strikes`;

    this.switchView('results');
  }

  renderAdminAuditLogs() {
    const logs = StorageManager.getProctorLogs();
    this.adminAuditLogBody.innerHTML = '';

    if (logs.length === 0) {
      this.adminAuditLogBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No proctoring violations recorded yet.
          </td>
        </tr>
      `;
      return;
    }

    logs.forEach(log => {
      const tr = document.createElement('tr');
      const timeStr = new Date(log.timestamp).toLocaleTimeString();
      
      let severityClass = 'low';
      if (log.severity === 'high') severityClass = 'high';
      if (log.severity === 'medium') severityClass = 'medium';

      tr.innerHTML = `
        <td>${timeStr}</td>
        <td><strong>${log.studentName}</strong></td>
        <td><code>${log.type}</code></td>
        <td><span class="tag-severity ${severityClass}">${log.severity}</span></td>
        <td>${log.details}</td>
        <td><strong style="color: var(--danger);">${log.strikesCount}</strong></td>
      `;

      this.adminAuditLogBody.appendChild(tr);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

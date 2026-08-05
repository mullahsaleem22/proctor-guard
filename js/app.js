/**
 * Main Application Orchestrator & Examiner Auth Controller
 * Integrates Exam UI, Storage Manager, AuthManager, Stopwatch/Timer Engine, and Proctor Security Engine.
 */

import { StorageManager } from './storage.js';
import { ExamTimer } from './timer.js';
import { ProctorEngine } from './proctor.js';

class AuthManager {
  static getExaminers() {
    StorageManager.initStorage();
    const defaultEx = {
      id: 'ex-001',
      name: 'Dr. Sarah Jenkins',
      email: 'examiner@futurestars.edu',
      password: 'password123',
      department: 'Computer Science & Cyber Security'
    };
    if (!localStorage.getItem('proctor_guard_examiners')) {
      localStorage.setItem('proctor_guard_examiners', JSON.stringify([defaultEx]));
    }
    return JSON.parse(localStorage.getItem('proctor_guard_examiners') || '[]');
  }

  static saveExaminers(examiners) {
    localStorage.setItem('proctor_guard_examiners', JSON.stringify(examiners));
  }

  static getCurrentUser() {
    const token = localStorage.getItem('proctor_guard_examiner_token');
    if (!token) return null;
    try {
      return JSON.parse(token).user || null;
    } catch (e) {
      return null;
    }
  }

  static login(email, password) {
    const examiners = this.getExaminers();
    const cleanEmail = email.trim().toLowerCase();
    const user = examiners.find(e => e.email.toLowerCase() === cleanEmail && e.password === password);

    if (!user) {
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    const session = {
      token: 'tok-' + Date.now(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department
      }
    };
    localStorage.setItem('proctor_guard_examiner_token', JSON.stringify(session));
    return session.user;
  }

  static signup({ name, email, department, password }) {
    const examiners = this.getExaminers();
    const cleanEmail = email.trim().toLowerCase();

    if (examiners.some(e => e.email.toLowerCase() === cleanEmail)) {
      throw new Error('An examiner account with this email address already exists.');
    }

    const newExaminer = {
      id: 'ex-' + Date.now(),
      name: name.trim(),
      email: cleanEmail,
      department: department || 'Computer Science',
      password: password
    };

    examiners.push(newExaminer);
    this.saveExaminers(examiners);

    return this.login(cleanEmail, password);
  }

  static requestPasswordResetOTP(email) {
    const examiners = this.getExaminers();
    const cleanEmail = email.trim().toLowerCase();
    const user = examiners.find(e => e.email.toLowerCase() === cleanEmail);

    if (!user) {
      throw new Error('No examiner account found with this email address.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem('proctor_reset_otp_' + cleanEmail, JSON.stringify({
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000
    }));

    return otp;
  }

  static resetPassword(email, otp, newPassword) {
    const cleanEmail = email.trim().toLowerCase();
    const storedOtpData = localStorage.getItem('proctor_reset_otp_' + cleanEmail);

    if (!storedOtpData) {
      throw new Error('Verification code has expired or is invalid. Please request a new code.');
    }

    const { otp: validOtp, expiresAt } = JSON.parse(storedOtpData);

    if (Date.now() > expiresAt) {
      localStorage.removeItem('proctor_reset_otp_' + cleanEmail);
      throw new Error('Verification code has expired. Please request a new code.');
    }

    if (otp.trim() !== validOtp) {
      throw new Error('Incorrect 6-digit security code. Please check your email.');
    }

    const examiners = this.getExaminers();
    const userIdx = examiners.findIndex(e => e.email.toLowerCase() === cleanEmail);

    if (userIdx !== -1) {
      examiners[userIdx].password = newPassword;
      this.saveExaminers(examiners);
    }
    localStorage.removeItem('proctor_reset_otp_' + cleanEmail);
    return true;
  }

  static logout() {
    localStorage.removeItem('proctor_guard_examiner_token');
  }
}

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
    this.bindAuthEvents();
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

    this.examinerProfileBadge = document.getElementById('examinerProfileBadge');
    this.examinerAvatar = document.getElementById('examinerAvatar');
    this.examinerName = document.getElementById('examinerName');
    this.btnLogoutExaminer = document.getElementById('btnLogoutExaminer');

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

    this.modalExaminerAuth = document.getElementById('modalExaminerAuth');
    this.authTitle = document.getElementById('authTitle');
    this.authSubtitle = document.getElementById('authSubtitle');
    this.authAlertBadge = document.getElementById('authAlertBadge');

    this.formExaminerLogin = document.getElementById('formExaminerLogin');
    this.loginEmail = document.getElementById('loginEmail');
    this.loginPassword = document.getElementById('loginPassword');
    this.btnToggleLoginPassword = document.getElementById('btnToggleLoginPassword');
    this.btnShowForgotPassword = document.getElementById('btnShowForgotPassword');
    this.btnShowSignup = document.getElementById('btnShowSignup');

    this.formExaminerSignup = document.getElementById('formExaminerSignup');
    this.signupName = document.getElementById('signupName');
    this.signupEmail = document.getElementById('signupEmail');
    this.signupDept = document.getElementById('signupDept');
    this.signupPassword = document.getElementById('signupPassword');
    this.signupConfirmPassword = document.getElementById('signupConfirmPassword');
    this.btnShowLoginFromSignup = document.getElementById('btnShowLoginFromSignup');

    this.formExaminerForgot = document.getElementById('formExaminerForgot');
    this.forgotEmail = document.getElementById('forgotEmail');
    this.stepResetPassword = document.getElementById('stepResetPassword');
    this.resetOtp = document.getElementById('resetOtp');
    this.newPassword = document.getElementById('newPassword');
    this.btnForgotSubmit = document.getElementById('btnForgotSubmit');
    this.btnShowLoginFromForgot = document.getElementById('btnShowLoginFromForgot');
    this.btnCloseAuthModal = document.getElementById('btnCloseAuthModal');

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
    this.btnAdminView.addEventListener('click', () => this.handleAdminDashboardAccess());

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

  bindAuthEvents() {
    this.btnToggleLoginPassword.addEventListener('click', () => {
      const type = this.loginPassword.type === 'password' ? 'text' : 'password';
      this.loginPassword.type = type;
      this.btnToggleLoginPassword.textContent = type === 'password' ? '👁️' : '🔒';
    });

    this.btnShowSignup.addEventListener('click', () => this.showAuthForm('signup'));
    this.btnShowForgotPassword.addEventListener('click', () => this.showAuthForm('forgot'));
    this.btnShowLoginFromSignup.addEventListener('click', () => this.showAuthForm('login'));
    this.btnShowLoginFromForgot.addEventListener('click', () => this.showAuthForm('login'));
    this.btnCloseAuthModal.addEventListener('click', () => this.modalExaminerAuth.classList.remove('active'));

    this.formExaminerLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const user = AuthManager.login(this.loginEmail.value, this.loginPassword.value);
        this.showAuthAlert('Login successful! Redirecting to Dashboard...', 'success');
        setTimeout(() => {
          this.modalExaminerAuth.classList.remove('active');
          this.updateExaminerProfileUI(user);
          this.switchView('admin');
          this.renderAdminAuditLogs();
        }, 800);
      } catch (err) {
        this.showAuthAlert(err.message, 'error');
      }
    });

    this.formExaminerSignup.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.signupPassword.value !== this.signupConfirmPassword.value) {
        this.showAuthAlert('Passwords do not match. Please try again.', 'error');
        return;
      }
      try {
        const user = AuthManager.signup({
          name: this.signupName.value,
          email: this.signupEmail.value,
          department: this.signupDept.value,
          password: this.signupPassword.value
        });
        this.showAuthAlert('Registration successful! Logging in...', 'success');
        setTimeout(() => {
          this.modalExaminerAuth.classList.remove('active');
          this.updateExaminerProfileUI(user);
          this.switchView('admin');
          this.renderAdminAuditLogs();
        }, 800);
      } catch (err) {
        this.showAuthAlert(err.message, 'error');
      }
    });

    let forgotStep = 1;
    this.formExaminerForgot.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        if (forgotStep === 1) {
          const otp = AuthManager.requestPasswordResetOTP(this.forgotEmail.value);
          forgotStep = 2;
          this.stepResetPassword.style.display = 'block';
          this.btnForgotSubmit.textContent = 'Reset Password';
          this.showAuthAlert(`Verification code sent! Demo OTP code is: ${otp}`, 'success');
        } else {
          AuthManager.resetPassword(this.forgotEmail.value, this.resetOtp.value, this.newPassword.value);
          this.showAuthAlert('Password successfully reset! You can now log in.', 'success');
          setTimeout(() => {
            forgotStep = 1;
            this.stepResetPassword.style.display = 'none';
            this.btnForgotSubmit.textContent = 'Send Verification Code';
            this.showAuthForm('login');
          }, 1500);
        }
      } catch (err) {
        this.showAuthAlert(err.message, 'error');
      }
    });

    this.btnLogoutExaminer.addEventListener('click', () => {
      if (confirm('Are you sure you want to log out of the Examiner Dashboard?')) {
        AuthManager.logout();
        this.updateExaminerProfileUI(null);
        this.switchView('onboarding');
      }
    });
  }

  showAuthForm(formType) {
    this.formExaminerLogin.style.display = formType === 'login' ? 'block' : 'none';
    this.formExaminerSignup.style.display = formType === 'signup' ? 'block' : 'none';
    this.formExaminerForgot.style.display = formType === 'forgot' ? 'block' : 'none';
    this.authAlertBadge.style.display = 'none';

    if (formType === 'login') {
      this.authTitle.textContent = 'Examiner Verification';
      this.authSubtitle.textContent = 'Log in with your institutional credentials to access student logs.';
    } else if (formType === 'signup') {
      this.authTitle.textContent = 'Register Examiner Account';
      this.authSubtitle.textContent = 'Create a verified faculty account to manage proctored exams.';
    } else if (formType === 'forgot') {
      this.authTitle.textContent = 'Reset Password';
      this.authSubtitle.textContent = 'Verify your email identity to set a new password.';
    }
  }

  showAuthAlert(msg, type) {
    this.authAlertBadge.textContent = msg;
    this.authAlertBadge.className = `auth-alert-badge ${type}`;
  }

  handleAdminDashboardAccess() {
    const user = AuthManager.getCurrentUser();
    if (!user) {
      this.showAuthForm('login');
      this.modalExaminerAuth.classList.add('active');
    } else {
      this.updateExaminerProfileUI(user);
      this.switchView('admin');
      this.renderAdminAuditLogs();
    }
  }

  updateExaminerProfileUI(user) {
    if (user) {
      this.examinerProfileBadge.style.display = 'flex';
      this.examinerName.textContent = user.name;

      const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      this.examinerAvatar.textContent = initials || 'EX';
    } else {
      this.examinerProfileBadge.style.display = 'none';
    }
  }

  loadInitialState() {
    StorageManager.initStorage();
    this.currentExam = StorageManager.getExams()[0];

    if (this.currentExam) {
      this.onboardExamTitle.textContent = this.currentExam.title;
      this.onboardExamDesc.textContent = this.currentExam.description;
    }

    const user = AuthManager.getCurrentUser();
    if (user) {
      this.updateExaminerProfileUI(user);
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

/**
 * Main Application Orchestrator
 * Integrates Exam UI, Storage Manager, Stopwatch/Timer Engine, and Proctor Security Engine.
 */

import { StorageManager } from './storage.js';
import { ExamTimer } from './timer.js';
import { ProctorEngine } from './proctor.js';

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
    // Views
    this.views = {
      onboarding: document.getElementById('viewOnboarding'),
      activeExam: document.getElementById('viewActiveExam'),
      results: document.getElementById('viewResults'),
      admin: document.getElementById('viewAdminDashboard')
    };

    // Header & Controls
    this.btnStudentView = document.getElementById('btnStudentView');
    this.btnAdminView = document.getElementById('btnAdminView');
    this.securityBadge = document.getElementById('securityBadge');
    this.securityBadgeText = document.getElementById('securityBadgeText');
    this.timerContainer = document.getElementById('timerContainer');
    this.timerDisplay = document.getElementById('timerDisplay');

    // Onboarding Elements
    this.onboardExamTitle = document.getElementById('onboardExamTitle');
    this.onboardExamDesc = document.getElementById('onboardExamDesc');
    this.btnStartExam = document.getElementById('btnStartExam');

    // Active Exam Elements
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

    // Modals
    this.modalViolation = document.getElementById('modalViolation');
    this.violationModalTitle = document.getElementById('violationModalTitle');
    this.violationModalDesc = document.getElementById('violationModalDesc');
    this.violationStrikeText = document.getElementById('violationStrikeText');
    this.btnDismissViolationModal = document.getElementById('btnDismissViolationModal');

    this.modalSubmitConfirm = document.getElementById('modalSubmitConfirm');
    this.submitConfirmText = document.getElementById('submitConfirmText');
    this.btnCancelSubmit = document.getElementById('btnCancelSubmit');
    this.btnConfirmSubmit = document.getElementById('btnConfirmSubmit');

    // Results Elements
    this.resultScoreNum = document.getElementById('resultScoreNum');
    this.resultScoreLabel = document.getElementById('resultScoreLabel');
    this.resultTimeSpent = document.getElementById('resultTimeSpent');
    this.resultAnsweredCount = document.getElementById('resultAnsweredCount');
    this.resultViolationsCount = document.getElementById('resultViolationsCount');
    this.btnRestartDemo = document.getElementById('btnRestartDemo');

    // Admin Elements
    this.adminAuditLogBody = document.getElementById('adminAuditLogBody');
    this.btnRefreshAdminLogs = document.getElementById('btnRefreshAdminLogs');
  }

  bindEvents() {
    // View Switches
    this.btnStudentView.addEventListener('click', () => this.switchView('onboarding'));
    this.btnAdminView.addEventListener('click', () => {
      this.switchView('admin');
      this.renderAdminAuditLogs();
    });

    // Start Exam
    this.btnStartExam.addEventListener('click', () => this.startExam());

    // Question Navigation
    this.btnPrevQ.addEventListener('click', () => this.navigateQuestion(-1));
    this.btnNextQ.addEventListener('click', () => this.navigateQuestion(1));
    this.btnFlagQuestion.addEventListener('click', () => this.toggleFlagQuestion());

    // Submit Modals
    this.btnSubmitExamTrigger.addEventListener('click', () => this.showSubmitModal());
    this.btnCancelSubmit.addEventListener('click', () => this.hideSubmitModal());
    this.btnConfirmSubmit.addEventListener('click', () => this.submitExam('manual'));

    // Violation Modal Dismissal
    this.btnDismissViolationModal.addEventListener('click', () => {
      this.modalViolation.classList.remove('active');
      if (this.proctor) this.proctor.enterFullscreen();
    });

    // Restart Demo
    this.btnRestartDemo.addEventListener('click', () => {
      this.isExamSubmitted = false;
      this.switchView('onboarding');
    });

    // Admin Refresh Logs
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

    // 1. Initialize Proctoring Engine
    this.proctor = new ProctorEngine({
      studentName: 'Alex Johnson (STU-8842)',
      maxStrikes: 3,
      onViolation: (data) => this.handleProctorViolation(data),
      onStrikeLimitExceeded: (strikes) => this.handleStrikeLimitExceeded(strikes)
    });
    this.proctor.start();

    // 2. Initialize Exam Timer (15 Min Countdown)
    this.timer = new ExamTimer({
      durationMinutes: this.currentExam.durationMinutes || 15,
      mode: 'countdown',
      onTick: (tickData) => this.handleTimerTick(tickData),
      onWarning: () => this.handleTimerWarning(),
      onExpire: () => this.submitExam('time_expired')
    });
    this.timer.start();

    // 3. Switch UI to Active Exam & render questions
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

    // Display Security Modal Alert
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

    // Flag button state
    if (this.flaggedQuestions.has(q.id)) {
      this.btnFlagQuestion.classList.add('flagged');
      this.flagText.textContent = 'Flagged';
    } else {
      this.btnFlagQuestion.classList.remove('flagged');
      this.flagText.textContent = 'Flag for Review';
    }

    // Previous / Next buttons
    this.btnPrevQ.disabled = this.currentQuestionIndex === 0;
    this.btnNextQ.disabled = this.currentQuestionIndex === this.currentExam.questions.length - 1;

    // Render Options
    this.qOptionsContainer.innerHTML = '';
    if (q.type === 'mcq') {
      q.options.forEach((optText, idx) => {
        const optionEl = document.createElement('div');
        optionEl.className = 'option-item';
        if (this.userAnswers[q.id] === idx) {
          optionEl.classList.add('selected');
        }

        const keyChar = String.fromCharCode(65 + idx); // A, B, C, D
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

    // Stop Proctoring & Timer
    if (this.proctor) this.proctor.stop();
    if (this.timer) this.timer.stop();

    // Exit Fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    // Calculate Scores
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
          earnedPoints += q.points; // Sample grading heuristic for short text
        }
      }
    });

    const scorePercentage = Math.round((earnedPoints / totalPoints) * 100);
    const timeSpentSec = this.timer ? this.timer.elapsedSeconds : 0;
    const strikes = this.proctor ? this.proctor.strikes : 0;

    // Save Submission
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

    // Update Results UI
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

// Instantiate on DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

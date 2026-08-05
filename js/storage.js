/**
 * Storage Engine - LocalStorage management for Exams, Sessions, and Proctoring Logs
 */

const STORAGE_KEYS = {
  EXAMS: 'proctor_guard_exams',
  ACTIVE_SESSION: 'proctor_guard_active_session',
  PROCTOR_LOGS: 'proctor_guard_logs',
  SUBMISSIONS: 'proctor_guard_submissions'
};

// Default Sample Mock Exam
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

export class StorageManager {
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
      type: violation.type, // TAB_SWITCH, SCREENSHOT_ATTEMPT, FULLSCREEN_EXIT, FORBIDDEN_KEY, CONTEXT_MENU
      severity: violation.severity || 'high',
      details: violation.details,
      strikesCount: violation.strikesCount || 1
    };
    logs.unshift(newEntry); // Latest first
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

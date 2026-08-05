/**
 * Timer & Stopwatch Engine
 * Tracks elapsed time, remaining duration, triggers low-time warnings, and handles auto-submission.
 */

export class ExamTimer {
  constructor({ durationMinutes, mode = 'countdown', onTick, onWarning, onExpire }) {
    this.totalSeconds = (durationMinutes || 15) * 60;
    this.remainingSeconds = this.totalSeconds;
    this.elapsedSeconds = 0;
    this.mode = mode; // 'countdown' or 'stopwatch'
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

        // Low time warning at 20% remaining
        if (!this.warningTriggered && this.remainingSeconds <= this.totalSeconds * 0.2) {
          this.warningTriggered = true;
          if (this.onWarning) this.onWarning(this.remainingSeconds);
        }

        if (this.remainingSeconds <= 0) {
          this.stop();
          if (this.onExpire) this.onExpire();
        }
      } else {
        // Stopwatch Mode
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

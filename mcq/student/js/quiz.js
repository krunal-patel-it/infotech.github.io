/**
 * Quiz engine – Subject → Unit → Session → Difficulty
 * Compatible with student app.js UI handlers.
 */
const Quiz = {
  state: null,
  timerId: null,

  // ---------- Bank ----------
  initBank() {
    let list = Storage.getQuestions() || [];
    if (list.length) return;
    const seed = [
      { qNo:1, subject:'Physics', unit:'Work, Energy & Power', session:'Session 1', question:'A body of mass 2 kg is moving with a velocity of 5 m/s. What is its kinetic energy?', optionA:'10 J', optionB:'25 J', optionC:'50 J', optionD:'100 J', correctAnswer:'B', explanation:'KE = ½mv² = 25 J', difficulty:'Medium', locked:false, timerSeconds:45 },
      { qNo:2, subject:'Physics', unit:'Laws of Motion', session:'Session 1', question:'The SI unit of force is:', optionA:'Joule', optionB:'Watt', optionC:'Newton', optionD:'Pascal', correctAnswer:'C', explanation:'Force is measured in Newton.', difficulty:'Easy', locked:false, timerSeconds:30 },
      { qNo:3, subject:'Physics', unit:'Motion in a Straight Line', session:'Session 2', question:'Which of the following is a scalar quantity?', optionA:'Velocity', optionB:'Acceleration', optionC:'Force', optionD:'Speed', correctAnswer:'D', explanation:'Speed has only magnitude.', difficulty:'Medium', locked:false, timerSeconds:45 },
      { qNo:4, subject:'Chemistry', unit:'Atomic Structure', session:'Session 1', question:'The atomic number of Carbon is:', optionA:'6', optionB:'12', optionC:'8', optionD:'14', correctAnswer:'A', explanation:'Carbon has 6 protons.', difficulty:'Easy', locked:false, timerSeconds:30 },
      { qNo:5, subject:'Chemistry', unit:'Chemical Reactions', session:'Session 2', question:'Which gas is evolved when zinc reacts with dilute H₂SO₄?', optionA:'Oxygen', optionB:'Hydrogen', optionC:'Nitrogen', optionD:'Carbon dioxide', correctAnswer:'B', explanation:'Zn + H₂SO₄ → ZnSO₄ + H₂', difficulty:'Medium', locked:false, timerSeconds:45 },
      { qNo:6, subject:'Physics', unit:'Units & Dimensions', session:'Session 3', question:'The dimensional formula of power is:', optionA:'[ML²T⁻³]', optionB:'[MLT⁻²]', optionC:'[ML²T⁻²]', optionD:'[MLT⁻¹]', correctAnswer:'A', explanation:'Power = Work/Time = [ML²T⁻³]', difficulty:'Hard', locked:false, timerSeconds:60 },
      { qNo:7, subject:'Chemistry', unit:'Equilibrium', session:'Session 3', question:'pH of a neutral solution at 25°C is:', optionA:'0', optionB:'7', optionC:'14', optionD:'1', correctAnswer:'B', explanation:'pH = 7 at 25°C.', difficulty:'Easy', locked:false, timerSeconds:30 },
      { qNo:8, subject:'Physics', unit:'Ray Optics', session:'Session 4', question:'A convex lens forms a real inverted image when object is placed:', optionA:'At focus', optionB:'Between focus and optical centre', optionC:'Beyond 2F', optionD:'At optical centre', correctAnswer:'C', explanation:'Beyond 2F → real inverted image.', difficulty:'Medium', locked:false, timerSeconds:45 }
    ];
    Storage.saveQuestions(seed);
  },

  async syncFromCloud() {
    if (typeof API === 'undefined' || !API.isEnabled()) return;
    try {
      const res = await API.getQuestions({ forStudent: '1' });
      if (res && Array.isArray(res.questions) && res.questions.length) {
        Storage.saveQuestions(res.questions);
      }
    } catch (e) {
      console.warn('Question sync failed', e);
    }
  },

  _all() {
    return (Storage.getQuestions() || []).map(q => {
      const subject = q.subject || q.category || '';
      const unit = q.unit || q.questionBank || '';
      const session = q.session || q.relevantSession || '';
      const correctAnswer = String(q.correctAnswer || q.rightAnswer || '').toUpperCase();
      return {
        ...q,
        subject, unit, session,
        correctAnswer,
        rightAnswer: correctAnswer,
        category: subject,
        questionBank: unit,
        relevantSession: session
      };
    });
  },

  getCategories() { return this.getSubjects(); },

  getSubjects() {
    return [...new Set(this._all().filter(q => !q.locked).map(q => q.subject).filter(Boolean))].sort();
  },

  getUnits(subject) {
    return [...new Set(
      this._all()
        .filter(q => !q.locked && (!subject || q.subject === subject))
        .map(q => q.unit)
        .filter(Boolean)
    )].sort();
  },

  getSessions(subject, unit) {
    return [...new Set(
      this._all()
        .filter(q => !q.locked
          && (!subject || q.subject === subject)
          && (!unit || unit === 'All' || q.unit === unit))
        .map(q => q.session)
        .filter(Boolean)
    )].sort();
  },

  getDifficulties() {
    return ['Easy', 'Medium', 'Hard', 'All'];
  },

  filterQuestions({ subject, category, unit, session, difficulty } = {}) {
    const sub = subject || category;
    return this._all().filter(q => {
      if (q.locked) return false;
      if (sub && sub !== 'All' && q.subject !== sub) return false;
      if (unit && unit !== 'All' && q.unit !== unit) return false;
      if (session && session !== 'All' && q.session !== session) return false;
      if (difficulty && difficulty !== 'All' && q.difficulty !== difficulty) return false;
      return true;
    });
  },

  countAvailable(opts) {
    return this.filterQuestions(opts).length;
  },

  // ---------- Session ----------
  start({ subject, category, unit, session, difficulty, timerSeconds, count } = {}) {
    const sub = subject || category;
    if (!sub) return { success: false, message: 'Please select a Subject.' };

    let pool = this.filterQuestions({ subject: sub, unit, session, difficulty });
    pool = pool.slice().sort(() => Math.random() - 0.5);
    const n = Math.min(Number(count) || pool.length, pool.length);
    if (n < 1) return { success: false, message: 'No questions available for the selected filters.' };

    this.state = {
      questions: pool.slice(0, n),
      index: 0,
      answers: {},       // index -> letter
      isAnswered: false,
      subject: sub,
      unit: unit || 'All',
      session: session || 'All',
      difficulty: difficulty || 'All',
      timerSeconds: Number(timerSeconds) || 45,
      startedAt: Date.now()
    };
    return { success: true, state: this.state };
  },

  getCurrentQuestion() {
    if (!this.state) return null;
    return this.state.questions[this.state.index] || null;
  },

  getProgress() {
    if (!this.state) return { current: 0, total: 0, percent: 0 };
    const total = this.state.questions.length;
    const current = this.state.index + 1;
    return { current, total, percent: total ? Math.round((current / total) * 100) : 0 };
  },

  /**
   * Record answer for current question. Returns feedback for UI.
   */
  submitAnswer(selected) {
    if (!this.state) {
      return { correct: null, isCorrect: false, explanation: '' };
    }
    this.state.isAnswered = true;
    if (selected) {
      this.state.answers[this.state.index] = selected;
    }

    const q = this.getCurrentQuestion() || {};
    const correct = String(q.correctAnswer || q.rightAnswer || '').toUpperCase();
    const isCorrect = selected && selected === correct;

    return {
      correct,
      isCorrect: !!isCorrect,
      explanation: q.explanation || 'No explanation available.',
      selected: selected || null
    };
  },

  selectAnswer(letter) {
    return this.submitAnswer(letter);
  },

  nextQuestion() {
    if (!this.state) return false;
    this.stopTimer();
    if (this.state.index < this.state.questions.length - 1) {
      this.state.index++;
      this.state.isAnswered = false;
      return true;
    }
    return false;
  },

  next() {
    return this.nextQuestion();
  },

  isLast() {
    return this.state && this.state.index >= this.state.questions.length - 1;
  },

  getResult() {
    if (!this.state) return null;
    const qs = this.state.questions;
    let correct = 0;
    const detail = qs.map((q, i) => {
      const selected = this.state.answers[i] || null;
      const right = String(q.correctAnswer || q.rightAnswer || '').toUpperCase();
      const ok = selected === right;
      if (ok) correct++;
      return {
        qNo: q.qNo,
        question: q.question,
        selected,
        rightAnswer: right,
        correct: ok,
        explanation: q.explanation || '',
        optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD
      };
    });
    const total = qs.length;
    const wrong = total - correct;
    const percentage = total ? Math.round((correct / total) * 100) : 0;
    const durationSec = Math.round((Date.now() - this.state.startedAt) / 1000);
    const now = new Date();

    return {
      subject: this.state.subject,
      unit: this.state.unit,
      session: this.state.session,
      category: this.state.subject,
      difficulty: this.state.difficulty,
      total,
      attempted: Object.keys(this.state.answers).length,
      correct,
      wrong,
      percentage,
      durationSec,
      completedAt: now.toISOString(),
      date: now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      answers: detail
    };
  },

  finish() {
    const result = this.getResult();
    this.stopTimer();
    this.state = null;
    return result;
  },

  saveResult(userEmail, result) {
    if (!result) return null;
    const cu = (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser() : null;
    const attempt = {
      id: 'att_' + Date.now(),
      email: userEmail,
      name: cu?.name || '',
      mobile: cu?.mobile || '',
      ...result
    };
    Storage.saveAttempt(userEmail, attempt);
    if (typeof API !== 'undefined' && API.isEnabled()) {
      API.saveAttempt(attempt).catch(() => {});
    }
    return attempt;
  },

  // ---------- Timer ----------
  formatTime(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
  },

  /**
   * Called as startTimer(onTick, onEnd) from app.js
   * Uses state.timerSeconds (or per-question timerSeconds).
   */
  startTimer(onTickOrSeconds, onEndOrTick, maybeOnEnd) {
    this.stopTimer();
    if (!this.state) return;

    let onTick, onEnd, seconds;
    if (typeof onTickOrSeconds === 'function') {
      // startTimer(onTick, onEnd)
      onTick = onTickOrSeconds;
      onEnd = onEndOrTick;
      const q = this.getCurrentQuestion();
      seconds = Number(q?.timerSeconds) || this.state.timerSeconds || 45;
    } else {
      // startTimer(seconds, onTick, onEnd)
      seconds = Number(onTickOrSeconds) || this.state.timerSeconds || 45;
      onTick = onEndOrTick;
      onEnd = maybeOnEnd;
    }

    let left = seconds;
    if (typeof onTick === 'function') onTick(left);

    this.timerId = setInterval(() => {
      left--;
      if (typeof onTick === 'function') onTick(left);
      if (left <= 0) {
        this.stopTimer();
        if (typeof onEnd === 'function') onEnd();
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  },

  clearTimer() {
    this.stopTimer();
  }
};

window.Quiz = Quiz;

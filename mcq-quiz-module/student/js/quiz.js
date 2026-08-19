/**
 * quiz.js
 * Quiz engine for Student Panel
 * Handles question flow, timer, scoring, and results
 */

const Quiz = {
  // Sample questions matching the Question Bank format (for MVP offline demo)
  // In production these will come from Google Sheets via Apps Script
  sampleQuestions: [
    {
      qNo: 1,
      category: "Physics",
      difficulty: "Medium",
      question: "A body of mass 2 kg is moving with a velocity of 5 m/s. What is its kinetic energy?",
      optionA: "10 J",
      optionB: "25 J",
      optionC: "50 J",
      optionD: "100 J",
      rightAnswer: "B",
      explanation: "Kinetic Energy = ½ mv² = ½ × 2 × 5² = 25 J",
      relevantSession: "Session 1 – Work, Energy & Power"
    },
    {
      qNo: 2,
      category: "Physics",
      difficulty: "Easy",
      question: "The SI unit of force is:",
      optionA: "Joule",
      optionB: "Watt",
      optionC: "Newton",
      optionD: "Pascal",
      rightAnswer: "C",
      explanation: "Force is measured in Newton (N). 1 N = 1 kg·m/s²",
      relevantSession: "Session 1 – Laws of Motion"
    },
    {
      qNo: 3,
      category: "Physics",
      difficulty: "Medium",
      question: "Which of the following is a scalar quantity?",
      optionA: "Velocity",
      optionB: "Acceleration",
      optionC: "Force",
      optionD: "Speed",
      rightAnswer: "D",
      explanation: "Speed has only magnitude, while velocity, acceleration and force are vectors.",
      relevantSession: "Session 2 – Motion in a Straight Line"
    },
    {
      qNo: 4,
      category: "Chemistry",
      difficulty: "Easy",
      question: "The atomic number of Carbon is:",
      optionA: "6",
      optionB: "12",
      optionC: "8",
      optionD: "14",
      rightAnswer: "A",
      explanation: "Carbon has 6 protons, so its atomic number is 6. Mass number is 12.",
      relevantSession: "Session 1 – Atomic Structure"
    },
    {
      qNo: 5,
      category: "Chemistry",
      difficulty: "Medium",
      question: "Which gas is evolved when zinc reacts with dilute H₂SO₄?",
      optionA: "Oxygen",
      optionB: "Hydrogen",
      optionC: "Nitrogen",
      optionD: "Carbon dioxide",
      rightAnswer: "B",
      explanation: "Zn + H₂SO₄ → ZnSO₄ + H₂↑. Hydrogen gas is liberated.",
      relevantSession: "Session 2 – Chemical Reactions"
    },
    {
      qNo: 6,
      category: "Physics",
      difficulty: "Hard",
      question: "The dimensional formula of power is:",
      optionA: "[ML²T⁻³]",
      optionB: "[MLT⁻²]",
      optionC: "[ML²T⁻²]",
      optionD: "[MLT⁻¹]",
      rightAnswer: "A",
      explanation: "Power = Work/Time = (Force × Displacement)/Time = [MLT⁻²][L]/[T] = [ML²T⁻³]",
      relevantSession: "Session 3 – Units & Dimensions"
    },
    {
      qNo: 7,
      category: "Chemistry",
      difficulty: "Easy",
      question: "pH of a neutral solution at 25°C is:",
      optionA: "0",
      optionB: "7",
      optionC: "14",
      optionD: "1",
      rightAnswer: "B",
      explanation: "At 25°C, pure water has [H⁺] = 10⁻⁷ mol/L, so pH = 7.",
      relevantSession: "Session 3 – Equilibrium"
    },
    {
      qNo: 8,
      category: "Physics",
      difficulty: "Medium",
      question: "A convex lens forms a real inverted image when object is placed:",
      optionA: "At focus",
      optionB: "Between focus and optical centre",
      optionC: "Beyond 2F",
      optionD: "At optical centre",
      rightAnswer: "C",
      explanation: "When object is beyond 2F, convex lens forms a real, inverted and diminished image between F and 2F.",
      relevantSession: "Session 4 – Ray Optics"
    }
  ],

  // Live question bank (from Google Sheets cache or sample)
  bank: [],

  // Current quiz state
  state: {
    questions: [],
    currentIndex: 0,
    answers: [],
    timerSeconds: 60,
    timerInterval: null,
    timeLeft: 0,
    startTime: null,
    category: '',
    session: '',
    difficulty: '',
    isAnswered: false
  },

  /**
   * Load questions: prefer localStorage cache, then sample, then try cloud
   */
  initBank() {
    const cached = Storage.get('mcq_questions');
    if (cached && Array.isArray(cached) && cached.length > 0) {
      this.bank = cached.filter(q => !q.locked);
    } else {
      this.bank = [...this.sampleQuestions];
    }
    this.syncFromCloud();
  },

  async syncFromCloud() {
    if (typeof API === 'undefined' || !API.isEnabled()) return false;
    try {
      const res = await API.getQuestions();
      if (res && res.questions && res.questions.length > 0) {
        Storage.set('mcq_questions', res.questions);
        this.bank = res.questions.filter(q => !q.locked);
        console.log('Student: synced', this.bank.length, 'questions from Sheets');
        return true;
      }
    } catch (e) {
      console.warn('Student question sync failed', e);
    }
    return false;
  },

  _pool() {
    return (this.bank && this.bank.length) ? this.bank : this.sampleQuestions;
  },

  getCategories() {
    return [...new Set(this._pool().map(q => q.category).filter(Boolean))];
  },

  getSessions(category) {
    const sessions = this._pool()
      .filter(q => !category || q.category === category)
      .map(q => q.relevantSession);
    return [...new Set(sessions.filter(Boolean))];
  },

  getDifficulties() {
    return ['Easy', 'Medium', 'Hard', 'All'];
  },

  countAvailable({ category, session, difficulty }) {
    let pool = [...this._pool()];
    if (category && category !== 'All') {
      pool = pool.filter(q => q.category === category);
    }
    if (session && session !== 'All') {
      pool = pool.filter(q => q.relevantSession === session);
    }
    if (difficulty && difficulty !== 'All') {
      pool = pool.filter(q => q.difficulty === difficulty);
    }
    return pool.length;
  },

  // Start a new quiz
  start({ category, session, difficulty, timerSeconds, count = 5 }) {
    let pool = [...this._pool()];

    if (category && category !== 'All') {
      pool = pool.filter(q => q.category === category);
    }
    if (session && session !== 'All') {
      pool = pool.filter(q => q.relevantSession === session);
    }
    if (difficulty && difficulty !== 'All') {
      pool = pool.filter(q => q.difficulty === difficulty);
    }

    // Shuffle and take required count
    pool = this._shuffle(pool).slice(0, Math.min(count, pool.length));

    if (pool.length === 0) {
      return { success: false, message: 'No questions found for the selected filters.' };
    }

    this.state = {
      questions: pool,
      currentIndex: 0,
      answers: [],
      timerSeconds: timerSeconds || 60,
      timerInterval: null,
      timeLeft: timerSeconds || 60,
      startTime: new Date(),
      category: category || 'All',
      session: session || 'All',
      difficulty: difficulty || 'All',
      isAnswered: false
    };

    return { success: true, total: pool.length };
  },

  getCurrentQuestion() {
    return this.state.questions[this.state.currentIndex] || null;
  },

  getProgress() {
    return {
      current: this.state.currentIndex + 1,
      total: this.state.questions.length,
      percent: ((this.state.currentIndex) / this.state.questions.length) * 100
    };
  },

  // Start timer for current question
  startTimer(onTick, onTimeout) {
    this.stopTimer();
    this.state.timeLeft = this.state.timerSeconds;
    this.state.isAnswered = false;

    onTick(this.state.timeLeft);

    this.state.timerInterval = setInterval(() => {
      this.state.timeLeft--;
      onTick(this.state.timeLeft);

      if (this.state.timeLeft <= 0) {
        this.stopTimer();
        onTimeout();
      }
    }, 1000);
  },

  stopTimer() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
  },

  // Submit answer for current question
  submitAnswer(selectedOption) {
    if (this.state.isAnswered) return null;

    this.stopTimer();
    this.state.isAnswered = true;

    const q = this.getCurrentQuestion();
    const isCorrect = selectedOption === q.rightAnswer;
    const timeTaken = this.state.timerSeconds - this.state.timeLeft;

    const answerRecord = {
      qNo: q.qNo,
      selected: selectedOption,
      correct: q.rightAnswer,
      isCorrect,
      timeTaken,
      explanation: q.explanation
    };

    this.state.answers.push(answerRecord);
    return answerRecord;
  },

  // Move to next question
  nextQuestion() {
    if (this.state.currentIndex < this.state.questions.length - 1) {
      this.state.currentIndex++;
      this.state.isAnswered = false;
      return true;
    }
    return false; // quiz finished
  },

  // Calculate final result
  getResult() {
    const total = this.state.questions.length;
    const attempted = this.state.answers.length;
    const correct = this.state.answers.filter(a => a.isCorrect).length;
    const wrong = attempted - correct;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    const endTime = new Date();
    const durationMs = endTime - this.state.startTime;
    const durationSec = Math.round(durationMs / 1000);

    return {
      total,
      attempted,
      correct,
      wrong,
      percentage,
      durationSec,
      category: this.state.category,
      session: this.state.session,
      difficulty: this.state.difficulty,
      answers: this.state.answers,
      completedAt: endTime.toISOString()
    };
  },

  // Save result to storage (+ Google Sheets when online)
  saveResult(userEmail, result) {
    const attempt = {
      id: 'att_' + Date.now(),
      email: userEmail,
      ...result,
      date: new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      }),
      time: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true
      })
    };
    Storage.saveAttempt(userEmail, attempt);
    if (typeof API !== 'undefined' && API.isEnabled()) {
      API.saveAttempt(attempt).catch(() => {});
    }
    return attempt;
  },

  // Utility
  _shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
};

window.Quiz = Quiz;

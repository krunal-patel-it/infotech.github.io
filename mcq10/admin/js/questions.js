/**
 * Question Bank – format:
 * Subject, Unit, Session, Question, Option A–D, Correct Answer, Explanation, Difficulty
 */
const Questions = {
  seedData: [
    {
      qNo: 1, subject: 'Physics', unit: 'Work, Energy & Power', session: 'Session 1',
      question: 'A body of mass 2 kg is moving with a velocity of 5 m/s. What is its kinetic energy?',
      optionA: '10 J', optionB: '25 J', optionC: '50 J', optionD: '100 J',
      correctAnswer: 'B', explanation: 'KE = ½mv² = ½×2×25 = 25 J', difficulty: 'Medium',
      locked: false, timerSeconds: 45
    },
    {
      qNo: 2, subject: 'Physics', unit: 'Laws of Motion', session: 'Session 1',
      question: 'The SI unit of force is:',
      optionA: 'Joule', optionB: 'Watt', optionC: 'Newton', optionD: 'Pascal',
      correctAnswer: 'C', explanation: 'Force is measured in Newton (N).', difficulty: 'Easy',
      locked: false, timerSeconds: 30
    },
    {
      qNo: 3, subject: 'Physics', unit: 'Motion in a Straight Line', session: 'Session 2',
      question: 'Which of the following is a scalar quantity?',
      optionA: 'Velocity', optionB: 'Acceleration', optionC: 'Force', optionD: 'Speed',
      correctAnswer: 'D', explanation: 'Speed has only magnitude.', difficulty: 'Medium',
      locked: false, timerSeconds: 45
    },
    {
      qNo: 4, subject: 'Chemistry', unit: 'Atomic Structure', session: 'Session 1',
      question: 'The atomic number of Carbon is:',
      optionA: '6', optionB: '12', optionC: '8', optionD: '14',
      correctAnswer: 'A', explanation: 'Carbon has 6 protons.', difficulty: 'Easy',
      locked: false, timerSeconds: 30
    },
    {
      qNo: 5, subject: 'Chemistry', unit: 'Chemical Reactions', session: 'Session 2',
      question: 'Which gas is evolved when zinc reacts with dilute H₂SO₄?',
      optionA: 'Oxygen', optionB: 'Hydrogen', optionC: 'Nitrogen', optionD: 'Carbon dioxide',
      correctAnswer: 'B', explanation: 'Zn + H₂SO₄ → ZnSO₄ + H₂↑', difficulty: 'Medium',
      locked: false, timerSeconds: 45
    },
    {
      qNo: 6, subject: 'Physics', unit: 'Units & Dimensions', session: 'Session 3',
      question: 'The dimensional formula of power is:',
      optionA: '[ML²T⁻³]', optionB: '[MLT⁻²]', optionC: '[ML²T⁻²]', optionD: '[MLT⁻¹]',
      correctAnswer: 'A', explanation: 'Power = Work/Time = [ML²T⁻³]', difficulty: 'Hard',
      locked: false, timerSeconds: 60
    },
    {
      qNo: 7, subject: 'Chemistry', unit: 'Equilibrium', session: 'Session 3',
      question: 'pH of a neutral solution at 25°C is:',
      optionA: '0', optionB: '7', optionC: '14', optionD: '1',
      correctAnswer: 'B', explanation: 'pH = 7 for neutral solution at 25°C.', difficulty: 'Easy',
      locked: false, timerSeconds: 30
    },
    {
      qNo: 8, subject: 'Physics', unit: 'Ray Optics', session: 'Session 4',
      question: 'A convex lens forms a real inverted image when object is placed:',
      optionA: 'At focus', optionB: 'Between focus and optical centre', optionC: 'Beyond 2F', optionD: 'At optical centre',
      correctAnswer: 'C', explanation: 'Object beyond 2F → real, inverted image between F and 2F.', difficulty: 'Medium',
      locked: false, timerSeconds: 45
    }
  ],

  /** Normalize any question object to the new field names */
  normalize(q) {
    if (!q) return q;
    const subject = q.subject || q.category || '';
    const unit = q.unit || q.questionBank || '';
    const session = q.session || q.relevantSession || '';
    const correctAnswer = (q.correctAnswer || q.rightAnswer || '').toString().toUpperCase();
    return {
      ...q,
      subject,
      unit,
      session,
      correctAnswer,
      rightAnswer: correctAnswer,
      category: subject,
      questionBank: unit,
      relevantSession: session,
      difficulty: q.difficulty || 'Medium',
      locked: !!q.locked,
      timerSeconds: Number(q.timerSeconds) || 45
    };
  },

  init() {
    let list = Storage.getQuestions();
    if (!list || !list.length) {
      list = this.seedData.map(q => this.normalize(q));
      Storage.saveQuestions(list);
    } else {
      list = list.map(q => this.normalize(q));
      Storage.saveQuestions(list);
    }
  },

  getAll() {
    return (Storage.getQuestions() || []).map(q => this.normalize(q));
  },

  getById(qNo) {
    return this.getAll().find(q => Number(q.qNo) === Number(qNo));
  },

  saveAll(list) {
    Storage.saveQuestions(list.map(q => this.normalize(q)));
  },

  add(q) {
    const list = this.getAll();
    const maxNo = list.reduce((m, x) => Math.max(m, Number(x.qNo) || 0), 0);
    const item = this.normalize({ ...q, qNo: q.qNo || maxNo + 1 });
    list.push(item);
    this.saveAll(list);
    if (typeof API !== 'undefined' && API.isEnabled()) {
      API.addQuestion(item).catch(() => {});
    }
    return item;
  },

  update(qNo, data) {
    const list = this.getAll();
    const idx = list.findIndex(q => Number(q.qNo) === Number(qNo));
    if (idx < 0) return null;
    const item = this.normalize({ ...list[idx], ...data, qNo: Number(qNo) });
    list[idx] = item;
    this.saveAll(list);
    if (typeof API !== 'undefined' && API.isEnabled()) {
      API.updateQuestion(item).catch(() => {});
    }
    return item;
  },

  remove(qNo) {
    const list = this.getAll().filter(q => Number(q.qNo) !== Number(qNo));
    this.saveAll(list);
    if (typeof API !== 'undefined' && API.isEnabled()) {
      API.deleteQuestion(qNo).catch(() => {});
    }
  },

  getSubjects() {
    return [...new Set(this.getAll().map(q => q.subject).filter(Boolean))].sort();
  },

  getUnits(subject) {
    return [...new Set(
      this.getAll()
        .filter(q => !subject || q.subject === subject)
        .map(q => q.unit)
        .filter(Boolean)
    )].sort();
  },

  getSessions(subject, unit) {
    return [...new Set(
      this.getAll()
        .filter(q => (!subject || q.subject === subject) && (!unit || unit === 'All' || q.unit === unit))
        .map(q => q.session)
        .filter(Boolean)
    )].sort();
  },

  filter({ subject, unit, session, difficulty } = {}) {
    return this.getAll().filter(q => {
      if (q.locked) return false;
      if (subject && subject !== 'All' && q.subject !== subject) return false;
      if (unit && unit !== 'All' && q.unit !== unit) return false;
      if (session && session !== 'All' && q.session !== session) return false;
      if (difficulty && difficulty !== 'All' && q.difficulty !== difficulty) return false;
      return true;
    });
  },

  async syncFromCloud() {
    if (typeof API === 'undefined' || !API.isEnabled()) return;
    const res = await API.getQuestions();
    if (res && Array.isArray(res.questions)) {
      this.saveAll(res.questions.map(q => this.normalize(q)));
    }
  },

  async pushAllToCloud() {
    if (typeof API === 'undefined' || !API.isEnabled()) return { ok: false };
    const list = this.getAll();
    const res = await API.bulkAddQuestions(list);
    return res;
  }
};

// bootstrap when script loads
if (typeof Storage !== 'undefined') {
  try { Questions.init(); } catch (e) {}
}

/**
 * questions.js
 * Question Bank management + seed data matching the required format
 */

const Questions = {
  // Seed data matching the exact Question Bank columns
  seedData: [
    {
      qNo: 1,
      questionBank: "NEET 2025",
      category: "Physics",
      difficulty: "Medium",
      question: "A body of mass 2 kg is moving with a velocity of 5 m/s. What is its kinetic energy?",
      optionA: "10 J",
      optionB: "25 J",
      optionC: "50 J",
      optionD: "100 J",
      rightAnswer: "B",
      explanation: "Kinetic Energy = ½ mv² = ½ × 2 × 5² = 25 J",
      previousBoardExam: "No",
      pyqSource: "",
      year: "",
      pyqStatus: "",
      verificationNote: "Verified",
      relevantSession: "Session 1 – Work, Energy & Power",
      locked: false,
      timerSeconds: 45
    },
    {
      qNo: 2,
      questionBank: "NEET 2025",
      category: "Physics",
      difficulty: "Easy",
      question: "The SI unit of force is:",
      optionA: "Joule",
      optionB: "Watt",
      optionC: "Newton",
      optionD: "Pascal",
      rightAnswer: "C",
      explanation: "Force is measured in Newton (N). 1 N = 1 kg·m/s²",
      previousBoardExam: "Yes",
      pyqSource: "CBSE",
      year: "2023",
      pyqStatus: "Confirmed",
      verificationNote: "",
      relevantSession: "Session 1 – Laws of Motion",
      locked: false,
      timerSeconds: 30
    },
    {
      qNo: 3,
      questionBank: "NEET 2025",
      category: "Physics",
      difficulty: "Medium",
      question: "Which of the following is a scalar quantity?",
      optionA: "Velocity",
      optionB: "Acceleration",
      optionC: "Force",
      optionD: "Speed",
      rightAnswer: "D",
      explanation: "Speed has only magnitude, while velocity, acceleration and force are vectors.",
      previousBoardExam: "No",
      pyqSource: "",
      year: "",
      pyqStatus: "",
      verificationNote: "",
      relevantSession: "Session 2 – Motion in a Straight Line",
      locked: false,
      timerSeconds: 45
    },
    {
      qNo: 4,
      questionBank: "NEET 2025",
      category: "Chemistry",
      difficulty: "Easy",
      question: "The atomic number of Carbon is:",
      optionA: "6",
      optionB: "12",
      optionC: "8",
      optionD: "14",
      rightAnswer: "A",
      explanation: "Carbon has 6 protons, so its atomic number is 6. Mass number is 12.",
      previousBoardExam: "Yes",
      pyqSource: "NCERT",
      year: "2022",
      pyqStatus: "Confirmed",
      verificationNote: "",
      relevantSession: "Session 1 – Atomic Structure",
      locked: false,
      timerSeconds: 30
    },
    {
      qNo: 5,
      questionBank: "NEET 2025",
      category: "Chemistry",
      difficulty: "Medium",
      question: "Which gas is evolved when zinc reacts with dilute H₂SO₄?",
      optionA: "Oxygen",
      optionB: "Hydrogen",
      optionC: "Nitrogen",
      optionD: "Carbon dioxide",
      rightAnswer: "B",
      explanation: "Zn + H₂SO₄ → ZnSO₄ + H₂↑. Hydrogen gas is liberated.",
      previousBoardExam: "No",
      pyqSource: "",
      year: "",
      pyqStatus: "",
      verificationNote: "Lab verified",
      relevantSession: "Session 2 – Chemical Reactions",
      locked: false,
      timerSeconds: 45
    },
    {
      qNo: 6,
      questionBank: "NEET 2025",
      category: "Physics",
      difficulty: "Hard",
      question: "The dimensional formula of power is:",
      optionA: "[ML²T⁻³]",
      optionB: "[MLT⁻²]",
      optionC: "[ML²T⁻²]",
      optionD: "[MLT⁻¹]",
      rightAnswer: "A",
      explanation: "Power = Work/Time = (Force × Displacement)/Time = [MLT⁻²][L]/[T] = [ML²T⁻³]",
      previousBoardExam: "Yes",
      pyqSource: "JEE Main",
      year: "2021",
      pyqStatus: "Confirmed",
      verificationNote: "",
      relevantSession: "Session 3 – Units & Dimensions",
      locked: false,
      timerSeconds: 60
    },
    {
      qNo: 7,
      questionBank: "NEET 2025",
      category: "Chemistry",
      difficulty: "Easy",
      question: "pH of a neutral solution at 25°C is:",
      optionA: "0",
      optionB: "7",
      optionC: "14",
      optionD: "1",
      rightAnswer: "B",
      explanation: "At 25°C, pure water has [H⁺] = 10⁻⁷ mol/L, so pH = 7.",
      previousBoardExam: "Yes",
      pyqSource: "CBSE",
      year: "2024",
      pyqStatus: "Confirmed",
      verificationNote: "",
      relevantSession: "Session 3 – Equilibrium",
      locked: false,
      timerSeconds: 30
    },
    {
      qNo: 8,
      questionBank: "NEET 2025",
      category: "Physics",
      difficulty: "Medium",
      question: "A convex lens forms a real inverted image when object is placed:",
      optionA: "At focus",
      optionB: "Between focus and optical centre",
      optionC: "Beyond 2F",
      optionD: "At optical centre",
      rightAnswer: "C",
      explanation: "When object is beyond 2F, convex lens forms a real, inverted and diminished image between F and 2F.",
      previousBoardExam: "No",
      pyqSource: "",
      year: "",
      pyqStatus: "",
      verificationNote: "",
      relevantSession: "Session 4 – Ray Optics",
      locked: false,
      timerSeconds: 45
    }
  ],

  init() {
    const existing = Storage.getQuestions();
    if (!existing || existing.length === 0) {
      Storage.saveQuestions(this.seedData);
    }
    // Background sync from Google Sheets when configured
    this.syncFromCloud();
  },

  async syncFromCloud() {
    if (typeof API === 'undefined' || !API.isEnabled()) return false;
    try {
      const res = await API.getQuestions();
      if (res && res.questions && Array.isArray(res.questions) && res.questions.length > 0) {
        Storage.saveQuestions(res.questions);
        console.log('Synced', res.questions.length, 'questions from Google Sheets');
        return true;
      }
    } catch (e) {
      console.warn('Question sync failed:', e);
    }
    return false;
  },

  getAll() {
    return Storage.getQuestions() || [];
  },

  getById(qNo) {
    return this.getAll().find(q => q.qNo === Number(qNo));
  },

  getCategories() {
    return [...new Set(this.getAll().map(q => q.category).filter(Boolean))].sort();
  },

  getSessions() {
    return [...new Set(this.getAll().map(q => q.relevantSession).filter(Boolean))].sort();
  },

  add(data) {
    const q = Storage.addQuestion(data);
    if (typeof API !== 'undefined' && API.isEnabled()) {
      API.addQuestion(q).then(res => {
        if (res && res.question && res.question.qNo) {
          // Keep local qNo in sync with sheet
          Storage.updateQuestion(q.qNo, { qNo: res.question.qNo });
        }
      }).catch(() => {});
    }
    return q;
  },

  update(qNo, data) {
    const q = Storage.updateQuestion(qNo, data);
    if (q && typeof API !== 'undefined' && API.isEnabled()) {
      API.updateQuestion({ ...q, qNo }).catch(() => {});
    }
    return q;
  },

  remove(qNo) {
    Storage.deleteQuestion(qNo);
    if (typeof API !== 'undefined' && API.isEnabled()) {
      API.deleteQuestion(qNo).catch(() => {});
    }
  },

  toggleLock(qNo) {
    const q = this.getById(qNo);
    if (q) {
      return this.update(qNo, { locked: !q.locked });
    }
    return null;
  },

  async bulkAdd(list) {
    if (!list || !list.length) return { added: 0 };
    list.forEach(q => Storage.addQuestion(q));
    if (typeof API !== 'undefined' && API.isEnabled()) {
      const res = await API.bulkAddQuestions(list);
      await this.syncFromCloud();
      return res;
    }
    return { success: true, added: list.length };
  }
};

window.Questions = Questions;

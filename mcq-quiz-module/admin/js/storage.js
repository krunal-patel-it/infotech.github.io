/**
 * storage.js - Admin Panel
 * Uses same localStorage keys as Student Panel for shared data in MVP
 */

const Storage = {
  KEYS: {
    CURRENT_ADMIN: 'mcq_current_admin',
    USERS: 'mcq_users',
    ATTEMPTS: 'mcq_attempts',
    QUESTIONS: 'mcq_questions',
    SETTINGS: 'mcq_settings',
    ADMIN_LOGS: 'mcq_admin_logs'
  },

  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  // Users
  getAllUsers() {
    return this.get(this.KEYS.USERS) || [];
  },

  saveUser(user) {
    const users = this.getAllUsers();
    const idx = users.findIndex(u => u.email === user.email);
    if (idx >= 0) users[idx] = { ...users[idx], ...user };
    else users.push(user);
    this.set(this.KEYS.USERS, users);
  },

  deleteUser(email) {
    let users = this.getAllUsers().filter(u => u.email !== email);
    this.set(this.KEYS.USERS, users);
    // Also clean attempts
    const attempts = this.get(this.KEYS.ATTEMPTS) || {};
    delete attempts[email];
    this.set(this.KEYS.ATTEMPTS, attempts);
  },

  findUser(email) {
    return this.getAllUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  // Attempts
  getAllAttempts() {
    return this.get(this.KEYS.ATTEMPTS) || {};
  },

  getUserAttempts(email) {
    const all = this.getAllAttempts();
    return all[email] || [];
  },

  // Questions
  getQuestions() {
    return this.get(this.KEYS.QUESTIONS) || [];
  },

  saveQuestions(questions) {
    this.set(this.KEYS.QUESTIONS, questions);
  },

  addQuestion(q) {
    const questions = this.getQuestions();
    q.qNo = questions.length ? Math.max(...questions.map(x => x.qNo)) + 1 : 1;
    questions.push(q);
    this.saveQuestions(questions);
    return q;
  },

  updateQuestion(qNo, data) {
    const questions = this.getQuestions();
    const idx = questions.findIndex(q => q.qNo === qNo);
    if (idx >= 0) {
      questions[idx] = { ...questions[idx], ...data };
      this.saveQuestions(questions);
      return questions[idx];
    }
    return null;
  },

  deleteQuestion(qNo) {
    let questions = this.getQuestions().filter(q => q.qNo !== qNo);
    this.saveQuestions(questions);
  },

  // Settings
  getSettings() {
    return this.get(this.KEYS.SETTINGS) || {
      darkMode: false,
      timerLocked: false,
      defaultTimer: 45,
      lockAllTimers: false,
      watermarkMode: 'default',
      watermarkCustom: 'MCQ Quiz Module'
    };
  },

  saveSettings(settings) {
    this.set(this.KEYS.SETTINGS, settings);
  },

  // Theme
  applyTheme() {
    const s = this.getSettings();
    if (s.darkMode) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  },

  toggleDarkMode() {
    const s = this.getSettings();
    s.darkMode = !s.darkMode;
    this.saveSettings(s);
    this.applyTheme();
    return s.darkMode;
  },

  // Admin session
  setAdmin(admin) {
    this.set(this.KEYS.CURRENT_ADMIN, admin);
  },

  getAdmin() {
    return this.get(this.KEYS.CURRENT_ADMIN);
  },

  clearAdmin() {
    this.remove(this.KEYS.CURRENT_ADMIN);
  }
};

window.Storage = Storage;

/**
 * storage.js
 * Local storage + offline data handling for Student Panel
 * Uses localStorage for MVP (can be upgraded to IndexedDB later)
 */

const Storage = {
  // Keys
  KEYS: {
    CURRENT_USER: 'mcq_current_user',
    USERS: 'mcq_users',
    ATTEMPTS: 'mcq_attempts',
    SETTINGS: 'mcq_settings',
    OFFLINE_QUEUE: 'mcq_offline_queue',
    QUESTIONS: 'mcq_questions'
  },

  // ---------- Generic helpers ----------
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage set error:', e);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  // ---------- User ----------
  getCurrentUser() {
    return this.get(this.KEYS.CURRENT_USER);
  },

  setCurrentUser(user) {
    this.set(this.KEYS.CURRENT_USER, user);
  },

  clearCurrentUser() {
    this.remove(this.KEYS.CURRENT_USER);
  },

  getAllUsers() {
    return this.get(this.KEYS.USERS) || [];
  },

  saveUser(user) {
    const users = this.getAllUsers();
    const idx = users.findIndex(u => u.email === user.email);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.push(user);
    }
    this.set(this.KEYS.USERS, users);
  },

  findUserByEmail(email) {
    return this.getAllUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  // ---------- Attempts / Progress ----------
  getAttempts(userEmail) {
    const all = this.get(this.KEYS.ATTEMPTS) || {};
    return all[userEmail] || [];
  },

  saveAttempt(userEmail, attempt) {
    const all = this.get(this.KEYS.ATTEMPTS) || {};
    if (!all[userEmail]) all[userEmail] = [];
    all[userEmail].unshift(attempt); // newest first
    this.set(this.KEYS.ATTEMPTS, all);

    // Also queue for later sync
    this.queueForSync({ type: 'attempt', data: attempt, userEmail });
  },

  // ---------- Settings ----------
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

  // ---------- Offline Sync Queue ----------
  queueForSync(item) {
    const queue = this.get(this.KEYS.OFFLINE_QUEUE) || [];
    queue.push({
      ...item,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random().toString(36).slice(2)
    });
    this.set(this.KEYS.OFFLINE_QUEUE, queue);
  },

  getSyncQueue() {
    return this.get(this.KEYS.OFFLINE_QUEUE) || [];
  },

  clearSyncQueue() {
    this.remove(this.KEYS.OFFLINE_QUEUE);
  },

  // ---------- Theme ----------
  applyTheme() {
    const settings = this.getSettings();
    if (settings.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  },

  toggleDarkMode() {
    const settings = this.getSettings();
    settings.darkMode = !settings.darkMode;
    this.saveSettings(settings);
    this.applyTheme();
    return settings.darkMode;
  },

  // ---------- Questions ----------
  getQuestions() {
    return this.get(this.KEYS.QUESTIONS) || [];
  },

  saveQuestions(list) {
    this.set(this.KEYS.QUESTIONS, list || []);
  },

};

// Make available globally
window.Storage = Storage;

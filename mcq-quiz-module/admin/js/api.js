/**
 * api.js – Google Sheets bridge (Admin)
 * Falls back to localStorage when offline or when USE_GOOGLE_SHEETS is false.
 */

const API = {
  isEnabled() {
    return !!(window.CONFIG && CONFIG.USE_GOOGLE_SHEETS && CONFIG.API_URL);
  },

  async request(action, data = null, method = 'POST') {
    if (!this.isEnabled()) {
      return { error: 'Google Sheets not configured', offline: true };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT || 20000);

    try {
      let url = CONFIG.API_URL;
      const opts = { method, signal: controller.signal };

      if (method === 'GET') {
        const params = new URLSearchParams({ action, ...(data || {}) });
        url += (url.includes('?') ? '&' : '?') + params.toString();
      } else {
        opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        // Apps Script reads postData.contents – send JSON as text to avoid CORS preflight issues
        opts.body = JSON.stringify({ action, data: data || {} });
      }

      const res = await fetch(url, opts);
      clearTimeout(timer);
      const json = await res.json();
      return json;
    } catch (err) {
      clearTimeout(timer);
      console.warn('API error:', err.message);
      return { error: err.message || 'Network error', offline: true };
    }
  },

  // ---- Questions ----
  async getQuestions(filters = {}) {
    return this.request('getQuestions', filters, 'GET');
  },

  async addQuestion(q) {
    return this.request('addQuestion', q);
  },

  async updateQuestion(q) {
    return this.request('updateQuestion', q);
  },

  async deleteQuestion(qNo) {
    return this.request('deleteQuestion', { qNo });
  },

  async bulkAddQuestions(questions) {
    return this.request('bulkAddQuestions', { questions });
  },

  // ---- Users ----
  async getUsers() {
    return this.request('getUsers', null, 'GET');
  },

  async updateUser(user) {
    return this.request('updateUser', user);
  },

  async deleteUser(email) {
    return this.request('deleteUser', { email });
  },

  async registerUser(data) {
    return this.request('registerUser', data);
  },

  // ---- Attempts ----
  async getAllAttempts() {
    return this.request('getAllAttempts', null, 'GET');
  },

  async getAttempts(email) {
    return this.request('getAttempts', { email }, 'GET');
  },

  async saveAttempt(attempt) {
    return this.request('saveAttempt', attempt);
  },

  // ---- Settings ----
  async getSettings() {
    return this.request('getSettings', null, 'GET');
  },

  async saveSettings(settings) {
    return this.request('saveSettings', settings);
  },

  async ping() {
    return this.request('ping', null, 'GET');
  }
};

window.API = API;

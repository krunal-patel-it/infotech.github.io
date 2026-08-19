/**
 * api.js – Google Sheets bridge (Student)
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
        opts.body = JSON.stringify({ action, data: data || {} });
      }

      const res = await fetch(url, opts);
      clearTimeout(timer);
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      console.warn('API error:', err.message);
      return { error: err.message || 'Network error', offline: true };
    }
  },

  async getQuestions(filters = {}) {
    // forStudent=1 excludes locked questions
    return this.request('getQuestions', { ...filters, forStudent: '1' }, 'GET');
  },

  async registerUser(data) {
    return this.request('registerUser', data);
  },

  async loginUser(data) {
    return this.request('loginUser', data);
  },

  async getAttempts(email) {
    return this.request('getAttempts', { email }, 'GET');
  },

  async saveAttempt(attempt) {
    return this.request('saveAttempt', attempt);
  },

  async getSettings() {
    return this.request('getSettings', null, 'GET');
  },

  async ping() {
    return this.request('ping', null, 'GET');
  }
};

window.API = API;

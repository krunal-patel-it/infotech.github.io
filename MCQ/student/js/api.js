/**
 * api.js – Google Sheets bridge (Student)
 */

const API = {
  lastError: null,
  lastOk: null,

  isEnabled() {
    return !!(window.CONFIG && CONFIG.USE_GOOGLE_SHEETS && CONFIG.API_URL &&
      String(CONFIG.API_URL).includes('script.google.com'));
  },

  statusText() {
    if (!window.CONFIG) return 'Config missing';
    if (!CONFIG.USE_GOOGLE_SHEETS) return 'Local only (not synced)';
    if (!CONFIG.API_URL) return 'Local only (API_URL empty)';
    if (this.lastError) return 'Sheets error: ' + this.lastError;
    if (this.lastOk) return 'Synced with Google Sheets';
    return 'Sheets enabled – connecting…';
  },

  async request(action, data = null, method = 'POST') {
    if (!this.isEnabled()) {
      return { error: 'Google Sheets not configured', offline: true };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT || 25000);

    try {
      let url = String(CONFIG.API_URL).trim();
      const opts = {
        method,
        signal: controller.signal,
        redirect: 'follow',
        credentials: 'omit'
      };

      if (method === 'GET') {
        const flat = { action };
        if (data && typeof data === 'object') {
          Object.keys(data).forEach(k => {
            if (data[k] !== undefined && data[k] !== null) flat[k] = String(data[k]);
          });
        }
        url += (url.includes('?') ? '&' : '?') + new URLSearchParams(flat).toString();
      } else {
        opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        opts.body = JSON.stringify({ action, data: data || {} });
      }

      const res = await fetch(url, opts);
      clearTimeout(timer);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        this.lastError = 'Invalid response from server';
        return { error: this.lastError, offline: true };
      }
      if (json.error) this.lastError = json.error;
      else { this.lastError = null; this.lastOk = Date.now(); }
      return json;
    } catch (err) {
      clearTimeout(timer);
      this.lastError = err.name === 'AbortError' ? 'Timeout' : (err.message || 'Network error');
      return { error: this.lastError, offline: true };
    }
  },

  async getQuestions(filters = {}) {
    return this.request('getQuestions', { ...filters, forStudent: '1' }, 'GET');
  },
  async registerUser(data) { return this.request('registerUser', data); },
  async loginUser(data) { return this.request('loginUser', data); },
  async getAttempts(email) { return this.request('getAttempts', { email }, 'GET'); },
  async saveAttempt(attempt) { return this.request('saveAttempt', attempt); },
  async getSettings() { return this.request('getSettings', null, 'GET'); },
  async ping() { return this.request('ping', null, 'GET'); }
};

window.API = API;

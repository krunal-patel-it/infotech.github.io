/**
 * api.js – Google Sheets bridge (Admin)
 * When USE_GOOGLE_SHEETS is false, all data stays in this browser only.
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
    if (!CONFIG.USE_GOOGLE_SHEETS) return 'Local only (USE_GOOGLE_SHEETS is false)';
    if (!CONFIG.API_URL) return 'Local only (API_URL is empty)';
    if (this.lastError) return 'Sheets error: ' + this.lastError;
    if (this.lastOk) return 'Connected to Google Sheets';
    return 'Google Sheets enabled – not tested yet';
  },

  async request(action, data = null, method = 'POST') {
    if (!this.isEnabled()) {
      this.lastError = null;
      return { error: 'Google Sheets not configured', offline: true };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT || 25000);

    try {
      let url = String(CONFIG.API_URL).trim();
      // Ensure we hit /exec not /dev
      if (url.includes('/dev')) {
        console.warn('API_URL looks like a dev URL; use the /exec deployment URL');
      }

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
        const params = new URLSearchParams(flat);
        url += (url.includes('?') ? '&' : '?') + params.toString();
      } else {
        // text/plain avoids CORS preflight; GAS reads postData.contents
        opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        opts.body = JSON.stringify({ action, data: data || {} });
      }

      const res = await fetch(url, opts);
      clearTimeout(timer);

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        this.lastError = 'Invalid response (is Web App deployed as Anyone?)';
        console.error('API non-JSON response:', text.slice(0, 200));
        return { error: this.lastError, offline: true, raw: text.slice(0, 200) };
      }

      if (json.error) {
        this.lastError = json.error;
      } else {
        this.lastError = null;
        this.lastOk = Date.now();
      }
      return json;
    } catch (err) {
      clearTimeout(timer);
      this.lastError = err.name === 'AbortError' ? 'Request timeout' : (err.message || 'Network error');
      console.warn('API error:', this.lastError);
      return { error: this.lastError, offline: true };
    }
  },

  async getQuestions(filters = {}) {
    return this.request('getQuestions', filters, 'GET');
  },
  async addQuestion(q) { return this.request('addQuestion', q); },
  async updateQuestion(q) { return this.request('updateQuestion', q); },
  async deleteQuestion(qNo) { return this.request('deleteQuestion', { qNo }); },
  async bulkAddQuestions(questions) { return this.request('bulkAddQuestions', { questions }); },
  async getUsers() { return this.request('getUsers', null, 'GET'); },
  async updateUser(user) { return this.request('updateUser', user); },
  async deleteUser(email) { return this.request('deleteUser', { email }); },
  async registerUser(data) { return this.request('registerUser', data); },
  async getAllAttempts() { return this.request('getAllAttempts', null, 'GET'); },
  async getAttempts(email) { return this.request('getAttempts', { email }, 'GET'); },
  async saveAttempt(attempt) { return this.request('saveAttempt', attempt); },
  async getSettings() { return this.request('getSettings', null, 'GET'); },
  async saveSettings(settings) { return this.request('saveSettings', settings); },
  async ping() { return this.request('ping', null, 'GET'); }
};

window.API = API;

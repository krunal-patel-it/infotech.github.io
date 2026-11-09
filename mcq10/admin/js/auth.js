/**
 * auth.js - Admin authentication (MVP)
 * Hardcoded admin for simplicity. Later move to Google Sheets.
 */

const Auth = {
  // Demo admin credentials
  ADMIN: {
    email: 'admin@quiz.com',
    password: 'admin123',
    name: 'Administrator'
  },

  login(email, password) {
    email = (email || '').trim().toLowerCase();

    if (email === this.ADMIN.email && password === this.ADMIN.password) {
      const admin = {
        email: this.ADMIN.email,
        name: this.ADMIN.name,
        loginAt: new Date().toISOString()
      };
      Storage.setAdmin(admin);
      return { success: true, admin };
    }
    return { success: false, message: 'Invalid admin credentials.' };
  },

  logout() {
    Storage.clearAdmin();
  },

  isLoggedIn() {
    return !!Storage.getAdmin();
  },

  getAdmin() {
    return Storage.getAdmin();
  }
};

window.Auth = Auth;

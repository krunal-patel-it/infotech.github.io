/**
 * auth.js – Student authentication
 * Uses Google Sheets when configured; falls back to localStorage offline.
 */

const Auth = {
  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  },

  async register({ email, mobile, password }) {
    email = email.trim().toLowerCase();
    mobile = mobile.trim();

    if (!email || !mobile || !password) {
      return { success: false, message: 'All fields are required.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, message: 'Please enter a valid email.' };
    }
    if (!/^[0-9]{10}$/.test(mobile)) {
      return { success: false, message: 'Mobile number must be 10 digits.' };
    }
    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }

    // Try Google Sheets first
    if (typeof API !== 'undefined' && API.isEnabled()) {
      const res = await API.registerUser({ email, mobile, password, name: email.split('@')[0] });
      if (res && res.success) {
        // Mirror locally for offline
        const user = {
          id: res.user?.id || ('u_' + Date.now()),
          email,
          mobile,
          passwordHash: this._hash(password),
          name: res.user?.name || email.split('@')[0],
          createdAt: res.user?.createdAt || new Date().toISOString(),
          lastLogin: null,
          isLocked: false,
          timerLocked: false,
          forcedTimer: 45
        };
        Storage.saveUser(user);
        return { success: true, message: res.message || 'Registration successful! Please login.', user };
      }
      if (res && res.message && !res.offline) {
        return { success: false, message: res.message };
      }
      // fall through to local if offline
    }

    if (Storage.findUserByEmail(email)) {
      return { success: false, message: 'Email already registered. Please login.' };
    }

    const user = {
      id: 'u_' + Date.now(),
      email,
      mobile,
      passwordHash: this._hash(password),
      name: email.split('@')[0],
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isLocked: false,
      timerLocked: false,
      forcedTimer: 45
    };
    Storage.saveUser(user);
    Storage.queueForSync({ type: 'register', data: { email, mobile, name: user.name } });
    return { success: true, message: 'Registration successful! Please login.', user };
  },

  async login({ email, password }) {
    email = email.trim().toLowerCase();

    if (!email || !password) {
      return { success: false, message: 'Email and password are required.' };
    }

    // Try Google Sheets first
    if (typeof API !== 'undefined' && API.isEnabled()) {
      const res = await API.loginUser({ email, password });
      if (res && res.success && res.user) {
        const u = res.user;
        // Mirror full user locally (with hash for offline re-login)
        Storage.saveUser({
          id: u.id,
          email: u.email,
          mobile: u.mobile,
          name: u.name,
          passwordHash: this._hash(password),
          lastLogin: u.lastLogin,
          isLocked: !!u.isLocked,
          timerLocked: !!u.timerLocked,
          forcedTimer: u.forcedTimer || 45,
          createdAt: u.createdAt || new Date().toISOString()
        });
        const sessionUser = {
          id: u.id,
          email: u.email,
          mobile: u.mobile,
          name: u.name,
          lastLogin: u.lastLogin,
          timerLocked: !!u.timerLocked,
          forcedTimer: u.forcedTimer || 45
        };
        Storage.setCurrentUser(sessionUser);
        return { success: true, message: 'Login successful!', user: sessionUser };
      }
      if (res && res.message && !res.offline) {
        return { success: false, message: res.message };
      }
    }

    // Local fallback
    const user = Storage.findUserByEmail(email);
    if (!user) {
      return { success: false, message: 'No account found with this email.' };
    }
    if (user.isLocked) {
      return { success: false, message: 'Your account has been locked by admin.' };
    }
    if (user.passwordHash !== this._hash(password)) {
      return { success: false, message: 'Incorrect password.' };
    }

    user.lastLogin = new Date().toISOString();
    Storage.saveUser(user);

    const sessionUser = {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      name: user.name,
      lastLogin: user.lastLogin,
      timerLocked: !!user.timerLocked,
      forcedTimer: user.forcedTimer || 45
    };
    Storage.setCurrentUser(sessionUser);
    return { success: true, message: 'Login successful!', user: sessionUser };
  },

  logout() {
    Storage.clearCurrentUser();
    return true;
  },

  isLoggedIn() {
    return !!Storage.getCurrentUser();
  },

  getCurrentUser() {
    return Storage.getCurrentUser();
  }
};

window.Auth = Auth;

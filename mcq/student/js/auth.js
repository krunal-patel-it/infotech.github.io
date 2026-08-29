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

    // Try Google Sheets first (required for multi-device)
    if (typeof API !== 'undefined' && API.isEnabled()) {
      const res = await API.registerUser({ email, mobile, password, name: email.split('@')[0] });
      if (res && res.success) {
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
      // Real server rejection (e.g. email exists)
      if (res && res.message && !res.offline) {
        return { success: false, message: res.message };
      }
      // Network/offline – still save locally but warn
      if (res && res.offline) {
        // fall through to local with warning message later
      } else if (res && res.error) {
        return { success: false, message: 'Could not register on server: ' + res.error };
      }
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
    return { success: true, message: (typeof API !== 'undefined' && API.isEnabled()) ? 'Registered locally (server unreachable – will not appear on Admin until Sheets is reachable).' : 'Registration successful! Please login.', user };
  },

  _failedKey() { return 'mcq_failed_logins'; },

  _getFails(email) {
    try {
      const map = JSON.parse(localStorage.getItem(this._failedKey()) || '{}');
      return Number(map[email] || 0);
    } catch (e) { return 0; }
  },

  _setFails(email, n) {
    try {
      const map = JSON.parse(localStorage.getItem(this._failedKey()) || '{}');
      map[email] = n;
      localStorage.setItem(this._failedKey(), JSON.stringify(map));
    } catch (e) {}
  },

  _clearFails(email) { this._setFails(email, 0); },

  async _lockAccount(email) {
    const user = Storage.findUserByEmail(email);
    if (user) {
      user.isLocked = true;
      Storage.saveUser(user);
    }
    if (typeof API !== 'undefined' && API.isEnabled()) {
      try {
        await API.updateUser({ email, isLocked: true });
      } catch (e) {}
    }
  },

  async _recordFailedLogin(email) {
    const n = this._getFails(email) + 1;
    this._setFails(email, n);
    if (n >= 3) {
      await this._lockAccount(email);
      return {
        success: false,
        message: 'Account locked after 3 incorrect password attempts. Contact your admin to unlock.'
      };
    }
    return {
      success: false,
      message: 'Incorrect password. Attempt ' + n + ' of 3. Account will lock after 3 wrong tries.'
    };
  },

  async login({ email, password }) {
    email = email.trim().toLowerCase();

    if (!email || !password) {
      return { success: false, message: 'Email and password are required.' };
    }

    // Local lock check first
    const localUser = Storage.findUserByEmail(email);
    if (localUser && localUser.isLocked) {
      return { success: false, message: 'Your account has been locked. Contact your admin to unlock.' };
    }
    if (this._getFails(email) >= 3) {
      await this._lockAccount(email);
      return { success: false, message: 'Account locked after 3 incorrect password attempts. Contact your admin to unlock.' };
    }

    // Try Google Sheets first
    if (typeof API !== 'undefined' && API.isEnabled()) {
      const res = await API.loginUser({ email, password });
      if (res && res.success && res.user) {
        this._clearFails(email);
        const u = res.user;
        const previousLastLogin = u.lastLogin || null;
        Storage.saveUser({
          id: u.id,
          email: u.email,
          mobile: u.mobile,
          name: u.name,
          passwordHash: this._hash(password),
          lastLogin: u.lastLogin,
          previousLastLogin,
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
          previousLastLogin,
          timerLocked: !!u.timerLocked,
          forcedTimer: u.forcedTimer || 45
        };
        Storage.setCurrentUser(sessionUser);
        return { success: true, message: 'Login successful!', user: sessionUser };
      }
      if (res && res.message && !res.offline) {
        // Wrong password or locked from server
        if (/incorrect password/i.test(res.message || '')) {
          return await this._recordFailedLogin(email);
        }
        return { success: false, message: res.message };
      }
    }

    // Local fallback
    const user = Storage.findUserByEmail(email);
    if (!user) {
      return { success: false, message: 'No account found with this email.' };
    }
    if (user.isLocked) {
      return { success: false, message: 'Your account has been locked. Contact your admin to unlock.' };
    }
    if (user.passwordHash !== this._hash(password)) {
      return await this._recordFailedLogin(email);
    }

    this._clearFails(email);
    const previousLastLogin = user.lastLogin || null;
    user.previousLastLogin = previousLastLogin;
    user.lastLogin = new Date().toISOString();
    Storage.saveUser(user);

    const sessionUser = {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      name: user.name,
      lastLogin: user.lastLogin,
      previousLastLogin,
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

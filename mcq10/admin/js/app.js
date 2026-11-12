/**
 * app.js - Admin Panel Controller
 */

const App = {
  async sha256Hex(str) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str)));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let hash = 0;
    for (let i = 0; i < String(str).length; i++) {
      hash = ((hash << 5) - hash) + String(str).charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(36);
  },

  /** Simplify any date/time string for display: dd/MM/yyyy and HH:mm */
  formatDisplayDate(v) {
    if (v == null || v === '') return '—';
    const s = String(v).trim();
    if (!s || s === '—') return '—';
    // Already simple dd/MM/yyyy or HH:mm
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s)) return s;
    if (/^\d{1,2}:\d{2}/.test(s) && !/GMT/i.test(s)) return s.split(' ')[0];
    const d = new Date(s);
    if (isNaN(d.getTime())) {
      // strip GMT noise if partial
      return s.replace(/\s*GMT[\s\S]*/i, '').replace(/\s*\(.*\)\s*$/, '').trim() || '—';
    }
    if (d.getFullYear() < 1900) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },
  formatDisplayTime(v) {
    if (v == null || v === '') return '';
    const s = String(v).trim();
    if (/^\d{1,2}:\d{2}/.test(s) && !/GMT/i.test(s)) {
      return s.replace(/\s*GMT[\s\S]*/i, '').trim();
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return s.replace(/\s*GMT[\s\S]*/i, '').replace(/\s*\(.*\)\s*$/, '').trim();
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  },
  formatDisplayDateTime(dateStr, timeStr) {
    const d = this.formatDisplayDate(dateStr);
    const t = this.formatDisplayTime(timeStr);
    if (d === '—' && !t) return '—';
    if (d === '—') return t;
    if (!t) return d;
    return d + ' · ' + t;
  },

  currentView: 'dashboard',

  init() {
    Questions.init(); // Seed locally + background sync from Google Sheets
    Storage.applyTheme();
    this.bindGlobalEvents();
    this.updateSheetsStatus();
    this.syncCloudData().then(() => this.updateSheetsStatus());

    setTimeout(() => {
      if (Auth.isLoggedIn()) {
        this.showScreen('main');
        this.renderView('dashboard');
      } else {
        this.showScreen('login');
      }
    }, 500);
  },

  async syncCloudData() {
    if (typeof API === 'undefined' || !API.isEnabled()) {
      return { ok: false, message: 'Google Sheets not connected' };
    }
    this._setSyncBanner('Syncing Data…', 'info');
    try {
      let userCount = 0, attemptCount = 0;

      const sRes = await API.getSettings();
      if (sRes && sRes.settings) {
        const local = Storage.getSettings();
        Storage.saveSettings({ ...local, ...sRes.settings });
      }

      const uRes = await API.getUsers();
      if (uRes && uRes.error) {
        return { ok: false, message: 'getUsers failed: ' + uRes.error };
      }
      if (uRes && Array.isArray(uRes.users)) {
        uRes.users.forEach(u => {
          if (!u || !u.email) return;
          const email = String(u.email).toLowerCase();
          const existing = Storage.findUser(email);
          Storage.saveUser({
            ...(existing || {}),
            ...u,
            email,
            passwordHash: existing?.passwordHash || u.passwordHash || ''
          });
          userCount++;
        });
      }

      const aRes = await API.getAllAttempts();
      if (aRes && aRes.error) {
        return { ok: false, message: 'getAllAttempts failed: ' + aRes.error };
      }
      if (aRes && Array.isArray(aRes.attempts)) {
        const byEmail = {};
        aRes.attempts.forEach(a => {
          const em = String(a.email || '').toLowerCase();
          if (!em) return;
          if (!byEmail[em]) byEmail[em] = [];
          byEmail[em].push(a);
          attemptCount++;
        });
        // Full replace of attempts map from cloud
        Storage.set('mcq_attempts', byEmail);

        // Ensure every attempt email exists as a user in Admin list
        Object.keys(byEmail).forEach(em => {
          if (!Storage.findUser(em)) {
            Storage.saveUser({
              id: 'u_sync_' + em.replace(/[^a-z0-9]/g, ''),
              email: em,
              mobile: '',
              name: em.split('@')[0],
              passwordHash: '',
              createdAt: new Date().toISOString(),
              lastLogin: null,
              isLocked: false,
              timerLocked: false,
              forcedTimer: 45
            });
            userCount++;
          }
        });
      }

      console.log('Admin cloud sync complete', { userCount, attemptCount });
      const msg = 'Sync complete — ' + userCount + ' users, ' + attemptCount + ' attempts';
      this._setSyncBanner(msg, 'success');
      return { ok: true, userCount, attemptCount, message: msg };
    } catch (e) {
      console.warn('Admin cloud sync failed', e);
      this._setSyncBanner('Sync failed: ' + (e.message || 'error'), 'error');
      return { ok: false, message: e.message || 'Sync failed' };
    }
  },

  _setSyncBanner(message, type) {
    let el = document.getElementById('admin-sync-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'admin-sync-banner';
      el.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;padding:10px 16px;border-radius:8px;font-size:0.85rem;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);max-width:320px;';
      document.body.appendChild(el);
    }
    el.textContent = message;
    if (type === 'info') {
      el.style.background = '#dbeafe';
      el.style.color = '#1e40af';
    } else if (type === 'success') {
      el.style.background = '#dcfce7';
      el.style.color = '#166534';
    } else {
      el.style.background = '#fee2e2';
      el.style.color = '#991b1b';
    }
    el.style.display = 'block';
    if (type !== 'info') {
      clearTimeout(this._syncBannerTimer);
      this._syncBannerTimer = setTimeout(() => { el.style.display = 'none'; }, 4000);
    }
  },

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${id}`)?.classList.add('active');
  },

  bindGlobalEvents() {
    // Login
    document.getElementById('form-admin-login')?.addEventListener('submit', e => {
      e.preventDefault();
      this.handleLogin();
    });

    // Section nav
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderView(btn.dataset.view);
      });
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      if (confirm('Logout from Admin Panel?')) {
        Auth.logout();
        this.showScreen('login');
      }
    });

    document.getElementById('btn-darkmode')?.addEventListener('click', () => {
      const isDark = Storage.toggleDarkMode();
      document.getElementById('btn-darkmode').textContent = isDark ? '☀️' : '🌙';
    });

    window.addEventListener('online', () => {
      this.runTopSync(true);
    });

    // Modal close
    document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });
  },

  handleLogin() {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const msg = document.getElementById('login-message');

    const result = Auth.login(email, password);
    if (result.success) {
      msg.textContent = 'Login successful!';
      msg.className = 'form-message success';
      setTimeout(() => {
        this.showScreen('main');
        this.renderView('dashboard');
      }, 400);
    } else {
      msg.textContent = result.message;
      msg.className = 'form-message error';
    }
  },

  // ---------- View Router ----------
  renderView(view) {
    this.currentView = view;
    const titles = {
      dashboard: 'Dashboard',
      users: 'Manage Users',
      questions: 'Question Bank',
      reports: 'Reports',
      settings: 'Settings'
    };
    document.getElementById('page-title').textContent = titles[view] || view;

    const container = document.getElementById('main-content');
    switch (view) {
      case 'dashboard': container.innerHTML = this.viewDashboard(); this._wireSort('main-content'); break;
      case 'users': container.innerHTML = this.viewUsers(); this.bindUsersEvents(); break;
      case 'questions': container.innerHTML = this.viewQuestions(); this.bindQuestionsEvents(); break;
      case 'reports': container.innerHTML = this.viewReports(); this.bindReportsEvents(); break;
      case 'settings': container.innerHTML = this.viewSettings(); this.bindSettingsEvents(); break;
    }
  },

  // ========== DASHBOARD ==========
  viewDashboard() {
    const s = Admin.getDashboardStats();
    const sheetsOn = typeof API !== 'undefined' && API.isEnabled();
    const status = typeof API !== 'undefined' ? API.statusText() : 'API missing';
    const banner = sheetsOn
      ? ''
      : `<div style="background:#fef3c7;color:#92400e;padding:12px 14px;border-radius:8px;margin-bottom:16px;font-size:0.9rem;line-height:1.45;">
           Local-only mode — set API_URL and USE_GOOGLE_SHEETS in config.js for live sync.
         </div>`;
    return `
      ${banner}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Total Users</div>
          <div class="value">${s.totalUsers}</div>
          <div class="sub">${s.activeUsers} active · ${s.lockedUsers} locked</div>
        </div>
        <div class="stat-card">
          <div class="label">Questions</div>
          <div class="value">${s.totalQuestions}</div>
          <div class="sub">${s.lockedQuestions} locked</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Attempts</div>
          <div class="value">${s.totalAttempts}</div>
        </div>
        <div class="stat-card">
          <div class="label">Average Score</div>
          <div class="value">${s.avgScore}%</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Quick Actions</h3>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="App.renderView('users')">Manage Users</button>
          <button class="btn btn-primary" onclick="App.renderView('questions')">Question Bank</button>
          <button class="btn btn-secondary" onclick="App.renderView('reports')">View Reports</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Recent Activity</h3></div>
        ${this._simpleRecentTable(10)}
      </div>

      ${this._unitAnalyticsHTML()}
      ${this._richDashboard()}
    `;
  },

  _simpleRecentTable(limit) {
    const attempts = Admin.getRecentAttempts(limit);
    if (attempts.length === 0) {
      return `<div class="empty-state"><div class="icon">📈</div><p>No attempts recorded yet.</p></div>`;
    }
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Date & Time</th>
              <th>Category</th>
              <th>Session</th>
              <th>Score</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            ${attempts.map(a => `
              <tr>
                <td><strong>${(Storage.findUser(a.email)?.name || a.name || a.email.split('@')[0])}</strong><br><small style="color:var(--text-muted)">${a.email}</small></td>
                <td>${App.formatDisplayDateTime(a.date, a.time)}</td>
                <td>${a.category || '—'}</td>
                <td>${a.session || '—'}</td>
                <td>${a.correct}/${a.total}</td>
                <td><strong>${a.percentage}%</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ========== USERS ==========
  viewUsers() {
    const users = Admin.getUsers();
    const rows = users.length === 0
      ? `<tr><td colspan="8" class="empty-state">No students registered yet.<br>Add them manually or use Bulk Students.</td></tr>`
      : users.map(u => `
        <tr data-user="${u.email}">
          <td><input type="checkbox" class="row-check user-check" value="${u.email}" aria-label="Select ${u.email}" /></td>
          <td>
            <strong>${u.name || u.email.split('@')[0]}</strong><br>
            <small style="color:var(--text-muted)">${u.email}</small>
          </td>
          <td>${u.mobile || '—'}</td>
          <td>${u.attemptCount}</td>
          <td>${u.avgScore}%</td>
          <td>
            ${u.isLocked
              ? '<span class="badge badge-danger">Locked</span>'
              : '<span class="badge badge-success">Active</span>'}
          </td>
          <td>${App.formatDisplayDate(u.lastLogin)}</td>
          <td>
            <div class="actions">
              <button class="btn btn-sm btn-secondary" onclick="App.showUserDetail('${u.email}')">View</button>
              <button class="btn btn-sm btn-primary" onclick="App.showUserReport('${u.email}')">Report</button>
              <button class="btn btn-sm btn-secondary" onclick="App.editUser('${u.email}')">Edit</button>
              <button class="btn btn-sm ${u.isLocked ? 'btn-success' : 'btn-danger'}"
                onclick="App.toggleUserLock('${u.email}', ${!u.isLocked})">
                ${u.isLocked ? 'Unlock' : 'Lock'}
              </button>
              <button class="btn btn-sm btn-danger" onclick="App.deleteUser('${u.email}')">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');

    return `
      <div class="toolbar">
        <input type="text" class="search-input" id="user-search" placeholder="Search by name, email or mobile..." />
        <button class="btn btn-secondary" onclick="App.showBulkStudents()">⬆ Bulk Students</button>
        <button class="btn btn-primary" onclick="App.showAddUser()">+ Add User</button>
      </div>
      <div class="batch-bar" id="user-batch" hidden>
        <strong id="user-batch-count">0 selected</strong>
        <button class="btn btn-sm btn-danger" type="button" onclick="App.batchUsers('lock')">Lock</button>
        <button class="btn btn-sm btn-success" type="button" onclick="App.batchUsers('unlock')">Unlock</button>
        <button class="btn btn-sm btn-danger" type="button" onclick="App.batchUsers('delete')">Delete</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" id="user-check-all" aria-label="Select all users" /></th>
                <th class="sortable" data-sort="name">Student</th>
                <th class="sortable" data-sort="mobile">Mobile</th>
                <th class="sortable" data-sort="attemptCount">Attempts</th>
                <th class="sortable" data-sort="avgScore">Avg Score</th>
                <th class="sortable" data-sort="isLocked">Status</th>
                <th class="sortable" data-sort="lastLogin">Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="users-tbody">${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  bindUsersEvents() {
    this._wireSort('users-tbody', '#users-tbody', 'user');
    const updateBatch = () => {
      const n = document.querySelectorAll('.user-check:checked').length;
      const bar = document.getElementById('user-batch');
      const label = document.getElementById('user-batch-count');
      if (bar) bar.hidden = n === 0;
      if (label) label.textContent = n + ' selected';
    };
    document.getElementById('user-check-all')?.addEventListener('change', e => {
      document.querySelectorAll('.user-check').forEach(c => { c.checked = e.target.checked; });
      updateBatch();
    });
    document.querySelectorAll('.user-check').forEach(c => c.addEventListener('change', updateBatch));
    document.getElementById('user-search')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#users-tbody tr').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  },

  // ----- Add / Edit User -----
  showAddUser() {
    this._userFormModal(null);
  },

  editUser(email) {
    const user = Storage.findUser(email);
    if (user) this._userFormModal(user);
  },

  _userFormModal(user) {
    const isEdit = !!user;
    const title = isEdit ? `Edit User: ${user.email}` : 'Add New User';

    const body = `
      <div class="form-group">
        <label>Full Name</label>
        <input type="text" id="uf-name" value="${user?.name || ''}" placeholder="Student name" />
      </div>
      <div class="form-group">
        <label>Email *</label>
        <input type="email" id="uf-email" value="${user?.email || ''}" ${isEdit ? 'readonly style="opacity:0.7"' : ''} required />
      </div>
      <div class="form-group">
        <label>Mobile Number *</label>
        <input type="tel" id="uf-mobile" value="${user?.mobile || ''}" pattern="[0-9]{10}" placeholder="10-digit mobile" required />
      </div>
      <div class="form-group">
        <label>${isEdit ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
        <input type="password" id="uf-password" placeholder="${isEdit ? 'Leave blank to keep current' : 'Min 6 characters'}" ${isEdit ? '' : 'required minlength="6"'} />
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="uf-locked" ${user?.isLocked ? 'checked' : ''} />
          Account Locked
        </label>
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0;" />
      <div class="form-group">
        <label>
          <input type="checkbox" id="uf-timer-locked" ${user?.timerLocked ? 'checked' : ''} />
          Lock Timer for this student
        </label>
        <p style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">
          When enabled, this student cannot choose the timer. Individual lock takes priority over global Settings lock.
        </p>
      </div>
      <div class="form-group" id="uf-timer-value-group" style="${user?.timerLocked ? '' : 'display:none;'}">
        <label>Forced Timer (seconds)</label>
        <select id="uf-forced-timer">
          <option value="60" ${user?.forcedTimer === 60 ? 'selected' : ''}>1 minute</option>
          <option value="45" ${!user?.forcedTimer || user?.forcedTimer === 45 ? 'selected' : ''}>45 seconds</option>
          <option value="30" ${user?.forcedTimer === 30 ? 'selected' : ''}>30 seconds</option>
          <option value="15" ${user?.forcedTimer === 15 ? 'selected' : ''}>15 seconds</option>
        </select>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="App.saveUser(${isEdit ? `'${user.email}'` : 'null'})">
        ${isEdit ? 'Update User' : 'Add User'}
      </button>
    `;

    this.openModal(title, body, footer);

    // Toggle forced timer visibility
    setTimeout(() => {
      document.getElementById('uf-timer-locked')?.addEventListener('change', e => {
        document.getElementById('uf-timer-value-group').style.display = e.target.checked ? '' : 'none';
      });
    }, 50);
  },

  saveUser(existingEmail) {
    const name = document.getElementById('uf-name').value.trim();
    const email = document.getElementById('uf-email').value.trim().toLowerCase();
    const mobile = document.getElementById('uf-mobile').value.trim();
    const password = document.getElementById('uf-password').value;
    const isLocked = document.getElementById('uf-locked').checked;
    const timerLocked = document.getElementById('uf-timer-locked')?.checked || false;
    const forcedTimer = parseInt(document.getElementById('uf-forced-timer')?.value || '45');

    if (!email || !mobile) {
      alert('Email and Mobile are required.');
      return;
    }
    if (!/^[0-9]{10}$/.test(mobile)) {
      alert('Mobile must be 10 digits.');
      return;
    }

    if (existingEmail) {
      // Edit existing
      const user = Storage.findUser(existingEmail);
      if (!user) return alert('User not found');
      user.name = name || user.name;
      user.mobile = mobile;
      user.isLocked = isLocked;
      user.timerLocked = timerLocked;
      user.forcedTimer = forcedTimer;
      if (password && password.length >= 6) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
          hash = ((hash << 5) - hash) + password.charCodeAt(i);
          hash = hash & hash;
        }
        user.passwordHash = hash.toString(36);
      }
      Storage.saveUser(user);
      if (typeof API !== 'undefined' && API.isEnabled()) {
        API.updateUser({
          email: user.email,
          name: user.name,
          mobile: user.mobile,
          isLocked: user.isLocked,
          timerLocked: user.timerLocked,
          forcedTimer: user.forcedTimer,
          password: password && password.length >= 6 ? password : undefined
        }).catch(() => {});
      }
    } else {
      // Add new
      if (Storage.findUser(email)) {
        alert('A user with this email already exists.');
        return;
      }
      if (!password || password.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
      }
      let hash = 0;
      for (let i = 0; i < password.length; i++) {
        hash = ((hash << 5) - hash) + password.charCodeAt(i);
        hash = hash & hash;
      }
      const newUser = {
        id: 'u_' + Date.now(),
        email,
        mobile,
        name: name || email.split('@')[0],
        passwordHash: hash.toString(36),
        createdAt: new Date().toISOString(),
        lastLogin: null,
        isLocked,
        timerLocked,
        forcedTimer
      };
      Storage.saveUser(newUser);
      if (typeof API !== 'undefined' && API.isEnabled()) {
        API.registerUser({
          email, mobile, password, name: newUser.name,
          isLocked, timerLocked, forcedTimer
        }).catch(() => {});
      }
    }

    this.closeModal();
    this.renderView('users');
  },

  // ----- Detailed User Report -----
  showUserReport(email) {
    const detail = Admin.getUserDetail(email);
    if (!detail) return alert('User not found');

    const { user, attempts, byCategory } = detail;

    const totalCorrect = attempts.reduce((s, a) => s + (a.correct || 0), 0);
    const totalQ = attempts.reduce((s, a) => s + (a.total || 0), 0);
    const overallAvg = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;

    // Build meaningful report HTML
    let reportHTML = `
      <div style="font-family:system-ui;max-width:100%;">
        <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid var(--border);">
          <h2 style="margin:0 0 4px;">Student Performance Report</h2>
          <p style="color:var(--text-muted);margin:0;">Generated on ${new Date().toLocaleString('en-IN')}</p>
        </div>

        <h3 style="margin:0 0 12px;color:var(--primary);">1. Student Information</h3>
        <div class="detail-grid" style="margin-bottom:24px;">
          <div class="detail-item"><label>Name</label><span>${user.name || '—'}</span></div>
          <div class="detail-item"><label>Email</label><span>${user.email}</span></div>
          <div class="detail-item"><label>Mobile</label><span>${user.mobile || '—'}</span></div>
          <div class="detail-item"><label>Status</label>
            <span>${user.isLocked ? '<span class="badge badge-danger">Locked</span>' : '<span class="badge badge-success">Active</span>'}</span>
          </div>
          <div class="detail-item"><label>Registered On</label>
            <span>${App.formatDisplayDate(user.createdAt)}</span>
          </div>
          <div class="detail-item"><label>Last Login</label>
            <span>${App.formatDisplayDate(user.lastLogin)}</span>
          </div>
        </div>

        <h3 style="margin:0 0 12px;color:var(--primary);">2. Overall Performance Summary</h3>
        <div class="stats-grid" style="margin-bottom:24px;">
          <div class="stat-card">
            <div class="label">Total Quizzes</div>
            <div class="value">${attempts.length}</div>
          </div>
          <div class="stat-card">
            <div class="label">Questions Attempted</div>
            <div class="value">${totalQ}</div>
          </div>
          <div class="stat-card">
            <div class="label">Correct Answers</div>
            <div class="value">${totalCorrect}</div>
          </div>
          <div class="stat-card">
            <div class="label">Overall Average</div>
            <div class="value">${overallAvg}%</div>
          </div>
        </div>
    `;

    // Subject-wise
    if (Object.keys(byCategory).length > 0) {
      reportHTML += `
        <h3 style="margin:0 0 12px;color:var(--primary);">3. Subject / Category-wise Performance</h3>
        <div class="table-wrap" style="margin-bottom:24px;">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Quizzes Taken</th>
                <th>Questions</th>
                <th>Correct</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(byCategory).map(([cat, d]) => `
                <tr>
                  <td><strong>${cat}</strong></td>
                  <td>${d.attempts}</td>
                  <td>${d.total}</td>
                  <td>${d.correct}</td>
                  <td><strong>${d.total ? Math.round((d.correct / d.total) * 100) : 0}%</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Detailed attempt log
    reportHTML += `
      <h3 style="margin:0 0 12px;color:var(--primary);">4. Detailed Quiz Attempt Log</h3>
    `;

    if (attempts.length === 0) {
      reportHTML += `<p class="empty-state">No quiz attempts recorded for this student.</p>`;
    } else {
      reportHTML += `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date & Time</th>
                <th>Category</th>
                <th>Session / Topic</th>
                <th>Difficulty</th>
                <th>Score</th>
                <th>%</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              ${attempts.map((a, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${App.formatDisplayDateTime(a.date, a.time)}</td>
                  <td>${a.category || '—'}</td>
                  <td>${a.session || '—'}</td>
                  <td>${a.difficulty || '—'}</td>
                  <td>${a.correct}/${a.total}</td>
                  <td><strong>${a.percentage}%</strong></td>
                  <td>${a.durationSec ? Math.floor(a.durationSec / 60) + 'm ' + (a.durationSec % 60) + 's' : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    reportHTML += `</div>`;

    this.openModal(`Report – ${user.name || user.email}`, reportHTML, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
      <button class="btn btn-primary" onclick="App.exportUserReportPDF('${email}')">Export as PDF</button>
    `);
  },

  exportUserReportPDF(email) {
    const detail = Admin.getUserDetail(email);
    if (!detail) return alert('User not found');
    if (typeof PDF === 'undefined') return alert('PDF library not loaded. Please refresh the page.');
    PDF.exportUserReport(detail);
  },

  showUserDetail(email) {
    const detail = Admin.getUserDetail(email);
    if (!detail) return alert('User not found');

    const { user, attempts, byCategory } = detail;

    let attemptsHTML = attempts.length === 0
      ? '<p class="empty-state">No attempts yet.</p>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Category</th><th>Session</th><th>Score</th><th>%</th></tr></thead>
          <tbody>
            ${attempts.map(a => `
              <tr>
                <td>${App.formatDisplayDateTime(a.date, a.time)}</td>
                <td>${a.category || '—'}</td>
                <td>${a.session || '—'}</td>
                <td>${a.correct}/${a.total}</td>
                <td><strong>${a.percentage}%</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>`;

    let catHTML = Object.keys(byCategory).length === 0 ? '' :
      `<h4 style="margin:16px 0 8px;">Subject-wise Performance</h4>
       <div class="table-wrap"><table>
         <thead><tr><th>Category</th><th>Attempts</th><th>Correct</th><th>Avg %</th></tr></thead>
         <tbody>
           ${Object.entries(byCategory).map(([cat, d]) => `
             <tr>
               <td>${cat}</td>
               <td>${d.attempts}</td>
               <td>${d.correct}/${d.total}</td>
               <td>${d.total ? Math.round((d.correct / d.total) * 100) : 0}%</td>
             </tr>
           `).join('')}
         </tbody>
       </table></div>`;

    this.openModal(`Student: ${user.name || user.email}`, `
      <div class="detail-grid">
        <div class="detail-item"><label>Email</label><span>${user.email}</span></div>
        <div class="detail-item"><label>Mobile</label><span>${user.mobile || '—'}</span></div>
        <div class="detail-item"><label>Status</label>
          <span>${user.isLocked ? '<span class="badge badge-danger">Locked</span>' : '<span class="badge badge-success">Active</span>'}</span>
        </div>
        <div class="detail-item"><label>Registered</label>
          <span>${user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : '—'}</span>
        </div>
        <div class="detail-item"><label>Last Login</label>
          <span>${App.formatDisplayDate(user.lastLogin)}</span>
        </div>
        <div class="detail-item"><label>Total Attempts</label><span>${attempts.length}</span></div>
      </div>
      <h4 style="margin:16px 0 8px;">Quiz History</h4>
      ${attemptsHTML}
      ${catHTML}
    `, `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`);
  },

  toggleUserLock(email, lock) {
    Admin.lockUser(email, lock);
    if (typeof API !== 'undefined' && API.isEnabled()) {
      API.updateUser({ email, isLocked: lock }).catch(() => {});
    }
    this.renderView('users');
  },

  deleteUser(email) {
    if (confirm(`Delete user ${email} and all their attempts? This cannot be undone.`)) {
      Admin.deleteUser(email);
      if (typeof API !== 'undefined' && API.isEnabled()) {
        API.deleteUser(email).catch(() => {});
      }
      this.renderView('users');
    }
  },

  // ========== QUESTIONS ==========
  viewQuestions() {
    return `
      <div class="toolbar" style="flex-wrap:wrap;gap:10px;">
        <input type="text" class="search-input" id="q-search" placeholder="Search subject, unit, question..." style="min-width:160px;" />
        <select id="q-filter-category" class="search-input" style="min-width:130px;">
          <option value="">All Subjects</option>
        </select>
        <select id="q-filter-session" class="search-input" style="min-width:150px;">
          <option value="">All Sessions</option>
        </select>
        <select id="q-filter-difficulty" class="search-input" style="min-width:120px;">
          <option value="">All Difficulty</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        <select id="q-sort" class="search-input" style="min-width:140px;">
          <option value="qNo-asc">Q.No ↑</option>
          <option value="qNo-desc">Q.No ↓</option>
          <option value="category-asc">Subject A-Z</option>
          <option value="difficulty-asc">Difficulty</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="btn-q-clear">Clear</button>
      </div>

      <div class="toolbar" style="margin-top:8px;">
        <button class="btn btn-primary" type="button" onclick="App.showAddQuestion()">+ Add Question</button>
        <button class="btn btn-secondary" type="button" onclick="App.showBulkUpload()">Bulk Upload</button>
        <button class="btn btn-primary" type="button" onclick="App.exportQuestionBankPDF()">Export PDF</button>
      </div>
      <div id="bulk-result-banner" class="form-message" style="display:none;margin-bottom:12px;"></div>
      <div class="batch-bar" id="q-batch" hidden>
        <strong id="q-batch-count">0 selected</strong>
        <button class="btn btn-sm btn-secondary" type="button" onclick="App.batchQuestions('lock')">Lock</button>
        <button class="btn btn-sm btn-success" type="button" onclick="App.batchQuestions('unlock')">Unlock</button>
        <button class="btn btn-sm btn-danger" type="button" onclick="App.batchQuestions('delete')">Delete</button>
      </div>

      <div class="card">
        <div id="q-table-container"></div>
      </div>
    `;
  },

  _getFilteredQuestions() {
    let list = Questions.getAll();
    const search = (document.getElementById('q-search')?.value || '').toLowerCase();
    const cat = document.getElementById('q-filter-category')?.value || '';
    const sess = document.getElementById('q-filter-session')?.value || '';
    const diff = document.getElementById('q-filter-difficulty')?.value || '';
    const sort = document.getElementById('q-sort')?.value || 'qNo-asc';

    if (search) {
      list = list.filter(q =>
        (q.question || '').toLowerCase().includes(search) ||
        (q.category || '').toLowerCase().includes(search) ||
        (q.relevantSession || '').toLowerCase().includes(search)
      );
    }
    if (cat) list = list.filter(q => q.category === cat);
    if (sess) list = list.filter(q => q.relevantSession === sess);
    if (diff) list = list.filter(q => q.difficulty === diff);

    list.sort((a, b) => {
      switch (sort) {
        case 'qNo-desc': return b.qNo - a.qNo;
        case 'category-asc': return (a.category || '').localeCompare(b.category || '');
        case 'difficulty-asc':
          const order = { Easy: 1, Medium: 2, Hard: 3 };
          return (order[a.difficulty] || 9) - (order[b.difficulty] || 9);
        default: return a.qNo - b.qNo;
      }
    });
    return list;
  },

  _renderQuestionsTable() {
    const questions = this._getFilteredQuestions();
    if (questions.length === 0) {
      return `<div class="empty-state"><div class="icon">❓</div><p>No questions match the filters.</p></div>`;
    }
    const rows = questions.map(q => `
      <tr>
        <td><input type="checkbox" class="q-check" value="${q.qNo}" aria-label="Select question ${q.qNo}" /></td>
        <td>${q.qNo}</td>
        <td><strong>${q.subject || q.category || ''}</strong><br><small>${q.unit || q.questionBank || ''}</small><br><small style="opacity:0.8">${q.session || q.relevantSession || ''}</small></td>
        <td><span class="badge badge-info">${q.difficulty}</span></td>
        <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${q.question}">
          ${q.question.substring(0, 55)}${q.question.length > 55 ? '…' : ''}
        </td>
        <td>${q.rightAnswer}</td>
        <td>${q.timerSeconds || 45}s</td>
        <td>${q.locked ? '<span class="badge badge-danger">Locked</span>' : '<span class="badge badge-success">Open</span>'}</td>
        <td>
          <div class="actions">
            <button class="btn btn-sm btn-secondary" onclick="App.editQuestion(${q.qNo})">Edit</button>
            <button class="btn btn-sm btn-secondary" onclick="App.toggleQuestionLock(${q.qNo})">${q.locked ? 'Unlock' : 'Lock'}</button>
            <button class="btn btn-sm btn-danger" onclick="App.deleteQuestion(${q.qNo})">Del</button>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <p style="margin-bottom:8px;color:var(--text-muted);font-size:0.85rem;">Showing <strong>${questions.length}</strong> question(s)</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" id="q-check-all" aria-label="Select all questions" /></th>
              <th class="sortable">#</th><th class="sortable">Subject / Unit / Session</th><th class="sortable">Difficulty</th><th class="sortable">Question</th>
              <th class="sortable">Ans</th><th class="sortable">Timer</th><th class="sortable">Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  bindQuestionsEvents() {
    // Populate filters
    const all = Questions.getAll();
    const cats = [...new Set(all.map(q => q.category).filter(Boolean))].sort();
    const sessions = [...new Set(all.map(q => q.relevantSession).filter(Boolean))].sort();

    const catSel = document.getElementById('q-filter-category');
    const sessSel = document.getElementById('q-filter-session');
    if (catSel) catSel.innerHTML = '<option value="">All Subjects</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    if (sessSel) sessSel.innerHTML = '<option value="">All Sessions</option>' + sessions.map(s => `<option value="${s}">${s}</option>`).join('');

    const refresh = () => {
      const box = document.getElementById('q-table-container');
      if (box) box.innerHTML = this._renderQuestionsTable();
      this._wireSort('q-table-container');
      const updateQBatch = () => {
        const n = document.querySelectorAll('.q-check:checked').length;
        const bar = document.getElementById('q-batch');
        if (bar) bar.hidden = n === 0;
        const label = document.getElementById('q-batch-count');
        if (label) label.textContent = n + ' selected';
      };
      document.getElementById('q-check-all')?.addEventListener('change', e => {
        document.querySelectorAll('.q-check').forEach(c => { c.checked = e.target.checked; });
        updateQBatch();
      });
      document.querySelectorAll('.q-check').forEach(c => c.addEventListener('change', updateQBatch));
    };
    refresh();

    ['q-search', 'q-filter-category', 'q-filter-session', 'q-filter-difficulty', 'q-sort'].forEach(id => {
      document.getElementById(id)?.addEventListener(id === 'q-search' ? 'input' : 'change', refresh);
    });
    document.getElementById('btn-q-clear')?.addEventListener('click', () => {
      ['q-search', 'q-filter-category', 'q-filter-session', 'q-filter-difficulty'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      if (document.getElementById('q-sort')) document.getElementById('q-sort').value = 'qNo-asc';
      refresh();
    });
    if (this._lastBulkMessage) {
      const banner = document.getElementById('bulk-result-banner');
      if (banner) {
        banner.style.display = 'block';
        banner.className = 'form-message ' + (this._lastBulkMessage.ok ? 'success' : 'error');
        banner.textContent = this._lastBulkMessage.text;
      }
    }
  },

  showAddQuestion() {
    this._questionFormModal(null);
  },



  // ----- Bulk Upload -----
  showBulkUpload() {
    const body = `
      <p style="font-size:0.9rem;margin-bottom:12px;color:var(--text-secondary);">
        Upload <strong>CSV</strong>, <strong>XLS / XLSX</strong>, or <strong>JSON</strong>.
        Headers are matched automatically. Extra columns are ignored.
        Duplicate questions (same subject, unit, and question text) are skipped.
      </p>
      <p style="font-size:0.8rem;margin-bottom:12px;background:var(--bg);padding:10px;border-radius:8px;line-height:1.55;">
        <strong>Needed columns:</strong> Question, Option A, Correct Answer (A–D).<br>
        <strong>Useful:</strong> Subject, Unit / Chapter, Session, Option B–D, Explanation, Difficulty.
      </p>
      <div class="form-group">
        <label>Select file</label>
        <input type="file" id="bulk-file" accept=".csv,.xls,.xlsx,.json,text/csv,application/json" />
      </div>
      <div id="bulk-message" class="form-message"></div>
    `;
    const footer = `
      <button class="btn btn-secondary" type="button" onclick="App.closeModal()">Close</button>
      <button class="btn btn-primary" type="button" onclick="App.processBulkUpload()">Upload & Import</button>
    `;
    this.openModal('Bulk Upload Questions', body, footer);
  },

  processBulkUpload() {
    const fileInput = document.getElementById('bulk-file');
    const msg = document.getElementById('bulk-message');
    if (!fileInput?.files?.length) {
      msg.textContent = 'Please select a CSV, Excel, or JSON file.';
      msg.className = 'form-message error';
      return;
    }
    const file = fileInput.files[0];
    const name = file.name.toLowerCase();
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let matrix = [];
        if (name.endsWith('.json')) {
          const parsed = JSON.parse(String(e.target.result).replace(/^\uFEFF/, ''));
          const arr = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.data || []);
          if (!Array.isArray(arr) || !arr.length) throw new Error('JSON must be an array of question objects.');
          const keys = [...new Set(arr.flatMap(o => Object.keys(o || {})))];
          matrix = [keys, ...arr.map(o => keys.map(k => o[k] == null ? '' : String(o[k])))];
        } else if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
          if (typeof XLSX === 'undefined') throw new Error('Excel reader not loaded. Refresh the page and try again.');
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
        } else if (name.endsWith('.csv')) {
          const clean = String(e.target.result).replace(/^\uFEFF/, '');
          matrix = clean.split(/\r?\n/).filter(l => l.trim()).map(l => this._parseCSVLine(l));
        } else {
          throw new Error('Unsupported file. Use .csv, .xls, .xlsx, or .json.');
        }
        await this._importQuestionMatrix(matrix, msg);
      } catch (err) {
        msg.textContent = 'Could not read file: ' + err.message;
        msg.className = 'form-message error';
        this._showBulkBanner(msg.textContent, false);
      }
    };
    if (name.endsWith('.xls') || name.endsWith('.xlsx')) reader.readAsArrayBuffer(file);
    else reader.readAsText(file, 'UTF-8');
  },

  _qFingerprint(subject, unit, question) {
    return [subject, unit, question].map(s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()).join('|');
  },

  async _importQuestionMatrix(matrix, msg) {
    matrix = (matrix || []).filter(r => r && r.some(c => String(c || '').trim()));
    if (matrix.length < 2) {
      msg.textContent = 'File is empty or has no data rows.';
      msg.className = 'form-message error';
      this._showBulkBanner(msg.textContent, false);
      return;
    }
    const rawHeaders = matrix[0].map(h => String(h || '').trim());
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/\s+/g, ' ').trim());
    const ignored = [];
    const findCol = (...patterns) => {
      for (const p of patterns) {
        const exact = p.startsWith('=');
        const needle = exact ? p.slice(1) : p;
        const idx = headers.findIndex(h => exact ? h === needle : h.includes(needle));
        if (idx >= 0) return idx;
      }
      return -1;
    };
    const col = {
      subject: findCol('=subject', 'subject'),
      unit: findCol('=unit', 'unit', 'chapter'),
      session: findCol('=session', 'session'),
      question: findCol('=question', 'question'),
      optionA: findCol('option a'),
      optionB: findCol('option b'),
      optionC: findCol('option c'),
      optionD: findCol('option d'),
      answer: findCol('correct answer', 'right answer', '=answer'),
      explanation: findCol('explanation'),
      difficulty: findCol('difficulty')
    };
    const used = new Set(Object.values(col).filter(i => i >= 0));
    rawHeaders.forEach((h, i) => { if (h && !used.has(i)) ignored.push(h); });

    if (col.question < 0 || col.optionA < 0 || col.answer < 0) {
      const text = 'Missing required columns: Question, Option A, and Correct Answer. Found headers: ' + (rawHeaders.filter(Boolean).join(', ') || '(none)');
      msg.textContent = text;
      msg.className = 'form-message error';
      this._showBulkBanner(text, false);
      return;
    }

    const seen = new Set(Questions.getAll().map(q => this._qFingerprint(q.subject || q.category, q.unit || q.questionBank, q.question)));
    const toAdd = [];
    let skipped = 0, dupes = 0;
    const reasons = [];
    for (let i = 1; i < matrix.length; i++) {
      const cols = matrix[i].map(c => c == null ? '' : String(c));
      const get = (idx) => (idx >= 0 && cols[idx] !== undefined) ? String(cols[idx]).trim() : '';
      const qText = get(col.question);
      if (!qText) { skipped++; continue; }
      let answer = get(col.answer).toUpperCase().trim().replace(/^OPTION\s*/, '').replace(/[^A-D]/g, '');
      if (answer.length > 1) answer = answer.charAt(0);
      if (!['A', 'B', 'C', 'D'].includes(answer)) {
        skipped++;
        if (reasons.length < 5) reasons.push('Row ' + (i + 1) + ': answer must be A, B, C, or D');
        continue;
      }
      let diff = get(col.difficulty) || 'Medium';
      const dl = diff.toLowerCase();
      if (/easy/.test(dl)) diff = 'Easy';
      else if (/hard|tough/.test(dl)) diff = 'Hard';
      else if (/medium|moderate/.test(dl)) diff = 'Medium';
      else diff = 'Medium';
      const subject = get(col.subject) || 'General';
      const unit = get(col.unit) || 'General';
      const session = get(col.session) || '';
      const fp = this._qFingerprint(subject, unit, qText);
      if (seen.has(fp)) { dupes++; continue; }
      seen.add(fp);
      toAdd.push({
        subject, unit, session, category: subject, questionBank: unit, relevantSession: session,
        question: qText,
        optionA: get(col.optionA), optionB: get(col.optionB), optionC: get(col.optionC), optionD: get(col.optionD),
        correctAnswer: answer, rightAnswer: answer,
        explanation: get(col.explanation), difficulty: diff, timerSeconds: 45, locked: false
      });
    }
    if (!toAdd.length) {
      const text = 'Nothing new to add. Duplicates skipped: ' + dupes + '. Invalid rows: ' + skipped + (reasons.length ? '. ' + reasons.join('; ') : '');
      msg.textContent = text;
      msg.className = 'form-message error';
      this._showBulkBanner(text, false);
      return;
    }
    toAdd.forEach(q => Questions.add(q));
    const sheetsNote = (typeof API !== 'undefined' && API.isEnabled())
      ? 'Each new question was sent to Google Sheets.'
      : 'Saved locally (Sheets not connected).';
    const matched = rawHeaders.filter((h, i) => used.has(i) && h);
    const text = [
      'Upload complete.',
      'Added: ' + toAdd.length + '.',
      'Duplicates skipped: ' + dupes + '.',
      'Invalid / blank rows skipped: ' + skipped + '.',
      'Matched columns: ' + matched.join(', ') + '.',
      ignored.length ? ('Ignored extra columns: ' + ignored.join(', ') + '.') : '',
      reasons.length ? reasons.join('; ') : '',
      sheetsNote
    ].filter(Boolean).join(' ');
    msg.textContent = text;
    msg.className = 'form-message ' + (sheetsNote.startsWith('Sheets error') || sheetsNote.startsWith('Sheets sync') ? 'error' : 'success');
    this._showBulkBanner(text, !(sheetsNote.startsWith('Sheets error') || sheetsNote.startsWith('Sheets sync')));
    this.renderView('questions');
    const banner = document.getElementById('bulk-result-banner');
    if (banner) {
      banner.style.display = 'block';
      banner.className = 'form-message ' + (msg.className.includes('error') ? 'error' : 'success');
      banner.textContent = text;
    }
  },

  _showBulkBanner(text, ok) {
    this._lastBulkMessage = { text, ok };
  },

  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  },

  // ----- Export Question Bank PDF -----
  exportQuestionBankPDF() {
    if (typeof PDF === 'undefined') return alert('PDF library not loaded. Please refresh.');
    const questions = this._getFilteredQuestions();
    const filters = {
      category: document.getElementById('q-filter-category')?.value || '',
      session: document.getElementById('q-filter-session')?.value || '',
      difficulty: document.getElementById('q-filter-difficulty')?.value || ''
    };
    PDF.exportQuestionBank(questions, filters);
  },

  editQuestion(qNo) {
    const q = Questions.getById(qNo);
    if (q) this._questionFormModal(q);
  },


  _questionFormModal(q) {
    const isEdit = !!q;
    const title = isEdit ? `Edit Question #${q.qNo}` : 'Add New Question';
    const subject = q?.subject || q?.category || '';
    const unit = q?.unit || q?.questionBank || '';
    const session = q?.session || q?.relevantSession || '';
    const ans = (q?.correctAnswer || q?.rightAnswer || 'A').toUpperCase();

    const body = `
      <div class="form-group">
        <label>Subject *</label>
        <input type="text" id="qf-subject" value="${subject}" placeholder="e.g. Physics" required />
      </div>
      <div class="form-group">
        <label>Unit *</label>
        <input type="text" id="qf-unit" value="${unit}" placeholder="e.g. Laws of Motion" required />
      </div>
      <div class="form-group">
        <label>Session *</label>
        <input type="text" id="qf-session" value="${session}" placeholder="e.g. Session 1" required />
      </div>
      <div class="form-group">
        <label>Difficulty</label>
        <select id="qf-difficulty">
          <option value="Easy" ${q?.difficulty === 'Easy' ? 'selected' : ''}>Easy</option>
          <option value="Medium" ${q?.difficulty === 'Medium' || !q ? 'selected' : ''}>Medium</option>
          <option value="Hard" ${q?.difficulty === 'Hard' ? 'selected' : ''}>Hard</option>
        </select>
      </div>
      <div class="form-group">
        <label>Question *</label>
        <textarea id="qf-question" rows="3" required>${q?.question || ''}</textarea>
      </div>
      <div class="form-group"><label>Option A *</label><input id="qf-a" value="${q?.optionA || ''}" required /></div>
      <div class="form-group"><label>Option B *</label><input id="qf-b" value="${q?.optionB || ''}" required /></div>
      <div class="form-group"><label>Option C *</label><input id="qf-c" value="${q?.optionC || ''}" required /></div>
      <div class="form-group"><label>Option D *</label><input id="qf-d" value="${q?.optionD || ''}" required /></div>
      <div class="form-group">
        <label>Correct Answer *</label>
        <select id="qf-answer">
          <option value="A" ${ans === 'A' ? 'selected' : ''}>A</option>
          <option value="B" ${ans === 'B' ? 'selected' : ''}>B</option>
          <option value="C" ${ans === 'C' ? 'selected' : ''}>C</option>
          <option value="D" ${ans === 'D' ? 'selected' : ''}>D</option>
        </select>
      </div>
      <div class="form-group">
        <label>Explanation</label>
        <textarea id="qf-explanation" rows="2">${q?.explanation || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Timer (seconds)</label>
        <select id="qf-timer">
          <option value="60" ${q?.timerSeconds === 60 ? 'selected' : ''}>60 sec</option>
          <option value="45" ${!q || q?.timerSeconds === 45 ? 'selected' : ''}>45 sec</option>
          <option value="30" ${q?.timerSeconds === 30 ? 'selected' : ''}>30 sec</option>
          <option value="15" ${q?.timerSeconds === 15 ? 'selected' : ''}>15 sec</option>
        </select>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="App.saveQuestion(${isEdit ? q.qNo : 'null'})">
        ${isEdit ? 'Update Question' : 'Add Question'}
      </button>
    `;
    this.openModal(title, body, footer);
  },

  saveQuestion(qNo) {
    const data = {
      subject: document.getElementById('qf-subject').value.trim(),
      unit: document.getElementById('qf-unit').value.trim(),
      session: document.getElementById('qf-session').value.trim(),
      category: document.getElementById('qf-subject').value.trim(),
      questionBank: document.getElementById('qf-unit').value.trim(),
      relevantSession: document.getElementById('qf-session').value.trim(),
      difficulty: document.getElementById('qf-difficulty').value,
      question: document.getElementById('qf-question').value.trim(),
      optionA: document.getElementById('qf-a').value.trim(),
      optionB: document.getElementById('qf-b').value.trim(),
      optionC: document.getElementById('qf-c').value.trim(),
      optionD: document.getElementById('qf-d').value.trim(),
      correctAnswer: document.getElementById('qf-answer').value,
      rightAnswer: document.getElementById('qf-answer').value,
      explanation: document.getElementById('qf-explanation').value.trim(),
      timerSeconds: parseInt(document.getElementById('qf-timer').value, 10),
      locked: false
    };

    if (!data.category || !data.question || !data.optionA || !data.optionB) {
      alert('Please fill required fields.');
      return;
    }

    if (qNo) {
      Questions.update(qNo, data);
    } else {
      Questions.add(data);
    }
    this.closeModal();
    this.renderView('questions');
  },

  toggleQuestionLock(qNo) {
    Questions.toggleLock(qNo);
    this.renderView('questions');
  },

  deleteQuestion(qNo) {
    if (confirm(`Delete question #${qNo}?`)) {
      Questions.remove(qNo);
      this.renderView('questions');
    }
  },

  // ========== REPORTS ==========
  viewReports() {
    return `
      <div class="card">
        <div class="card-header">
          <h3>Quiz Attempts Report</h3>
        </div>

        <!-- Filters -->
        <div class="toolbar" style="margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <input type="text" class="search-input" id="report-search" placeholder="Search name, email, or chapter..." style="min-width:180px;" />
          
          <select id="report-category" class="search-input" style="min-width:140px;">
            <option value="">All Subjects</option>
          </select>

          <select id="report-unit" class="search-input" style="min-width:160px;">
            <option value="">All Chapters</option>
          </select>

          <select id="report-sort" class="search-input" style="min-width:160px;">
            <option value="date-desc">Date (Newest first)</option>
            <option value="date-asc">Date (Oldest first)</option>
            <option value="email-asc">Student (A-Z)</option>
            <option value="email-desc">Student (Z-A)</option>
            <option value="percentage-desc">Score % (High → Low)</option>
            <option value="percentage-asc">Score % (Low → High)</option>
            <option value="category-asc">Category (A-Z)</option>
          </select>

          <button class="btn btn-secondary btn-sm" id="btn-clear-filters" type="button">Clear Filters</button>
          <button class="btn btn-primary btn-sm" type="button" onclick="App.exportAttempts('pdf')">PDF</button>
          <button class="btn btn-secondary btn-sm" type="button" onclick="App.exportAttempts('xlsx')">XLSX</button>
          <button class="btn btn-secondary btn-sm" type="button" onclick="App.exportAttempts('csv')">CSV</button>
          <button class="btn btn-secondary btn-sm" type="button" onclick="App.exportAttempts('docx')">DOCX</button>
          <button class="btn btn-secondary btn-sm" type="button" onclick="App.exportAttempts('txt')">TXT</button>
        </div>
        <div class="batch-bar" id="rep-batch" hidden>
          <strong id="rep-batch-count">0 selected</strong>
          <button class="btn btn-sm btn-danger" type="button" onclick="App.batchDeleteAttempts()">Delete selected attempts</button>
        </div>

        <div id="report-table-container">
          ${this._renderReportTable()}
        </div>
      </div>
    `;
  },

  _getFilteredAttempts() {
    let attempts = Admin.getRecentAttempts(500); // get more for filtering

    // Populate filter dropdowns if needed (done in bind)
    const search = (document.getElementById('report-search')?.value || '').toLowerCase();
    const category = document.getElementById('report-category')?.value || '';
    const unit = document.getElementById('report-unit')?.value || '';
    const sort = document.getElementById('report-sort')?.value || 'date-desc';

    // Filter
    if (search) {
      attempts = attempts.filter(a => {
        const email = (a.email || '').toLowerCase();
        const user = Storage.findUser(a.email);
        const name = (user?.name || a.name || '').toLowerCase();
        const unitName = (a.unit || a.questionBank || '').toLowerCase();
        const sessionName = (a.session || '').toLowerCase();
        return email.includes(search) || name.includes(search) || unitName.includes(search) || sessionName.includes(search);
      });
    }
    if (category) {
      attempts = attempts.filter(a => (a.category || a.subject) === category);
    }
    if (unit) {
      attempts = attempts.filter(a => (a.unit || a.questionBank || '') === unit);
    }

    // Sort
    attempts.sort((a, b) => {
      switch (sort) {
        case 'date-asc':
          return new Date(a.completedAt || 0) - new Date(b.completedAt || 0);
        case 'date-desc':
          return new Date(b.completedAt || 0) - new Date(a.completedAt || 0);
        case 'email-asc':
          return (a.email || '').localeCompare(b.email || '');
        case 'email-desc':
          return (b.email || '').localeCompare(a.email || '');
        case 'percentage-desc':
          return (b.percentage || 0) - (a.percentage || 0);
        case 'percentage-asc':
          return (a.percentage || 0) - (b.percentage || 0);
        case 'category-asc':
          return (a.category || '').localeCompare(b.category || '');
        default:
          return 0;
      }
    });

    return attempts;
  },

  _renderReportTable() {
    const attempts = this._getFilteredAttempts();

    if (attempts.length === 0) {
      return `<div class="empty-state"><div class="icon">📈</div><p>No matching attempts found.</p></div>`;
    }

    return `
      <p style="margin-bottom:10px;color:var(--text-muted);font-size:0.85rem;">
        Showing <strong>${attempts.length}</strong> attempt(s)
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" id="rep-check-all" aria-label="Select all attempts" /></th>
              <th class="sortable">Student</th>
              <th class="sortable">Date & Time</th>
              <th class="sortable">Subject</th>
              <th class="sortable">Chapter</th>
              <th class="sortable">Session</th>
              <th class="sortable">Difficulty</th>
              <th class="sortable">Score</th>
              <th class="sortable">%</th>
              <th class="sortable">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${attempts.map(a => `
              <tr>
                <td><input type="checkbox" class="rep-check" value="${a.id || ''}" data-email="${a.email}" data-when="${a.completedAt || ''}" aria-label="Select attempt" /></td>
                <td><strong>${(Storage.findUser(a.email)?.name || a.name || (a.email || '').split('@')[0])}</strong><br><small style="color:var(--text-muted)">${a.email}</small></td>
                <td>${App.formatDisplayDateTime(a.date, a.time)}</td>
                <td>${a.subject || a.category || '—'}</td>
                <td>${a.unit || a.questionBank || '—'}</td>
                <td>${a.session || '—'}</td>
                <td>${a.difficulty || '—'}</td>
                <td>${a.correct}/${a.total}</td>
                <td><strong>${a.percentage}%</strong></td>
                <td>${a.durationSec ? Math.floor(a.durationSec/60)+'m '+(a.durationSec%60)+'s' : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // Called after rendering reports view
  bindReportsEvents() {
    // Populate category & session dropdowns
    const attempts = Admin.getRecentAttempts(500);
    const categories = [...new Set(attempts.map(a => a.category || a.subject).filter(Boolean))].sort();
    const units = [...new Set(attempts.map(a => a.unit || a.questionBank).filter(Boolean))].sort();

    const catSelect = document.getElementById('report-category');
    const unitSelect = document.getElementById('report-unit');

    if (catSelect) {
      catSelect.innerHTML = '<option value="">All Subjects</option>' +
        categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    if (unitSelect) {
      unitSelect.innerHTML = '<option value="">All Chapters</option>' +
        units.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    const refresh = () => {
      const container = document.getElementById('report-table-container');
      if (container) container.innerHTML = this._renderReportTable();
      this._wireSort('report-table-container');
      const updateRep = () => {
        const n = document.querySelectorAll('.rep-check:checked').length;
        const bar = document.getElementById('rep-batch');
        if (bar) bar.hidden = n === 0;
        const label = document.getElementById('rep-batch-count');
        if (label) label.textContent = n + ' selected';
      };
      document.getElementById('rep-check-all')?.addEventListener('change', e => {
        document.querySelectorAll('.rep-check').forEach(c => { c.checked = e.target.checked; });
        updateRep();
      });
      document.querySelectorAll('.rep-check').forEach(c => c.addEventListener('change', updateRep));
    };

    document.getElementById('report-search')?.addEventListener('input', refresh);
    document.getElementById('report-category')?.addEventListener('change', refresh);
    document.getElementById('report-unit')?.addEventListener('change', refresh);
    document.getElementById('report-sort')?.addEventListener('change', refresh);

    document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
      if (document.getElementById('report-search')) document.getElementById('report-search').value = '';
      if (catSelect) catSelect.value = '';
      if (unitSelect) unitSelect.value = '';
      if (document.getElementById('report-sort')) document.getElementById('report-sort').value = 'date-desc';
      refresh();
    });

    document.getElementById('btn-export-attempts-pdf')?.addEventListener('click', () => {
      this.exportAttempts('pdf');
    });
  },

  // ========== SETTINGS ==========

  // ----- Bulk Students -----
  showBulkStudents() {
    const body = `
      <p style="font-size:0.9rem;margin-bottom:12px;color:var(--text-secondary);">
        Upload CSV with headers: <code>Name, Email, Mobile, Password</code><br>
        If Password is blank, a temporary password <code>Temp####</code> is generated.
      </p>
      <div class="form-group">
        <label>CSV File</label>
        <input type="file" id="bulk-students-file" accept=".csv,text/csv" />
      </div>
      <div id="bulk-students-msg" class="form-message"></div>
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="App.processBulkStudents()">Import Students</button>
    `;
    this.openModal('Bulk Create Students', body, footer);
  },

  processBulkStudents() {
    const fileInput = document.getElementById('bulk-students-file');
    const msg = document.getElementById('bulk-students-msg');
    if (!fileInput?.files?.length) {
      msg.textContent = 'Select a CSV file.';
      msg.className = 'form-message error';
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const lines = String(e.target.result).replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          msg.textContent = 'No data rows found.';
          msg.className = 'form-message error';
          return;
        }
        const headers = this._parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
        const find = (...names) => headers.findIndex(h => names.some(n => h === n || h.includes(n)));
        const cName = find('name', 'full name');
        const cEmail = find('email');
        const cMobile = find('mobile', 'phone');
        const cPass = find('password', 'temp password');
        if (cEmail < 0) {
          msg.textContent = 'CSV must include an Email column.';
          msg.className = 'form-message error';
          return;
        }
        const users = [];
        const temps = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = this._parseCSVLine(lines[i]);
          const email = (cols[cEmail] || '').trim().toLowerCase();
          if (!email) continue;
          let password = cPass >= 0 ? (cols[cPass] || '').trim() : '';
          if (!password) {
            password = 'Temp' + Math.floor(1000 + Math.random() * 9000);
            temps.push(email + ' → ' + password);
          }
          const mobile = cMobile >= 0 ? String(cols[cMobile] || '').replace(/\D/g, '').slice(0, 10) : '0000000000';
          const name = cName >= 0 ? (cols[cName] || '').trim() : email.split('@')[0];
          users.push({ email, mobile: mobile.length === 10 ? mobile : '0000000000', password, name });
        }
        if (!users.length) {
          msg.textContent = 'No valid student rows.';
          msg.className = 'form-message error';
          return;
        }
        let added = 0, skipped = 0;
        for (const u of users) {
          if (Storage.findUser(u.email)) { skipped++; continue; }
          const passwordHash = await this.sha256Hex(u.password);
          const newUser = {
            id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            email: u.email,
            mobile: u.mobile,
            name: u.name,
            passwordHash,
            createdAt: new Date().toISOString(),
            lastLogin: null,
            isLocked: false,
            timerLocked: false,
            forcedTimer: 45
          };
          Storage.saveUser(newUser);
          if (typeof API !== 'undefined' && API.isEnabled()) {
            try {
              await API.registerUser({ email: u.email, mobile: u.mobile, password: u.password, name: u.name });
            } catch (err) {}
          }
          added++;
        }
        let message = `Imported ${added} students` + (skipped ? `, skipped ${skipped} (already exist)` : '') + '.';
        if (temps.length) message += ' Temp passwords: ' + temps.slice(0, 5).join('; ') + (temps.length > 5 ? '…' : '');
        msg.textContent = message;
        msg.className = 'form-message success';
        setTimeout(() => { this.closeModal(); this.renderView('users'); }, 2500);
      } catch (err) {
        msg.textContent = 'Error: ' + err.message;
        msg.className = 'form-message error';
      }
    };
    reader.readAsText(fileInput.files[0], 'UTF-8');
  },

  /** Unit-wise analytics HTML for dashboard */
  _unitAnalyticsHTML() {
    const attempts = Admin.getRecentAttempts(1000);
    const byUnit = {};
    attempts.forEach(a => {
      const sub = a.subject || a.category || 'General';
      const unit = a.unit || 'General';
      const key = sub + '|||' + unit;
      if (!byUnit[key]) byUnit[key] = { subject: sub, unit, attempts: 0, correct: 0, total: 0, pctSum: 0 };
      byUnit[key].attempts++;
      byUnit[key].correct += Number(a.correct) || 0;
      byUnit[key].total += Number(a.total) || 0;
      byUnit[key].pctSum += Number(a.percentage) || 0;
    });
    const rows = Object.values(byUnit)
      .map(r => ({ ...r, avg: r.attempts ? Math.round(r.pctSum / r.attempts) : 0 }))
      .sort((a, b) => a.avg - b.avg);
    if (!rows.length) {
      return `<div class="card"><div class="card-header"><h3>Unit-wise Performance</h3></div>
        <p style="color:var(--text-muted);padding:8px 0;">No attempts yet.</p></div>`;
    }
    return `
      <div class="card" style="margin-top:16px;">
        <div class="card-header"><h3>Unit-wise Performance</h3>
          <small style="color:var(--text-muted);">Weakest units first</small>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Subject</th><th>Unit</th><th>Attempts</th><th>Avg %</th><th>Correct/Total</th></tr></thead>
            <tbody>
              ${rows.slice(0, 15).map(r => `
                <tr>
                  <td>${r.subject}</td>
                  <td>${r.unit}</td>
                  <td>${r.attempts}</td>
                  <td><strong style="color:${r.avg < 50 ? '#991b1b' : r.avg < 70 ? '#b45309' : '#166534'}">${r.avg}%</strong></td>
                  <td>${r.correct}/${r.total}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  exportAttemptsCSV() {
    const attempts = this._getFilteredAttempts ? this._getFilteredAttempts() : Admin.getRecentAttempts(2000);
    if (!attempts.length) {
      alert('No attempts to export.');
      return;
    }
    const headers = ['Name', 'Email', 'Subject', 'Unit', 'Session', 'Difficulty', 'Total', 'Correct', 'Wrong', 'Percentage', 'Date', 'Time', 'DurationSec'];
    const lines = [headers.join(',')];
    attempts.forEach(a => {
      const user = Storage.findUser(a.email);
      const name = (user?.name || a.name || '').replace(/"/g, '""');
      const row = [
        `"${name}"`,
        a.email || '',
        a.subject || a.category || '',
        a.unit || '',
        a.session || '',
        a.difficulty || '',
        a.total ?? '',
        a.correct ?? '',
        a.wrong ?? '',
        a.percentage ?? '',
        a.date || '',
        a.time || '',
        a.durationSec ?? ''
      ];
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'quiz-attempts-' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  },

  viewSettings() {
    const s = Storage.getSettings();
    return `
      <div class="card">
        <div class="card-header"><h3>Timer Settings</h3></div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="set-lock-timers" ${s.lockAllTimers ? 'checked' : ''} />
            Lock timer choice for all students (Admin decides the timer)
          </label>
        </div>
        <div class="form-group" style="margin-top:16px;">
          <label>
            <input type="checkbox" id="set-lock-difficulty" ${s.lockAllDifficulty ? 'checked' : ''} />
            Lock difficulty choice for all students
          </label>
        </div>
        <div class="form-group">
          <label>Default difficulty (when locked)</label>
          <select id="set-default-difficulty">
            <option value="All" ${!s.defaultDifficulty || s.defaultDifficulty === 'All' ? 'selected' : ''}>All</option>
            <option value="Easy" ${s.defaultDifficulty === 'Easy' ? 'selected' : ''}>Easy</option>
            <option value="Medium" ${s.defaultDifficulty === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="Hard" ${s.defaultDifficulty === 'Hard' ? 'selected' : ''}>Hard</option>
          </select>
        </div>
        <div class="form-group" style="margin-top:16px;">
          <label>
            <input type="checkbox" id="set-lock-review" ${s.lockReview ? 'checked' : ''} />
            Lock quiz question review for all students (hide explanations and Review Answers)
          </label>
        </div>
        <div class="form-group">
          <label>Default Timer (when locked)</label>
          <select id="set-default-timer">
            <option value="60" ${s.defaultTimer === 60 ? 'selected' : ''}>1 minute</option>
            <option value="45" ${s.defaultTimer === 45 ? 'selected' : ''}>45 seconds</option>
            <option value="30" ${s.defaultTimer === 30 ? 'selected' : ''}>30 seconds</option>
            <option value="15" ${s.defaultTimer === 15 ? 'selected' : ''}>15 seconds</option>
          </select>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>PDF Watermark Settings</h3></div>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:14px;">
          Every PDF generated in the system will carry a watermark.
        </p>
        <div class="form-group">
          <label>Watermark Mode</label>
          <select id="set-wm-mode">
            <option value="default" ${s.watermarkMode !== 'custom' ? 'selected' : ''}>
              Default Name (auto-generated based on report purpose)
            </option>
            <option value="custom" ${s.watermarkMode === 'custom' ? 'selected' : ''}>
              Customized Text
            </option>
          </select>
        </div>
        <div class="form-group" id="wm-custom-group" style="${s.watermarkMode === 'custom' ? '' : 'display:none;'}">
          <label>Custom Watermark Text</label>
          <input type="text" id="set-wm-custom" value="${s.watermarkCustom || 'MCQ Quiz Module'}"
            placeholder="e.g. MCQ Quiz Module – Confidential" />
        </div>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">
          <strong>Default Name example:</strong><br>
          “Physics – Session 1 – Work, Energy & Power – Question Bank (Easy Questions)”
        </p>
      </div>

      <button class="btn btn-primary" id="btn-save-settings">Save All Settings</button>

      <div class="card" style="margin-top:20px;">
        <div class="card-header"><h3>System Info</h3></div>
        <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;">
          <strong>MVP Version</strong><br>
          Data is stored in browser localStorage.<br>
          Student Panel and Admin Panel share the same storage keys when opened on the same browser/device.<br>
          Later this will be replaced by Google Sheets + Apps Script for multi-device sync.
        </p>
      </div>
    `;
  },

  bindSettingsEvents() {
    document.getElementById('set-wm-mode')?.addEventListener('change', e => {
      document.getElementById('wm-custom-group').style.display =
        e.target.value === 'custom' ? '' : 'none';
    });

    document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
      const s = Storage.getSettings();
      s.lockAllTimers = document.getElementById('set-lock-timers').checked;
      s.lockAllDifficulty = document.getElementById('set-lock-difficulty')?.checked || false;
      s.defaultDifficulty = document.getElementById('set-default-difficulty')?.value || 'All';
      s.lockReview = document.getElementById('set-lock-review')?.checked || false;
      s.defaultTimer = parseInt(document.getElementById('set-default-timer').value);
      s.watermarkMode = document.getElementById('set-wm-mode').value;
      s.watermarkCustom = document.getElementById('set-wm-custom')?.value || 'MCQ Quiz Module';
      Storage.saveSettings(s);
      if (typeof API !== 'undefined' && API.isEnabled()) {
        await API.saveSettings(s);
      }
      alert('Settings saved successfully!' + (API.isEnabled() ? ' (synced to Google Sheets)' : ''));
    });
  },


  async pushLocalQuestionsToSheets() {
    if (typeof API === 'undefined' || !API.isEnabled()) {
      alert('Google Sheets is not connected. Set API_URL and USE_GOOGLE_SHEETS in config.js first.');
      return;
    }
    const list = Questions.getAll();
    if (!list.length) {
      alert('No local questions to push.');
      return;
    }
    if (!confirm('Push ' + list.length + ' local questions to Google Sheets?\n\nThis ADDS them to the sheet (does not clear existing rows).')) return;
    const res = await API.bulkAddQuestions(list);
    if (res && res.error) {
      alert('Failed: ' + res.error);
      return;
    }
    await Questions.syncFromCloud();
    alert('Pushed ' + (res.added || list.length) + ' questions. Sheet is now the source of truth.');
    this.renderView('questions');
  },


  updateSheetsStatus() {
    const el = document.getElementById('sheets-status');
    const top = document.getElementById('sheets-status-top');
    const enabled = typeof API !== 'undefined' && API.isEnabled();
    let html, bg, color, topText;
    if (enabled) {
      bg = '#dcfce7'; color = '#166534';
      html = '☁ <strong>Google Sheets enabled</strong><br>URL is set. Click Sync after login. If data still missing, check deployment (Anyone + /exec).';
      topText = '☁ Sheets ON';
    } else {
      bg = '#fef3c7'; color = '#92400e';
      const reason = !window.CONFIG ? 'CONFIG missing'
        : !CONFIG.USE_GOOGLE_SHEETS ? 'USE_GOOGLE_SHEETS is false'
        : !CONFIG.API_URL ? 'API_URL is empty'
        : 'API_URL invalid';
      html = '⚠ <strong>Local-only mode</strong> (' + reason + ')<br>Edit <code>js/config.js</code>: set API_URL + USE_GOOGLE_SHEETS: true, then push to GitHub.';
      topText = '⚠ Local only';
    }
    if (el) {
      el.style.background = bg;
      el.style.color = color;
      el.innerHTML = html;
    }
    if (top) {
      top.innerHTML = enabled
        ? '<button type="button" id="btn-top-sync" class="btn btn-sm" style="background:#dcfce7;color:#166534;border:1px solid #166534;font-weight:700;" onclick="App.runTopSync()">Sheets ON · Sync</button>'
        : '<span style="font-size:0.75rem;padding:4px 8px;border-radius:6px;background:#fef3c7;color:#92400e;">Local only</span>';
    }
  },

  // ---------- Modal helpers ----------
  openModal(title, bodyHTML, footerHTML = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  async runTopSync(silent) {
    this._setSyncBanner('Syncing Data…', 'info');
    const btn = document.getElementById('btn-top-sync');
    if (btn) btn.textContent = 'Syncing…';
    try {
      if (typeof Questions !== 'undefined' && Questions.flushOutbox) await Questions.flushOutbox();
      if (typeof Questions !== 'undefined' && Questions.syncFromCloud) await Questions.syncFromCloud();
      await this.syncCloudData();
      if (this.currentView) this.renderView(this.currentView);
      this.updateSheetsStatus();
      const done = document.getElementById('btn-top-sync');
      if (done) done.textContent = 'Sheets ON · Synced';
      if (!silent) this._setSyncBanner('Sync complete', 'success');
    } catch (e) {
      this.updateSheetsStatus();
      this._setSyncBanner('Sync failed: ' + (e.message || 'error'), 'error');
    }
  },

  _wireSort(rootId) {
    const el = document.getElementById(rootId);
    const table = !el ? null : (el.tagName === 'TABLE' ? el : (el.querySelector('table') || el.closest('table')));
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    table.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = [...th.parentElement.children].indexOf(th);
        const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc';
        table.querySelectorAll('th.sortable').forEach(h => {
          h.dataset.dir = '';
          h.textContent = h.textContent.replace(/ [↑↓]$/, '');
        });
        th.dataset.dir = dir;
        th.textContent = th.textContent.replace(/ [↑↓]$/, '') + (dir === 'asc' ? ' ↑' : ' ↓');
        const rows = [...tbody.querySelectorAll('tr')];
        rows.sort((a, b) => {
          const av = (a.children[col]?.innerText || '').trim();
          const bv = (b.children[col]?.innerText || '').trim();
          const an = parseFloat(av.replace('%', ''));
          const bn = parseFloat(bv.replace('%', ''));
          const numeric = av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn) && /^[\d.]/.test(av) && /^[\d.]/.test(bv);
          const cmp = numeric ? an - bn : av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
          return dir === 'asc' ? cmp : -cmp;
        });
        rows.forEach(r => tbody.appendChild(r));
      });
    });
  },

  batchUsers(action) {
    const emails = [...document.querySelectorAll('.user-check:checked')].map(c => c.value);
    if (!emails.length) return;
    if (action === 'delete' && !confirm('Delete ' + emails.length + ' selected users and their attempts?')) return;
    emails.forEach(email => {
      if (action === 'delete') {
        Admin.deleteUser(email);
        if (typeof API !== 'undefined' && API.isEnabled()) API.deleteUser(email).catch(() => {});
      } else {
        const lock = action === 'lock';
        Admin.lockUser(email, lock);
        if (typeof API !== 'undefined' && API.isEnabled()) API.updateUser({ email, isLocked: lock }).catch(() => {});
      }
    });
    this.renderView('users');
  },

  batchQuestions(action) {
    const ids = [...document.querySelectorAll('.q-check:checked')].map(c => Number(c.value));
    if (!ids.length) return;
    if (action === 'delete' && !confirm('Delete ' + ids.length + ' selected questions?')) return;
    ids.forEach(qNo => {
      if (action === 'delete') Questions.remove(qNo);
      else {
        const q = Questions.getById(qNo);
        if (!q) return;
        const shouldLock = action === 'lock';
        if (!!q.locked !== shouldLock) Questions.toggleLock(qNo);
      }
    });
    this.renderView('questions');
  },

  batchDeleteAttempts() {
    const boxes = [...document.querySelectorAll('.rep-check:checked')];
    if (!boxes.length) return;
    if (!confirm('Delete ' + boxes.length + ' selected attempt records from this device?')) return;
    const all = Storage.getAllAttempts();
    boxes.forEach(box => {
      const email = box.dataset.email;
      const id = box.value;
      const when = box.dataset.when;
      Object.keys(all).forEach(key => {
        if (key.toLowerCase() !== String(email || '').toLowerCase()) return;
        all[key] = (all[key] || []).filter(a => {
          if (id && a.id && a.id === id) return false;
          if (!id && when && a.completedAt === when) return false;
          return true;
        });
      });
    });
    Storage.set(Storage.KEYS.ATTEMPTS, all);
    this.renderView('reports');
  },

  exportAttempts(format) {
    const attempts = this._getFilteredAttempts();
    if (!attempts.length) return alert('No attempts to export.');
    const headers = ['Name', 'Email', 'Subject', 'Chapter', 'Session', 'Difficulty', 'Total', 'Correct', 'Wrong', 'Percentage', 'Date', 'Time', 'DurationSec'];
    const rows = attempts.map(a => {
      const user = Storage.findUser(a.email);
      return [
        user?.name || a.name || '',
        a.email || '',
        a.subject || a.category || '',
        a.unit || a.questionBank || '',
        a.session || '',
        a.difficulty || '',
        a.total ?? '',
        a.correct ?? '',
        a.wrong ?? '',
        a.percentage ?? '',
        a.date || '',
        a.time || '',
        a.durationSec ?? ''
      ];
    });
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'pdf') {
      if (typeof PDF === 'undefined') return alert('PDF library not loaded. Refresh and try again.');
      const cat = document.getElementById('report-category')?.value || '';
      const unit = document.getElementById('report-unit')?.value || '';
      PDF.exportAttemptsReport(attempts, [cat, unit].filter(Boolean).join(' – ') || 'All Attempts');
      return;
    }
    if (format === 'csv') {
      const lines = [headers.join(',')].concat(rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')));
      this._downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), 'quiz-attempts-' + stamp + '.csv');
      return;
    }
    if (format === 'txt') {
      const lines = [headers.join('\t')].concat(rows.map(r => r.join('\t')));
      this._downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), 'quiz-attempts-' + stamp + '.txt');
      return;
    }
    if (format === 'xlsx') {
      if (typeof XLSX === 'undefined') return alert('Excel library not loaded. Refresh and try again.');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Attempts');
      XLSX.writeFile(wb, 'quiz-attempts-' + stamp + '.xlsx');
      return;
    }
    if (format === 'docx') {
      this._exportDocx(headers, rows, 'Quiz Attempts Report', 'quiz-attempts-' + stamp + '.docx');
    }
  },

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  async _exportDocx(headers, rows, title, filename) {
    if (typeof JSZip === 'undefined') return alert('Word export library not loaded. Refresh and try again.');
    const esc = (s) => String(s ?? '')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>');
    const headerCells = headers.map(h => `<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${esc(h)}</w:t></w:r></w:p></w:tc>`).join('');
    const bodyRows = rows.map(r => `<w:tr>${r.map(c => `<w:tc><w:p><w:r><w:t>${esc(c)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('');
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${esc(title)}</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>${headerCells}</w:tr>
      ${bodyRows}
    </w:tbl>
    <w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/></w:sectPr>
  </w:body>
</w:document>`;
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
    zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
    zip.folder('word').file('document.xml', documentXml);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    this._downloadBlob(blob, filename);
  },

  _richDashboard() {
    const users = Admin.getUsers();
    const questions = Questions.getAll();
    const attempts = Admin.getRecentAttempts(2000);
    const byChapter = {};
    const bySession = {};
    const byStudent = {};
    attempts.forEach(a => {
      const ch = (a.subject || a.category || 'General') + ' / ' + (a.unit || a.questionBank || 'General');
      const ses = (a.subject || a.category || 'General') + ' / ' + (a.session || 'General');
      const email = a.email || '';
      if (!byChapter[ch]) byChapter[ch] = { n: 0, pct: 0 };
      if (!bySession[ses]) bySession[ses] = { n: 0, pct: 0 };
      byChapter[ch].n++; byChapter[ch].pct += Number(a.percentage) || 0;
      bySession[ses].n++; bySession[ses].pct += Number(a.percentage) || 0;
      if (!byStudent[email]) byStudent[email] = { email, name: a.name || '', n: 0, pct: 0 };
      byStudent[email].n++; byStudent[email].pct += Number(a.percentage) || 0;
      const u = Storage.findUser(email);
      if (u?.name) byStudent[email].name = u.name;
    });
    const avg = (o) => o.n ? Math.round(o.pct / o.n) : 0;
    const chapters = Object.entries(byChapter).map(([k, v]) => ({ k, n: v.n, avg: avg(v) }));
    const sessions = Object.entries(bySession).map(([k, v]) => ({ k, n: v.n, avg: avg(v) }));
    const students = Object.values(byStudent).map(s => ({ ...s, avg: s.n ? Math.round(s.pct / s.n) : 0 }));
    const qChapters = {};
    questions.forEach(q => {
      const k = (q.subject || q.category || 'General') + ' / ' + (q.unit || q.questionBank || 'General');
      qChapters[k] = (qChapters[k] || 0) + 1;
    });
    const attemptedKeys = new Set(chapters.map(c => c.k));
    const ignored = Object.keys(qChapters).filter(k => !attemptedKeys.has(k));
    const topChapters = [...chapters].sort((a, b) => b.n - a.n).slice(0, 5);
    const weakChapters = [...chapters].filter(c => c.n).sort((a, b) => a.avg - b.avg).slice(0, 5);
    const toppers = [...students].sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, 8);
    const weakStudents = [...students].filter(s => s.n).sort((a, b) => a.avg - b.avg).slice(0, 5);
    const list = (items, fmt) => items.length ? `<ol style="margin:0;padding-left:18px;">${items.map(fmt).join('')}</ol>` : '<p style="color:var(--text-muted);margin:0;">Not enough data yet.</p>';
    const qBySession = {};
    questions.forEach(q => {
      const k = (q.subject || q.category || 'General') + ' / ' + (q.session || '—');
      qBySession[k] = (qBySession[k] || 0) + 1;
    });
    return `
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Chapters in bank</div><div class="value">${Object.keys(qChapters).length}</div></div>
        <div class="stat-card"><div class="label">Sessions in bank</div><div class="value">${Object.keys(qBySession).length}</div></div>
        <div class="stat-card"><div class="label">Students with attempts</div><div class="value">${students.length}</div><div class="sub">${users.length} registered</div></div>
        <div class="stat-card"><div class="label">Chapters never attempted</div><div class="value">${ignored.length}</div></div>
      </div>
      <div class="card"><div class="card-header"><h3>Leaderboard</h3></div>
        ${list(toppers, s => `<li><strong>${s.name || s.email}</strong> — ${s.avg}% · ${s.n} attempt(s)</li>`)}
      </div>
      <div class="card"><div class="card-header"><h3>Weak students</h3></div>
        ${list(weakStudents, s => `<li>${s.name || s.email} — ${s.avg}% over ${s.n} attempt(s)</li>`)}
      </div>
      <div class="card"><div class="card-header"><h3>Most attempted chapters</h3></div>
        ${list(topChapters, c => `<li>${c.k} — ${c.n} attempt(s), avg ${c.avg}%</li>`)}
      </div>
      <div class="card"><div class="card-header"><h3>Weak chapters</h3></div>
        ${list(weakChapters, c => `<li>${c.k} — avg ${c.avg}% (${c.n} attempt(s))</li>`)}
      </div>
      <div class="card"><div class="card-header"><h3>Most attempted sessions</h3></div>
        ${list([...sessions].sort((a,b)=>b.n-a.n).slice(0,5), c => `<li>${c.k} — ${c.n} attempt(s), avg ${c.avg}%</li>`)}
      </div>
      <div class="card"><div class="card-header"><h3>Chapters with questions but no attempts</h3></div>
        ${ignored.length ? `<ul style="margin:0;padding-left:18px;">${ignored.slice(0,12).map(k => `<li>${k} (${qChapters[k]} questions)</li>`).join('')}</ul>` : '<p style="color:var(--text-muted);margin:0;">Every chapter with questions has at least one attempt.</p>'}
      </div>
      <div class="card"><div class="card-header"><h3>Question bank by session</h3></div>
        <div class="table-wrap"><table><thead><tr><th class="sortable">Session</th><th class="sortable">Questions</th></tr></thead><tbody>
          ${Object.entries(qBySession).sort((a,b)=>b[1]-a[1]).map(([k,n]) => `<tr><td>${k}</td><td>${n}</td></tr>`).join('') || '<tr><td colspan="2">No questions</td></tr>'}
        </tbody></table></div>
      </div>
    `;
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

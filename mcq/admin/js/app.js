/**
 * app.js - Admin Panel Controller
 */

const App = {
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
      return { ok: true, userCount, attemptCount, message: 'Synced ' + userCount + ' users, ' + attemptCount + ' attempts from Sheets' };
    } catch (e) {
      console.warn('Admin cloud sync failed', e);
      return { ok: false, message: e.message || 'Sync failed' };
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

    // Sidebar nav
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderView(btn.dataset.view);
      });
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      if (confirm('Logout from Admin Panel?')) {
        Auth.logout();
        this.showScreen('login');
      }
    });

    // Dark mode
    document.getElementById('btn-darkmode')?.addEventListener('click', () => {
      const isDark = Storage.toggleDarkMode();
      document.getElementById('btn-darkmode').textContent = isDark ? '☀️' : '🌙';
    });

    // Sidebar toggle (mobile)
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
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
      case 'dashboard': container.innerHTML = this.viewDashboard(); break;
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
      ? `<div style="background:#dcfce7;color:#166534;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:0.9rem;">
           ☁ ${status}
           <button class="btn btn-sm btn-secondary" style="margin-left:10px;" onclick="App.syncCloudData().then(r=>{alert(r&&r.message?r.message:'Sync done');App.renderView('dashboard');App.updateSheetsStatus();})">Sync now</button>
         </div>`
      : `<div style="background:#fef3c7;color:#92400e;padding:12px 14px;border-radius:8px;margin-bottom:16px;font-size:0.9rem;line-height:1.45;">
           ⚠ <strong>Local-only mode</strong> — data on this device will NOT appear on phone / other browsers / Google Sheet.<br>
           Fix: set <code>API_URL</code> and <code>USE_GOOGLE_SHEETS: true</code> in <code>admin/js/config.js</code> and <code>student/js/config.js</code>, then push to GitHub.
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
                <td>${a.email}</td>
                <td>${a.date || ''} ${a.time || ''}</td>
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
      ? `<tr><td colspan="7" class="empty-state">No students registered yet.<br>Students will appear here after they register in the Student Panel or you can add them manually.</td></tr>`
      : users.map(u => `
        <tr>
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
          <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-IN') : '—'}</td>
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
        <button class="btn btn-primary" onclick="App.showAddUser()">+ Add User</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Mobile</th>
                <th>Attempts</th>
                <th>Avg Score</th>
                <th>Status</th>
                <th>Last Login</th>
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
            <span>${user.createdAt ? new Date(user.createdAt).toLocaleString('en-IN') : '—'}</span>
          </div>
          <div class="detail-item"><label>Last Login</label>
            <span>${user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-IN') : 'Never'}</span>
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
                  <td>${a.date || ''} ${a.time || ''}</td>
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
                <td>${a.date || ''} ${a.time || ''}</td>
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
          <span>${user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-IN') : 'Never'}</span>
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
        <button class="btn btn-primary" onclick="App.showAddQuestion()">+ Add Question</button>
        <button class="btn btn-secondary" onclick="App.showBulkUpload()">⬆ Bulk Upload</button>
        <button class="btn btn-primary" onclick="App.exportQuestionBankPDF()">📄 Export PDF</button>
        <button class="btn btn-secondary" onclick="App.pushLocalQuestionsToSheets()">☁ Push to Sheets</button>
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
        <td>${q.qNo}</td>
        <td><strong>${q.category || ''}</strong><br><small>${q.questionBank || ''}</small><br><small style="opacity:0.8">${q.relevantSession || ''}</small></td>
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
              <th>#</th><th>Subject / Unit / Session</th><th>Difficulty</th><th>Question</th>
              <th>Ans</th><th>Timer</th><th>Status</th><th>Actions</th>
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
  },

  showAddQuestion() {
    this._questionFormModal(null);
  },


  // ----- Bulk Upload -----
  showBulkUpload() {
    const body = `
      <p style="font-size:0.9rem;margin-bottom:12px;color:var(--text-secondary);">
        Upload a <strong>CSV UTF-8</strong> file. First row must be headers.
      </p>
      <p style="font-size:0.8rem;margin-bottom:12px;background:var(--bg);padding:10px;border-radius:8px;line-height:1.55;">
        <strong>Preferred headers (any order):</strong><br>
        Subject, Unit/Chapter, Session, Q. No., Question, Option A, Option B, Option C, Option D,
        Right Answer, Explanation, Difficulty, Previous Board Exam?, PYQ Status, PYQ / Source Year,
        Source Type, Verification Note<br><br>
        <strong>Right Answer</strong> = A, B, C or D only.<br>
        Difficulty accepts Easy / Medium / Hard / Tough / Toughest.
      </p>
      <div class="form-group">
        <label>Select CSV File</label>
        <input type="file" id="bulk-file" accept=".csv,text/csv" />
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="bulk-replace" /> Replace all existing questions with this file</label>
      </div>
      <div id="bulk-message" class="form-message"></div>
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="App.processBulkUpload()">Upload & Import</button>
    `;
    this.openModal('Bulk Upload Questions', body, footer);
  },

  _normalizeDifficulty(raw) {
    const d = String(raw || '').trim().toLowerCase();
    if (!d) return 'Medium';
    if (/easy/.test(d)) return 'Easy';
    if (/medium|moderate/.test(d)) return 'Medium';
    if (/hard|tough|difficult/.test(d)) return 'Hard';
    return 'Medium';
  },

  _isDifficultyWord(v) {
    return /^(easy|medium|hard|tough|toughest|difficult|moderate)$/i.test(String(v || '').trim());
  },

  _looksLikeSession(v) {
    return /^session\b/i.test(String(v || '').trim());
  },

  /**
   * Repair common CSV column mix-ups seen with Info Tech banks:
   * e.g. Subject=1, Unit=Communication, Session=Info.Tech., Q.No.=Toughest,
   *      SourceType=Session 15
   */
  _repairQuestionFields(f) {
    let { subject, unit, session, qNo, difficulty, sourceType, verificationNote, pyqStatus, pyqSource } = f;

    // Case: first column is a number (unit/chapter index), Subject is in Session slot
    if (/^\d+$/.test(String(subject || '').trim()) && session && !this._looksLikeSession(session)) {
      const maybeUnitNo = String(subject).trim();
      subject = session; // e.g. Info. Tech.
      // unit stays as chapter name (Communication)
      session = '';
      // Q.No. may hold difficulty
      if (this._isDifficultyWord(qNo)) {
        difficulty = qNo;
        qNo = maybeUnitNo;
      }
    }

    // Q.No. holds difficulty word
    if (this._isDifficultyWord(qNo)) {
      difficulty = qNo;
      qNo = '';
    }

    // Session value stuck in Source Type / Verification / PYQ fields
    [sourceType, verificationNote, pyqStatus, pyqSource].forEach((val, idx) => {
      if (this._looksLikeSession(val) && !session) {
        session = String(val).trim();
        if (idx === 0) sourceType = '';
        if (idx === 1) verificationNote = '';
        if (idx === 2) pyqStatus = '';
        if (idx === 3) pyqSource = '';
      }
    });

    // Subject accidentally holds difficulty
    if (this._isDifficultyWord(subject)) {
      difficulty = subject;
      subject = session || unit || 'General';
    }

    difficulty = this._normalizeDifficulty(difficulty);

    // Clean subject
    subject = String(subject || 'General').trim() || 'General';
    unit = String(unit || '').trim();
    session = String(session || '').trim();

    return { subject, unit, session, qNo, difficulty, sourceType, verificationNote, pyqStatus, pyqSource };
  },

  processBulkUpload() {
    const fileInput = document.getElementById('bulk-file');
    const msg = document.getElementById('bulk-message');
    const replaceAll = document.getElementById('bulk-replace')?.checked;

    if (!fileInput?.files?.length) {
      msg.textContent = 'Please select a CSV file.';
      msg.className = 'form-message error';
      return;
    }
    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith('.csv')) {
      msg.textContent = 'Only CSV files are supported. In Excel: File → Save As → CSV UTF-8 (Comma delimited).';
      msg.className = 'form-message error';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        // Strip BOM
        const clean = text.replace(/^\uFEFF/, '');
        const lines = clean.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          msg.textContent = 'File is empty or has no data rows.';
          msg.className = 'form-message error';
          return;
        }

        const rawHeaders = this._parseCSVLine(lines[0]).map(h => h.trim());
        const headers = rawHeaders.map(h => h.toLowerCase().replace(/\s+/g, ' ').trim());

        const findCol = (...patterns) => {
          for (const p of patterns) {
            const exact = p.startsWith('=');
            const needle = exact ? p.slice(1) : p;
            const idx = headers.findIndex(h => exact ? h === needle : h.includes(needle));
            if (idx >= 0) return idx;
          }
          return -1;
        };

        // Map by header name (order independent)
        const colMap = {
          subject: findCol('=subject', 'subject', '=category', 'category'),
          chapterUnit: findCol('unit/chapter', 'unit / chapter', 'chapter / unit', 'chapter/unit', '=unit', 'chapter', 'unit'),
          session: findCol('relevant session', '=session', 'session'),
          qNo: findCol('q. no', 'q no', 'question no', 'qno', '=no.'),
          question: findCol('=question', 'question text'),
          optionA: findCol('option a'),
          optionB: findCol('option b'),
          optionC: findCol('option c'),
          optionD: findCol('option d'),
          rightAnswer: findCol('right answer', 'correct answer', 'correct option', '=answer'),
          explanation: findCol('explanation'),
          difficulty: findCol('difficulty'),
          previousBoardExam: findCol('previous board', 'board exam'),
          pyqStatus: findCol('pyq status'),
          pyqSource: findCol('pyq / source year', 'pyq / source', 'pyq/source', 'pyq source'),
          year: findCol('=year'),
          sourceType: findCol('source type'),
          verificationNote: findCol('verification note', 'verification'),
          timer: findCol('timer')
        };

        if (colMap.question < 0 || colMap.optionA < 0 || colMap.rightAnswer < 0) {
          msg.textContent = 'Missing required columns: Question, Option A, Right Answer. Found headers: ' + rawHeaders.join(' | ');
          msg.className = 'form-message error';
          return;
        }

        if (replaceAll) {
          Storage.saveQuestions([]);
        }

        const toAdd = [];
        let skipped = 0;
        const skipReasons = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = this._parseCSVLine(lines[i]);
          if (cols.length < 3) { skipped++; continue; }

          const get = (idx) => (idx >= 0 && cols[idx] !== undefined) ? String(cols[idx]).trim() : '';

          const qText = get(colMap.question);
          if (!qText) { skipped++; continue; }

          let answer = get(colMap.rightAnswer).toUpperCase().trim();
          answer = answer.replace(/^OPTION\s*/, '').replace(/[^A-D]/g, '');
          if (answer.length > 1) answer = answer.charAt(0);
          if (!['A', 'B', 'C', 'D'].includes(answer)) {
            skipped++;
            if (skipReasons.length < 5) {
              skipReasons.push('Row ' + (i + 1) + ': invalid answer "' + get(colMap.rightAnswer) + '"');
            }
            continue;
          }

          let fields = {
            subject: get(colMap.subject),
            unit: get(colMap.chapterUnit),
            session: get(colMap.session),
            qNo: get(colMap.qNo),
            difficulty: get(colMap.difficulty),
            sourceType: get(colMap.sourceType),
            verificationNote: get(colMap.verificationNote),
            pyqStatus: get(colMap.pyqStatus),
            pyqSource: get(colMap.pyqSource) || get(colMap.year)
          };
          fields = this._repairQuestionFields(fields);

          // Build verification note with source type if still present
          let verificationNote = fields.verificationNote || '';
          if (fields.sourceType) {
            verificationNote = verificationNote
              ? (verificationNote + ' | Source Type: ' + fields.sourceType)
              : ('Source Type: ' + fields.sourceType);
          }

          toAdd.push({
            category: fields.subject,
            questionBank: fields.unit || 'Imported',
            relevantSession: fields.session || '',
            difficulty: fields.difficulty,
            question: qText,
            optionA: get(colMap.optionA),
            optionB: get(colMap.optionB),
            optionC: get(colMap.optionC),
            optionD: get(colMap.optionD),
            rightAnswer: answer,
            explanation: get(colMap.explanation),
            previousBoardExam: get(colMap.previousBoardExam) || 'No',
            pyqStatus: fields.pyqStatus || '',
            pyqSource: fields.pyqSource || '',
            year: '',
            sourceType: fields.sourceType || '',
            verificationNote,
            timerSeconds: parseInt(get(colMap.timer), 10) || 45,
            locked: false
          });
        }

        if (!toAdd.length) {
          msg.textContent = 'No valid questions found. Skipped ' + skipped + ' rows.' +
            (skipReasons.length ? ' ' + skipReasons.join('; ') : '');
          msg.className = 'form-message error';
          return;
        }

        msg.textContent = 'Importing ' + toAdd.length + ' questions…';
        msg.className = 'form-message';

        // Local save
        toAdd.forEach(q => Questions.add(q));

        // Push to Google Sheets in one bulk call when connected
        if (typeof API !== 'undefined' && API.isEnabled()) {
          try {
            const res = await API.bulkAddQuestions(toAdd);
            if (res && res.error) {
              msg.textContent = 'Saved locally (' + toAdd.length + ') but Sheets bulk failed: ' + res.error +
                '. Use ☁ Push to Sheets from the toolbar.';
              msg.className = 'form-message error';
            } else {
              await Questions.syncFromCloud();
              msg.textContent = 'Import complete: ' + toAdd.length + ' questions added' +
                (res && res.added != null ? ' (Sheets: ' + res.added + ')' : ' and synced to Sheets') +
                (skipped ? ', ' + skipped + ' skipped' : '') + '.';
              msg.className = 'form-message success';
            }
          } catch (err) {
            msg.textContent = 'Saved locally (' + toAdd.length + '). Sheets sync error: ' + err.message;
            msg.className = 'form-message error';
          }
        } else {
          msg.textContent = 'Import complete: ' + toAdd.length + ' questions added locally' +
            (skipped ? ', ' + skipped + ' skipped' : '') + '. (Sheets not connected)';
          msg.className = 'form-message success';
        }

        if (skipReasons.length) {
          msg.textContent += ' Examples skipped: ' + skipReasons.join('; ');
        }

        setTimeout(() => {
          this.closeModal();
          this.renderView('questions');
        }, 2000);
      } catch (err) {
        msg.textContent = 'Error parsing file: ' + err.message;
        msg.className = 'form-message error';
      }
    };
    reader.readAsText(file, 'UTF-8');
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

    const body = `
      <div class="form-group">
        <label>Subject *</label>
        <input type="text" id="qf-category" value="${q?.category || ''}" placeholder="e.g. Physics" required />
      </div>
      <div class="form-group">
        <label>Unit / Chapter *</label>
        <input type="text" id="qf-bank" value="${q?.questionBank || ''}" placeholder="e.g. Work, Energy & Power" required />
      </div>
      <div class="form-group">
        <label>Session *</label>
        <input type="text" id="qf-session" value="${q?.relevantSession || ''}" placeholder="e.g. Session 1 – …" required />
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
        <label>Right Answer *</label>
        <select id="qf-answer">
          <option value="A" ${q?.rightAnswer === 'A' ? 'selected' : ''}>A</option>
          <option value="B" ${q?.rightAnswer === 'B' ? 'selected' : ''}>B</option>
          <option value="C" ${q?.rightAnswer === 'C' ? 'selected' : ''}>C</option>
          <option value="D" ${q?.rightAnswer === 'D' ? 'selected' : ''}>D</option>
        </select>
      </div>
      <div class="form-group">
        <label>Explanation</label>
        <textarea id="qf-explanation" rows="2">${q?.explanation || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Timer (seconds)</label>
        <select id="qf-timer">
          <option value="60" ${q?.timerSeconds === 60 ? 'selected' : ''}>60 sec (1 min)</option>
          <option value="45" ${!q || q?.timerSeconds === 45 ? 'selected' : ''}>45 sec</option>
          <option value="30" ${q?.timerSeconds === 30 ? 'selected' : ''}>30 sec</option>
          <option value="15" ${q?.timerSeconds === 15 ? 'selected' : ''}>15 sec</option>
        </select>
      </div>
      <div class="form-group">
        <label>Previous Board Exam?</label>
        <select id="qf-prev">
          <option value="No" ${q?.previousBoardExam !== 'Yes' ? 'selected' : ''}>No</option>
          <option value="Yes" ${q?.previousBoardExam === 'Yes' ? 'selected' : ''}>Yes</option>
        </select>
      </div>
      <div class="form-group">
        <label>PYQ Status</label>
        <input id="qf-pyq-status" value="${q?.pyqStatus || ''}" placeholder="e.g. Confirmed" />
      </div>
      <div class="form-group">
        <label>PYQ / Source Year</label>
        <input id="qf-pyq" value="${q?.pyqSource || q?.year || ''}" placeholder="e.g. CBSE 2023" />
      </div>
      <div class="form-group">
        <label>Source Type</label>
        <input id="qf-source-type" value="${q?.sourceType || ''}" placeholder="e.g. Board / Textbook" />
      </div>
      <div class="form-group">
        <label>Verification Note</label>
        <input id="qf-note" value="${q?.verificationNote || ''}" />
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
      category: document.getElementById('qf-category').value.trim(),
      questionBank: document.getElementById('qf-bank').value.trim(),
      relevantSession: document.getElementById('qf-session').value.trim(),
      difficulty: document.getElementById('qf-difficulty').value,
      question: document.getElementById('qf-question').value.trim(),
      optionA: document.getElementById('qf-a').value.trim(),
      optionB: document.getElementById('qf-b').value.trim(),
      optionC: document.getElementById('qf-c').value.trim(),
      optionD: document.getElementById('qf-d').value.trim(),
      rightAnswer: document.getElementById('qf-answer').value,
      explanation: document.getElementById('qf-explanation').value.trim(),
      timerSeconds: parseInt(document.getElementById('qf-timer').value),
      previousBoardExam: document.getElementById('qf-prev').value,
      pyqStatus: document.getElementById('qf-pyq-status')?.value.trim() || '',
      pyqSource: document.getElementById('qf-pyq').value.trim(),
      year: '',
      sourceType: document.getElementById('qf-source-type')?.value.trim() || '',
      verificationNote: document.getElementById('qf-note').value.trim(),
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
          <input type="text" class="search-input" id="report-search" placeholder="Search student email..." style="min-width:180px;" />
          
          <select id="report-category" class="search-input" style="min-width:140px;">
            <option value="">All Subjects</option>
          </select>

          <select id="report-session" class="search-input" style="min-width:160px;">
            <option value="">All Sessions</option>
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

          <button class="btn btn-secondary btn-sm" id="btn-clear-filters">Clear Filters</button>
          <button class="btn btn-primary btn-sm" id="btn-export-attempts-pdf">📄 Export PDF</button>
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
    const session = document.getElementById('report-session')?.value || '';
    const sort = document.getElementById('report-sort')?.value || 'date-desc';

    // Filter
    if (search) {
      attempts = attempts.filter(a => (a.email || '').toLowerCase().includes(search));
    }
    if (category) {
      attempts = attempts.filter(a => a.category === category);
    }
    if (session) {
      attempts = attempts.filter(a => a.session === session);
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
              <th>Student</th>
              <th>Date & Time</th>
              <th>Category</th>
              <th>Session</th>
              <th>Difficulty</th>
              <th>Score</th>
              <th>%</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            ${attempts.map(a => `
              <tr>
                <td>${a.email}</td>
                <td>${a.date || ''} ${a.time || ''}</td>
                <td>${a.category || '—'}</td>
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
    const categories = [...new Set(attempts.map(a => a.category).filter(Boolean))].sort();
    const sessions = [...new Set(attempts.map(a => a.session).filter(Boolean))].sort();

    const catSelect = document.getElementById('report-category');
    const sessSelect = document.getElementById('report-session');

    if (catSelect) {
      catSelect.innerHTML = '<option value="">All Subjects</option>' +
        categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    if (sessSelect) {
      sessSelect.innerHTML = '<option value="">All Sessions</option>' +
        sessions.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    const refresh = () => {
      const container = document.getElementById('report-table-container');
      if (container) container.innerHTML = this._renderReportTable();
    };

    document.getElementById('report-search')?.addEventListener('input', refresh);
    document.getElementById('report-category')?.addEventListener('change', refresh);
    document.getElementById('report-session')?.addEventListener('change', refresh);
    document.getElementById('report-sort')?.addEventListener('change', refresh);

    document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
      if (document.getElementById('report-search')) document.getElementById('report-search').value = '';
      if (catSelect) catSelect.value = '';
      if (sessSelect) sessSelect.value = '';
      if (document.getElementById('report-sort')) document.getElementById('report-sort').value = 'date-desc';
      refresh();
    });

    document.getElementById('btn-export-attempts-pdf')?.addEventListener('click', () => {
      if (typeof PDF === 'undefined') return alert('PDF library not loaded. Please refresh.');
      const attempts = this._getFilteredAttempts();
      const cat = document.getElementById('report-category')?.value || '';
      const sess = document.getElementById('report-session')?.value || '';
      let label = 'All Attempts';
      if (cat || sess) label = [cat, sess].filter(Boolean).join(' – ');
      PDF.exportAttemptsReport(attempts, label);
    });
  },

  // ========== SETTINGS ==========
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
      top.style.background = bg;
      top.style.color = color;
      top.textContent = topText;
    }
  },

  // ---------- Modal helpers ----------
  openModal(title, bodyHTML, footerHTML = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

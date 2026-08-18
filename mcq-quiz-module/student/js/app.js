/**
 * app.js
 * Main application controller for Student Panel
 */

const App = {
  currentView: 'home',

  init() {
    this.applySecurity();
    Storage.applyTheme();
    this.bindGlobalEvents();

    // Load question bank (local cache + Google Sheets when configured)
    if (typeof Quiz !== 'undefined' && Quiz.initBank) {
      Quiz.initBank();
    }

    // Pull settings from cloud when available
    if (typeof API !== 'undefined' && API.isEnabled()) {
      API.getSettings().then(res => {
        if (res && res.settings) {
          const s = Storage.getSettings();
          Storage.saveSettings({ ...s, ...res.settings });
        }
      }).catch(() => {});
    }

    setTimeout(() => {
      if (Auth.isLoggedIn()) {
        this.showScreen('main');
        this.renderView('home');
        this.updateUserAvatar();
      } else {
        this.showScreen('auth');
      }
    }, 600);
  },

  // ---------- Security (MVP level) ----------
  applySecurity() {
    // Disable right-click
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Disable common keyboard shortcuts
    document.addEventListener('keydown', e => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S, Ctrl+P
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 's' || e.key === 'p'))
      ) {
        e.preventDefault();
        return false;
      }
    });

    // Attempt to detect DevTools (basic)
    const devtools = /./;
    devtools.toString = function () {
      // This is a weak detection – just a deterrent
    };
  },

  // ---------- Screen Management ----------
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(`screen-${screenId}`);
    if (screen) screen.classList.add('active');
  },

  // ---------- Global Events ----------
  bindGlobalEvents() {
    // Auth tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`form-${btn.dataset.tab}`).classList.add('active');
      });
    });

    // Login form
    document.getElementById('form-login').addEventListener('submit', e => {
      e.preventDefault();
      this.handleLogin();
    });

    // Register form
    document.getElementById('form-register').addEventListener('submit', e => {
      e.preventDefault();
      this.handleRegister();
    });

    // Dark mode
    document.getElementById('btn-darkmode')?.addEventListener('click', () => {
      const isDark = Storage.toggleDarkMode();
      document.getElementById('btn-darkmode').textContent = isDark ? '☀️' : '🌙';
    });

    // Bottom navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.renderView(view);
      });
    });

    // Quiz next button
    document.getElementById('btn-next-question')?.addEventListener('click', () => {
      this.handleNextQuestion();
    });

    // Result buttons
    document.getElementById('btn-go-progress')?.addEventListener('click', () => {
      this.showScreen('main');
      this.renderView('progress');
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelector('.nav-item[data-view="progress"]').classList.add('active');
    });

    document.getElementById('btn-new-quiz')?.addEventListener('click', () => {
      this.showScreen('main');
      this.renderView('select-quiz');
    });

    document.getElementById('btn-view-explanations')?.addEventListener('click', () => {
      alert('Detailed explanations view will be added in next iteration.\nFor now, explanations are shown after each question.');
    });
  },

  // ---------- Auth Handlers ----------
  async handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const msgEl = document.getElementById('login-message');
    msgEl.textContent = 'Signing in...';
    msgEl.className = 'form-message';

    const result = await Auth.login({ email, password });
    msgEl.textContent = result.message;
    msgEl.className = 'form-message ' + (result.success ? 'success' : 'error');

    if (result.success) {
      // Refresh questions after login
      if (Quiz.syncFromCloud) Quiz.syncFromCloud();
      setTimeout(() => {
        this.showScreen('main');
        this.renderView('home');
        this.updateUserAvatar();
      }, 400);
    }
  },

  async handleRegister() {
    const email = document.getElementById('reg-email').value;
    const mobile = document.getElementById('reg-mobile').value;
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const msgEl = document.getElementById('register-message');

    if (password !== confirm) {
      msgEl.textContent = 'Passwords do not match.';
      msgEl.className = 'form-message error';
      return;
    }

    msgEl.textContent = 'Registering...';
    msgEl.className = 'form-message';

    const result = await Auth.register({ email, mobile, password });
    msgEl.textContent = result.message;
    msgEl.className = 'form-message ' + (result.success ? 'success' : 'error');

    if (result.success) {
      setTimeout(() => {
        document.querySelector('.tab-btn[data-tab="login"]').click();
        document.getElementById('login-email').value = email;
      }, 1000);
    }
  },

  updateUserAvatar() {
    const user = Auth.getCurrentUser();
    if (user) {
      const avatar = document.getElementById('user-avatar');
      if (avatar) avatar.textContent = (user.name || user.email)[0].toUpperCase();
    }
  },

  // ---------- View Rendering ----------
  renderView(viewName) {
    this.currentView = viewName;
    const container = document.getElementById('main-content');
    if (!container) return;

    switch (viewName) {
      case 'home':
        container.innerHTML = this.getHomeHTML();
        this.bindHomeEvents();
        break;
      case 'select-quiz':
        container.innerHTML = this.getSelectQuizHTML();
        this.bindSelectQuizEvents();
        break;
      case 'progress':
        container.innerHTML = this.getProgressHTML();
        break;
      case 'profile':
        container.innerHTML = this.getProfileHTML();
        this.bindProfileEvents();
        break;
      default:
        container.innerHTML = '<p>View not found</p>';
    }
  },

  // ---------- HOME ----------
  getHomeHTML() {
    const user = Auth.getCurrentUser();
    const attempts = Storage.getAttempts(user.email);
    const recent = attempts.slice(0, 3);

    let recentHTML = '';
    if (recent.length === 0) {
      recentHTML = `<div class="empty-state"><div class="icon">📝</div><p>No attempts yet. Start your first quiz!</p></div>`;
    } else {
      recentHTML = recent.map(a => `
        <div class="recent-item">
          <div class="info">
            <h4>${a.category} – ${a.session}</h4>
            <p>${a.date} • ${a.time}</p>
          </div>
          <div class="score-badge">${a.percentage}%</div>
        </div>
      `).join('');
    }

    return `
      <div class="welcome-card">
        <h2>Welcome, ${user.name || 'Student'}!</h2>
        <p>Ready to test your knowledge?</p>
      </div>

      <div class="action-grid">
        <div class="action-card" id="action-start-quiz">
          <div class="icon">🎯</div>
          <h3>Start Quiz</h3>
        </div>
        <div class="action-card" id="action-progress">
          <div class="icon">📊</div>
          <h3>My Progress</h3>
        </div>
      </div>

      <h3 class="section-title">Recent Attempts</h3>
      <div class="recent-list">
        ${recentHTML}
      </div>
    `;
  },

  bindHomeEvents() {
    document.getElementById('action-start-quiz')?.addEventListener('click', () => {
      this.renderView('select-quiz');
    });
    document.getElementById('action-progress')?.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelector('.nav-item[data-view="progress"]').classList.add('active');
      this.renderView('progress');
    });
  },

  // ---------- SELECT QUIZ ----------
  getSelectQuizHTML() {
    const categories = Quiz.getCategories(); // NO "All" – subject is mandatory
    const difficulties = Quiz.getDifficulties();

    // Resolve timer lock: individual user lock takes priority over global Settings
    const user = Auth.getCurrentUser();
    const fullUser = Storage.findUserByEmail?.(user?.email) || Storage.findUser?.(user?.email) || user;
    const settings = Storage.getSettings();

    let timerLocked = false;
    let forcedTimer = 45;

    if (fullUser && fullUser.timerLocked) {
      // Individual student lock (highest priority)
      timerLocked = true;
      forcedTimer = fullUser.forcedTimer || 45;
    } else if (settings.lockAllTimers) {
      // Global lock from Admin Settings
      timerLocked = true;
      forcedTimer = settings.defaultTimer || 45;
    }

    const timerOptions = [
      { value: 60, label: '1 min' },
      { value: 45, label: '45 sec' },
      { value: 30, label: '30 sec' },
      { value: 15, label: '15 sec' }
    ];

    return `
      <h2 class="section-title">Select Quiz</h2>
      <div class="form-card">
        <div class="select-group">
          <label>Category / Subject <span style="color:var(--danger)">*</span></label>
          <select id="sel-category" required>
            <option value="">-- Select Subject --</option>
            ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>

        <div class="select-group">
          <label>Relevant Session</label>
          <select id="sel-session">
            <option value="All">All Sessions</option>
          </select>
        </div>

        <div class="select-group">
          <label>Difficulty</label>
          <div class="difficulty-options" id="difficulty-options">
            ${difficulties.map((d, i) => `
              <button type="button" class="option-chip ${i === 3 ? 'active' : ''}" data-value="${d}">${d}</button>
            `).join('')}
          </div>
        </div>

        <div class="select-group">
          <label>Timer per Question ${timerLocked ? '<span class="badge" style="background:#fef3c7;color:#b45309;font-size:0.7rem;padding:2px 8px;border-radius:10px;margin-left:6px;">Locked by Admin</span>' : ''}</label>
          <div class="timer-options" id="timer-options">
            ${timerOptions.map(t => `
              <button type="button"
                class="option-chip ${t.value === forcedTimer ? 'active' : ''} ${timerLocked ? 'disabled' : ''}"
                data-value="${t.value}"
                ${timerLocked ? 'disabled' : ''}>
                ${t.label}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="select-group">
          <label>Number of Questions <small id="available-count-label" style="color:var(--text-muted)">(select subject first)</small></label>
          <select id="sel-count">
            <option value="">-- Select subject first --</option>
          </select>
        </div>

        <button class="btn btn-primary btn-block mt-16" id="btn-start-quiz" disabled>Start Quiz</button>
      </div>
    `;
  },

  bindSelectQuizEvents() {
    const catSelect = document.getElementById('sel-category');
    const sessSelect = document.getElementById('sel-session');
    const countSelect = document.getElementById('sel-count');
    const startBtn = document.getElementById('btn-start-quiz');

    // Determine if timer is locked
    const user = Auth.getCurrentUser();
    const fullUser = (Storage.findUserByEmail && Storage.findUserByEmail(user?.email)) ||
                     (Storage.findUser && Storage.findUser(user?.email)) || user;
    const settings = Storage.getSettings();
    const timerIsLocked = (fullUser && fullUser.timerLocked) || settings.lockAllTimers;

    const updateAvailableCount = () => {
      const category = catSelect.value;
      const session = sessSelect.value;
      const difficulty = document.querySelector('#difficulty-options .option-chip.active')?.dataset.value || 'All';

      if (!category) {
        countSelect.innerHTML = '<option value="">-- Select subject first --</option>';
        document.getElementById('available-count-label').textContent = '(select subject first)';
        startBtn.disabled = true;
        return;
      }

      const available = Quiz.countAvailable({ category, session, difficulty });
      document.getElementById('available-count-label').textContent = `(${available} available)`;

      if (available === 0) {
        countSelect.innerHTML = '<option value="">No questions available</option>';
        startBtn.disabled = true;
        return;
      }

      // Build options: 1 to available (cap display at reasonable steps if many)
      let opts = '';
      for (let i = 1; i <= available; i++) {
        const selected = i === Math.min(5, available) ? 'selected' : '';
        opts += `<option value="${i}" ${selected}>${i}</option>`;
      }
      countSelect.innerHTML = opts;
      startBtn.disabled = false;
    };

    const updateSessions = () => {
      const cat = catSelect.value;
      if (!cat) {
        sessSelect.innerHTML = '<option value="All">All Sessions</option>';
      } else {
        const sessions = Quiz.getSessions(cat);
        sessSelect.innerHTML = `<option value="All">All Sessions</option>` +
          sessions.map(s => `<option value="${s}">${s}</option>`).join('');
      }
      updateAvailableCount();
    };

    catSelect.addEventListener('change', updateSessions);
    sessSelect.addEventListener('change', updateAvailableCount);

    // Difficulty chips
    document.querySelectorAll('#difficulty-options .option-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#difficulty-options .option-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        updateAvailableCount();
      });
    });

    // Timer chips (only if not locked)
    if (!timerIsLocked) {
      document.querySelectorAll('#timer-options .option-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('#timer-options .option-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        });
      });
    }

    // Start Quiz
    startBtn.addEventListener('click', () => {
      const category = catSelect.value;
      if (!category) {
        alert('Please select a Subject / Category.');
        return;
      }

      const session = sessSelect.value;
      const difficulty = document.querySelector('#difficulty-options .option-chip.active')?.dataset.value || 'All';
      const timer = parseInt(document.querySelector('#timer-options .option-chip.active')?.dataset.value || '45');
      const count = parseInt(countSelect.value) || 0;

      if (count < 1) {
        alert('No questions available for the selected filters.');
        return;
      }

      const result = Quiz.start({ category, session, difficulty, timerSeconds: timer, count });

      if (!result.success) {
        alert(result.message);
        return;
      }

      this.startQuizUI();
    });

    // Initial state
    updateSessions();
  },

  // ---------- QUIZ UI ----------
  startQuizUI() {
    this.showScreen('quiz');
    this.renderQuestion();
  },

  renderQuestion() {
    const q = Quiz.getCurrentQuestion();
    if (!q) return;

    const progress = Quiz.getProgress();

    document.getElementById('quiz-progress-text').textContent =
      `Question ${progress.current} / ${progress.total}`;
    document.getElementById('quiz-progress-bar').style.width = `${progress.percent}%`;

    document.getElementById('question-text').textContent = q.question;

    const optionsHTML = ['A', 'B', 'C', 'D'].map(letter => {
      const text = q[`option${letter}`];
      return `
        <button class="option-btn" data-option="${letter}">
          <span class="option-letter">${letter}</span>
          <span class="option-text">${text}</span>
        </button>
      `;
    }).join('');

    document.getElementById('options-container').innerHTML = optionsHTML;
    document.getElementById('explanation-box').classList.add('hidden');
    document.getElementById('btn-next-question').disabled = true;
    document.getElementById('btn-next-question').textContent =
      progress.current === progress.total ? 'Finish Quiz' : 'Next Question';

    // Bind option clicks
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleOptionSelect(btn));
    });

    // Start timer
    const timerEl = document.getElementById('quiz-timer');
    timerEl.className = 'timer';

    Quiz.startTimer(
      (timeLeft) => {
        timerEl.textContent = Quiz.formatTime(timeLeft);
        timerEl.className = 'timer';
        if (timeLeft <= 10) timerEl.classList.add('danger');
        else if (timeLeft <= 20) timerEl.classList.add('warning');
      },
      () => {
        // Timeout – auto submit with no selection
        this.handleOptionSelect(null, true);
      }
    );
  },

  handleOptionSelect(btn, isTimeout = false) {
    if (Quiz.state.isAnswered) return;

    const selected = btn ? btn.dataset.option : null;
    const record = Quiz.submitAnswer(selected);

    // Disable all options
    document.querySelectorAll('.option-btn').forEach(b => {
      b.classList.add('disabled');
      const letter = b.dataset.option;
      if (letter === record.correct) b.classList.add('correct');
      if (selected && letter === selected && !record.isCorrect) b.classList.add('wrong');
      if (selected && letter === selected) b.classList.add('selected');
    });

    // Show explanation
    const expBox = document.getElementById('explanation-box');
    document.getElementById('explanation-text').textContent = record.explanation;
    expBox.classList.remove('hidden');

    // Enable next button
    document.getElementById('btn-next-question').disabled = false;
  },

  handleNextQuestion() {
    const hasNext = Quiz.nextQuestion();
    if (hasNext) {
      this.renderQuestion();
    } else {
      this.finishQuiz();
    }
  },

  finishQuiz() {
    Quiz.stopTimer();
    const result = Quiz.getResult();
    const user = Auth.getCurrentUser();
    Quiz.saveResult(user.email, result);

    // Update result screen
    document.getElementById('result-percentage').textContent = result.percentage + '%';
    document.getElementById('result-attempted').textContent = result.attempted;
    document.getElementById('result-correct').textContent = result.correct;
    document.getElementById('result-wrong').textContent = result.wrong;

    this.showScreen('result');
  },

  // ---------- PROGRESS ----------
  getProgressHTML() {
    const user = Auth.getCurrentUser();
    const attempts = Storage.getAttempts(user.email);

    if (attempts.length === 0) {
      return `
        <h2 class="section-title">My Progress</h2>
        <div class="empty-state">
          <div class="icon">📊</div>
          <p>No quiz attempts yet.</p>
          <button class="btn btn-primary mt-16" onclick="App.renderView('select-quiz')">Start Your First Quiz</button>
        </div>
      `;
    }

    const cards = attempts.map(a => `
      <div class="attempt-card">
        <div class="date">${a.date} • ${a.time}</div>
        <h4>${a.category} – ${a.session}</h4>
        <div class="attempt-meta">
          <span>${a.correct}/${a.total} correct</span>
          <span class="score-badge">${a.percentage}%</span>
        </div>
      </div>
    `).join('');

    return `
      <h2 class="section-title">My Progress</h2>
      <p style="color:var(--text-muted);margin-bottom:16px;font-size:0.9rem;">
        Total attempts: ${attempts.length}
      </p>
      ${cards}
    `;
  },

  // ---------- PROFILE ----------
  getProfileHTML() {
    const user = Auth.getCurrentUser();
    const attempts = Storage.getAttempts(user.email);
    const totalCorrect = attempts.reduce((sum, a) => sum + a.correct, 0);
    const totalQuestions = attempts.reduce((sum, a) => sum + a.total, 0);
    const avg = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    return `
      <div class="profile-card">
        <div class="profile-avatar">${(user.name || user.email)[0].toUpperCase()}</div>
        <h2>${user.name || 'Student'}</h2>
        <p style="color:var(--text-muted)">${user.email}</p>
      </div>

      <div class="form-card">
        <div class="profile-info">
          <div class="profile-row">
            <span>Mobile</span>
            <span>${user.mobile || '—'}</span>
          </div>
          <div class="profile-row">
            <span>Total Attempts</span>
            <span>${attempts.length}</span>
          </div>
          <div class="profile-row">
            <span>Average Score</span>
            <span>${avg}%</span>
          </div>
          <div class="profile-row">
            <span>Last Login</span>
            <span>${user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-IN') : '—'}</span>
          </div>
        </div>
      </div>

      <a href="../index.html" class="btn btn-secondary btn-block mt-16" style="text-decoration:none;">🏠 Home</a>
      <button class="btn btn-secondary btn-block mt-16" id="btn-logout">Logout</button>
    `;
  },

  bindProfileEvents() {
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        Auth.logout();
        this.showScreen('auth');
      }
    });
  }
};

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

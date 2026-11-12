/**
 * admin.js
 * Core admin operations: users, stats, reports
 */

const Admin = {
  // ---------- Stats ----------
  getDashboardStats() {
    const users = Storage.getAllUsers();
    const questions = Questions.getAll();
    const allAttempts = Storage.getAllAttempts();

    let totalAttempts = 0;
    let totalCorrect = 0;
    let totalQuestionsAttempted = 0;

    Object.values(allAttempts).forEach(userAttempts => {
      totalAttempts += userAttempts.length;
      userAttempts.forEach(a => {
        totalCorrect += a.correct || 0;
        totalQuestionsAttempted += a.total || 0;
      });
    });

    const avgScore = totalQuestionsAttempted > 0
      ? Math.round((totalCorrect / totalQuestionsAttempted) * 100)
      : 0;

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => !u.isLocked).length,
      lockedUsers: users.filter(u => u.isLocked).length,
      totalQuestions: questions.length,
      lockedQuestions: questions.filter(q => q.locked).length,
      totalAttempts,
      avgScore
    };
  },

  // ---------- Users ----------
  getUsers() {
    return Storage.getAllUsers().map(u => {
      const attempts = Storage.getUserAttempts(u.email);
      const totalCorrect = attempts.reduce((s, a) => s + (a.correct || 0), 0);
      const totalQ = attempts.reduce((s, a) => s + (a.total || 0), 0);
      return {
        ...u,
        attemptCount: attempts.length,
        avgScore: totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0
      };
    });
  },

  getUserDetail(email) {
    const user = Storage.findUser(email);
    if (!user) return null;

    const attempts = Storage.getUserAttempts(email);

    // Subject-wise summary
    const byCategory = {};
    attempts.forEach(a => {
      const cat = a.category || 'Unknown';
      if (!byCategory[cat]) byCategory[cat] = { attempts: 0, correct: 0, total: 0 };
      byCategory[cat].attempts++;
      byCategory[cat].correct += a.correct || 0;
      byCategory[cat].total += a.total || 0;
    });

    return {
      user,
      attempts,
      byCategory
    };
  },

  lockUser(email, lock = true) {
    const user = Storage.findUser(email);
    if (user) {
      user.isLocked = lock;
      Storage.saveUser(user);
      return true;
    }
    return false;
  },

  deleteUser(email) {
    Storage.deleteUser(email);
  },

  // ---------- Reports ----------
  getRecentAttempts(limit = 20) {
    const all = Storage.getAllAttempts();
    const flat = [];
    Object.entries(all).forEach(([email, attempts]) => {
      attempts.forEach(a => {
        flat.push({ email, ...a });
      });
    });
    // Sort by completedAt descending
    flat.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
    return flat.slice(0, limit);
  }
};

window.Admin = Admin;

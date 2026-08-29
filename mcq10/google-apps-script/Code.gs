/**
 * MCQ Quiz Module – Google Apps Script Backend
 * CSV format: Subject, Unit, Session, Question, Option A, Option B, Option C, Option D,
 *             Correct Answer, Explanation, Difficulty
 *
 * SETUP: Run setupSpreadsheet once → Deploy as Web App (Anyone) → copy /exec URL into config.js
 * After edits: Deploy → Manage deployments → New version
 */

const SHEET_QUESTIONS = 'Questions';
const SHEET_USERS = 'Users';
const SHEET_ATTEMPTS = 'Attempts';
const SHEET_SETTINGS = 'Settings';

// 0-based columns for Questions
const Q = {
  SUBJECT: 0,
  UNIT: 1,
  SESSION: 2,
  QUESTION: 3,
  OPTION_A: 4,
  OPTION_B: 5,
  OPTION_C: 6,
  OPTION_D: 7,
  CORRECT: 8,
  EXPLANATION: 9,
  DIFFICULTY: 10,
  LOCKED: 11,
  TIMER: 12,
  QNO: 13
};

// =============================================================================
// SETUP
// =============================================================================
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupQuestions_(ss);
  setupUsers_(ss);
  setupAttempts_(ss);
  setupSettings_(ss);
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) {
    try { ss.deleteSheet(def); } catch (e) {}
  }
  SpreadsheetApp.getUi().alert('Setup complete: Questions, Users, Attempts, Settings');
}

function setupQuestions_(ss) {
  let sh = ss.getSheetByName(SHEET_QUESTIONS);
  if (!sh) sh = ss.insertSheet(SHEET_QUESTIONS);
  sh.clear();
  sh.appendRow([
    'Subject', 'Unit', 'Session', 'Question',
    'Option A', 'Option B', 'Option C', 'Option D',
    'Correct Answer', 'Explanation', 'Difficulty',
    'Locked', 'Timer Seconds', 'Q. No.'
  ]);
  sh.setFrozenRows(1);

  const samples = [
    ['Physics', 'Work, Energy & Power', 'Session 1',
      'A body of mass 2 kg is moving with a velocity of 5 m/s. What is its kinetic energy?',
      '10 J', '25 J', '50 J', '100 J', 'B',
      'KE = ½mv² = ½×2×25 = 25 J', 'Medium', 'FALSE', 45, 1],
    ['Physics', 'Laws of Motion', 'Session 1',
      'The SI unit of force is:',
      'Joule', 'Watt', 'Newton', 'Pascal', 'C',
      'Force is measured in Newton (N).', 'Easy', 'FALSE', 30, 2],
    ['Physics', 'Motion in a Straight Line', 'Session 2',
      'Which of the following is a scalar quantity?',
      'Velocity', 'Acceleration', 'Force', 'Speed', 'D',
      'Speed has only magnitude.', 'Medium', 'FALSE', 45, 3],
    ['Chemistry', 'Atomic Structure', 'Session 1',
      'The atomic number of Carbon is:',
      '6', '12', '8', '14', 'A',
      'Carbon has 6 protons.', 'Easy', 'FALSE', 30, 4],
    ['Chemistry', 'Chemical Reactions', 'Session 2',
      'Which gas is evolved when zinc reacts with dilute H₂SO₄?',
      'Oxygen', 'Hydrogen', 'Nitrogen', 'Carbon dioxide', 'B',
      'Zn + H₂SO₄ → ZnSO₄ + H₂↑', 'Medium', 'FALSE', 45, 5],
    ['Physics', 'Units & Dimensions', 'Session 3',
      'The dimensional formula of power is:',
      '[ML²T⁻³]', '[MLT⁻²]', '[ML²T⁻²]', '[MLT⁻¹]', 'A',
      'Power = Work/Time = [ML²T⁻³]', 'Hard', 'FALSE', 60, 6],
    ['Chemistry', 'Equilibrium', 'Session 3',
      'pH of a neutral solution at 25°C is:',
      '0', '7', '14', '1', 'B',
      'pH = 7 for neutral solution at 25°C.', 'Easy', 'FALSE', 30, 7],
    ['Physics', 'Ray Optics', 'Session 4',
      'A convex lens forms a real inverted image when object is placed:',
      'At focus', 'Between focus and optical centre', 'Beyond 2F', 'At optical centre', 'C',
      'Object beyond 2F → real, inverted image between F and 2F.', 'Medium', 'FALSE', 45, 8]
  ];
  samples.forEach(function (r) { sh.appendRow(r); });
}

function setupUsers_(ss) {
  let sh = ss.getSheetByName(SHEET_USERS);
  if (!sh) sh = ss.insertSheet(SHEET_USERS);
  sh.clear();
  sh.appendRow(['ID', 'Email', 'Mobile', 'Name', 'PasswordHash', 'CreatedAt', 'LastLogin', 'IsLocked', 'TimerLocked', 'ForcedTimer']);
  sh.setFrozenRows(1);
}

function setupAttempts_(ss) {
  let sh = ss.getSheetByName(SHEET_ATTEMPTS);
  if (!sh) sh = ss.insertSheet(SHEET_ATTEMPTS);
  sh.clear();
  sh.appendRow(['ID', 'Email', 'Subject', 'Unit', 'Session', 'Difficulty', 'Total', 'Correct', 'Wrong', 'Percentage', 'DurationSec', 'CompletedAt', 'Date', 'Time', 'AnswersJSON']);
  sh.setFrozenRows(1);
}

function setupSettings_(ss) {
  let sh = ss.getSheetByName(SHEET_SETTINGS);
  if (!sh) sh = ss.insertSheet(SHEET_SETTINGS);
  sh.clear();
  sh.appendRow(['Key', 'Value']);
  sh.appendRow(['lockAllTimers', 'false']);
  sh.appendRow(['defaultTimer', '45']);
  sh.appendRow(['watermarkMode', 'default']);
  sh.appendRow(['watermarkCustom', 'MCQ Quiz Module']);
  sh.appendRow(['lockAllDifficulty', 'false']);
  sh.appendRow(['defaultDifficulty', 'All']);
}

// =============================================================================
// HTTP
// =============================================================================
function doGet(e) { return handle_(e); }
function doPost(e) { return handle_(e); }

function handle_(e) {
  try {
    const params = (e && e.parameter) || {};
    let body = {};
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
    }
    const action = params.action || body.action || '';
    const data = body.data !== undefined ? body.data : body;
    let result;

    switch (action) {
      case 'getQuestions': result = getQuestions(params); break;
      case 'addQuestion': result = addQuestion(data); break;
      case 'updateQuestion': result = updateQuestion(data); break;
      case 'deleteQuestion': result = deleteQuestion(data.qNo || params.qNo); break;
      case 'bulkAddQuestions': result = bulkAddQuestions(data.questions || data); break;
      case 'getUsers': result = getUsers(); break;
      case 'registerUser': result = registerUser(data); break;
      case 'loginUser': result = loginUser(data); break;
      case 'updateUser': result = updateUser(data); break;
      case 'deleteUser': result = deleteUser(data.email || params.email); break;
      case 'getAttempts': result = getAttempts(params.email || data.email); break;
      case 'getAllAttempts': result = getAllAttempts(); break;
      case 'saveAttempt': result = saveAttempt(data); break;
      case 'getSettings': result = getSettings(); break;
      case 'saveSettings': result = saveSettings(data); break;
      case 'ping': result = { ok: true, time: new Date().toISOString() }; break;
      default: result = { error: 'Unknown action: ' + action };
    }
    return json_(result);
  } catch (err) {
    return json_({ error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// QUESTIONS
// =============================================================================
function getQuestions(params) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { questions: [] };

  let questions = values.slice(1).map(function (row, idx) { return rowToQ_(row, idx); });

  if (params.subject || params.category) {
    const s = String(params.subject || params.category);
    questions = questions.filter(function (q) { return q.subject === s; });
  }
  if (params.unit) {
    const u = String(params.unit);
    questions = questions.filter(function (q) { return q.unit === u; });
  }
  if (params.session) {
    const s = String(params.session);
    questions = questions.filter(function (q) { return q.session === s; });
  }
  if (params.difficulty && params.difficulty !== 'All') {
    const d = String(params.difficulty);
    questions = questions.filter(function (q) { return q.difficulty === d; });
  }
  if (params.forStudent === '1' || params.forStudent === 'true') {
    questions = questions.filter(function (q) { return !q.locked; });
  }
  return { questions: questions };
}

function rowToQ_(row, idx) {
  const locked = row[Q.LOCKED];
  return {
    subject: String(row[Q.SUBJECT] || ''),
    unit: String(row[Q.UNIT] || ''),
    session: String(row[Q.SESSION] || ''),
    question: String(row[Q.QUESTION] || ''),
    optionA: String(row[Q.OPTION_A] || ''),
    optionB: String(row[Q.OPTION_B] || ''),
    optionC: String(row[Q.OPTION_C] || ''),
    optionD: String(row[Q.OPTION_D] || ''),
    correctAnswer: String(row[Q.CORRECT] || '').toUpperCase(),
    rightAnswer: String(row[Q.CORRECT] || '').toUpperCase(),
    explanation: String(row[Q.EXPLANATION] || ''),
    difficulty: String(row[Q.DIFFICULTY] || 'Medium'),
    locked: locked === true || locked === 'TRUE' || locked === 'true',
    timerSeconds: Number(row[Q.TIMER]) || 45,
    qNo: Number(row[Q.QNO]) || (idx + 1),
    // aliases for older client code
    category: String(row[Q.SUBJECT] || ''),
    questionBank: String(row[Q.UNIT] || ''),
    relevantSession: String(row[Q.SESSION] || '')
  };
}

function qToRow_(q) {
  return [
    q.subject || q.category || '',
    q.unit || q.questionBank || '',
    q.session || q.relevantSession || '',
    q.question || '',
    q.optionA || '',
    q.optionB || '',
    q.optionC || '',
    q.optionD || '',
    q.correctAnswer || q.rightAnswer || '',
    q.explanation || '',
    q.difficulty || 'Medium',
    q.locked ? 'TRUE' : 'FALSE',
    q.timerSeconds || 45,
    q.qNo || ''
  ];
}

function nextQNo_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return 1;
  const nos = sh.getRange(2, Q.QNO + 1, last - 1, 1).getValues().map(function (r) { return Number(r[0]) || 0; });
  return Math.max.apply(null, nos.concat([0])) + 1;
}

function addQuestion(data) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  data.qNo = nextQNo_(sh);
  sh.appendRow(qToRow_(data));
  return { success: true, question: data };
}

function updateQuestion(data) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  const values = sh.getDataRange().getValues();
  const qNo = Number(data.qNo);
  for (let i = 1; i < values.length; i++) {
    if (Number(values[i][Q.QNO]) === qNo) {
      const row = qToRow_(data);
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { success: true, question: data };
    }
  }
  return { success: false, error: 'Question not found' };
}

function deleteQuestion(qNo) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  const values = sh.getDataRange().getValues();
  qNo = Number(qNo);
  for (let i = 1; i < values.length; i++) {
    if (Number(values[i][Q.QNO]) === qNo) {
      sh.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Question not found' };
}

function bulkAddQuestions(list) {
  if (!Array.isArray(list)) return { success: false, error: 'Expected array' };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  let next = nextQNo_(sh);
  let added = 0;
  list.forEach(function (q) {
    q.qNo = next++;
    sh.appendRow(qToRow_(q));
    added++;
  });
  return { success: true, added: added };
}

// =============================================================================
// USERS
// =============================================================================
function getUsers() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { users: [] };
  return {
    users: values.slice(1).map(function (row) {
      return {
        id: String(row[0] || ''),
        email: String(row[1] || '').toLowerCase(),
        mobile: String(row[2] || ''),
        name: String(row[3] || ''),
        passwordHash: String(row[4] || ''),
        createdAt: formatSheetDateTime_(row[5]),
        lastLogin: row[6] ? formatSheetDateTime_(row[6]) : null,
        isLocked: isT_(row[7]),
        timerLocked: isT_(row[8]),
        forcedTimer: Number(row[9]) || 45
      };
    })
  };
}

function findUser_(email) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const values = sh.getDataRange().getValues();
  email = String(email).toLowerCase();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === email) {
      return { sheet: sh, rowIndex: i + 1, row: values[i] };
    }
  }
  return null;
}

function ensureUser_(email, name, mobile) {
  email = String(email || '').trim().toLowerCase();
  if (!email || findUser_(email)) return;
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS).appendRow([
    'u_' + Date.now(), email, String(mobile || ''), String(name || email.split('@')[0]),
    '', new Date().toISOString(), '', 'FALSE', 'FALSE', 45
  ]);
}

function registerUser(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const mobile = String(data.mobile || '').trim();
  const password = String(data.password || '');
  const name = String(data.name || email.split('@')[0]);
  if (!email || !mobile || !password) return { success: false, message: 'All fields are required.' };
  if (findUser_(email)) return { success: false, message: 'Email already registered.' };
  const hash = hash_(password);
  const id = 'u_' + Date.now();
  const createdAt = new Date().toISOString();
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS).appendRow([
    id, email, mobile, name, hash, createdAt, '',
    data.isLocked ? 'TRUE' : 'FALSE', data.timerLocked ? 'TRUE' : 'FALSE', data.forcedTimer || 45
  ]);
  return {
    success: true, message: 'Registration successful!',
    user: { id: id, email: email, mobile: mobile, name: name, createdAt: createdAt, lastLogin: null, isLocked: false, timerLocked: false, forcedTimer: 45 }
  };
}

function loginUser(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  const found = findUser_(email);
  if (!found) return { success: false, message: 'No account found with this email.' };
  const row = found.row;
  if (isT_(row[7])) return { success: false, message: 'Your account has been locked by admin.' };
  if (String(row[4]) !== hash_(password)) {
    if (!row[4]) return { success: false, message: 'Account incomplete. Please register again.' };
    return { success: false, message: 'Incorrect password.' };
  }
  const lastLogin = new Date().toISOString();
  found.sheet.getRange(found.rowIndex, 7).setValue(lastLogin);
  return {
    success: true, message: 'Login successful!',
    user: {
      id: String(row[0]), email: String(row[1]).toLowerCase(), mobile: String(row[2]), name: String(row[3]),
      lastLogin: lastLogin, isLocked: false, timerLocked: isT_(row[8]), forcedTimer: Number(row[9]) || 45
    }
  };
}

function updateUser(data) {
  const found = findUser_(data.email);
  if (!found) return { success: false, error: 'User not found' };
  const row = found.row;
  let hash = row[4];
  if (data.password && String(data.password).length >= 6) hash = hash_(data.password);
  found.sheet.getRange(found.rowIndex, 1, 1, 10).setValues([[
    row[0], String(data.email).toLowerCase(),
    data.mobile !== undefined ? data.mobile : row[2],
    data.name !== undefined ? data.name : row[3],
    hash, row[5], row[6],
    (data.isLocked !== undefined ? data.isLocked : isT_(row[7])) ? 'TRUE' : 'FALSE',
    (data.timerLocked !== undefined ? data.timerLocked : isT_(row[8])) ? 'TRUE' : 'FALSE',
    data.forcedTimer !== undefined ? data.forcedTimer : (Number(row[9]) || 45)
  ]]);
  return { success: true };
}

function deleteUser(email) {
  const found = findUser_(email);
  if (!found) return { success: false, error: 'User not found' };
  found.sheet.deleteRow(found.rowIndex);
  return { success: true };
}

function hash_(str) {
  let h = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h = h & h;
  }
  return h.toString(36);
}

function isT_(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
}

// =============================================================================
// ATTEMPTS
// =============================================================================

/** Format Sheet cell (Date or string) → simple dd/MM/yyyy or HH:mm */
function formatSheetDate_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    var y = v.getFullYear();
    // Sheets stores pure times as 1899-12-30
    if (y < 1900) {
      return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
    }
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  var s = String(v).trim();
  // Already a long GMT string → try parse
  if (/GMT/i.test(s) || /1899/.test(s)) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() < 1900) {
        return Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm');
      }
      return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    }
  }
  return s;
}

function formatSheetDateTime_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    if (v.getFullYear() < 1900) {
      return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
    }
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  }
  var s = String(v).trim();
  if (/GMT/i.test(s)) {
    var d = new Date(s);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 1900) {
      return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    }
  }
  return s;
}

function getAttempts(email) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTEMPTS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { attempts: [] };
  email = email ? String(email).toLowerCase() : '';
  const attempts = values.slice(1)
    .filter(function (row) { return !email || String(row[1]).toLowerCase() === email; })
    .map(function (row) {
      return {
        id: String(row[0] || ''),
        email: String(row[1] || '').toLowerCase(),
        subject: String(row[2] || ''),
        unit: String(row[3] || ''),
        session: String(row[4] || ''),
        category: String(row[2] || ''),
        difficulty: String(row[5] || ''),
        total: Number(row[6]) || 0,
        correct: Number(row[7]) || 0,
        wrong: Number(row[8]) || 0,
        percentage: Number(row[9]) || 0,
        durationSec: Number(row[10]) || 0,
        completedAt: formatSheetDateTime_(row[11]),
        date: formatSheetDate_(row[12]) || formatSheetDate_(row[11]),
        time: formatSheetDate_(row[13]),
        answers: tryJSON_(row[14])
      };
    });
  attempts.sort(function (a, b) { return new Date(b.completedAt || 0) - new Date(a.completedAt || 0); });
  return { attempts: attempts };
}

function getAllAttempts() { return getAttempts(null); }

function saveAttempt(data) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTEMPTS);
  const id = data.id || ('att_' + Date.now());
  const email = String(data.email || '').toLowerCase();
  ensureUser_(email, data.name, data.mobile);
  sh.appendRow([
    id, email,
    data.subject || data.category || '',
    data.unit || '',
    data.session || '',
    data.difficulty || '',
    data.total || 0, data.correct || 0, data.wrong || 0, data.percentage || 0,
    data.durationSec || 0,
    data.completedAt || new Date().toISOString(),
    // Prefix with ' so Sheets stores as text (avoids 1899 time bug)
    data.date ? ("'" + String(data.date).replace(/^'/, '')) : '',
    data.time ? ("'" + String(data.time).replace(/^'/, '')) : '',
    JSON.stringify(data.answers || [])
  ]);
  return { success: true, id: id };
}

function tryJSON_(v) {
  if (!v) return [];
  try { return JSON.parse(String(v)); } catch (e) { return []; }
}

// =============================================================================
// SETTINGS
// =============================================================================
function getSettings() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const values = sh.getDataRange().getValues();
  const settings = { lockAllTimers: false, defaultTimer: 45, lockAllDifficulty: false, defaultDifficulty: 'All', watermarkMode: 'default', watermarkCustom: 'MCQ Quiz Module' };
  values.slice(1).forEach(function (row) {
    const key = String(row[0]);
    const val = row[1];
    if (key === 'lockAllTimers') settings.lockAllTimers = isT_(val);
    else if (key === 'defaultTimer') settings.defaultTimer = Number(val) || 45;
    else if (key === 'lockAllDifficulty') settings.lockAllDifficulty = isT_(val);
    else if (key === 'defaultDifficulty') settings.defaultDifficulty = String(val || 'All');
    else if (key === 'watermarkMode') settings.watermarkMode = String(val || 'default');
    else if (key === 'watermarkCustom') settings.watermarkCustom = String(val || 'MCQ Quiz Module');
  });
  return { settings: settings };
}

function saveSettings(data) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const map = {
    lockAllTimers: data.lockAllTimers ? 'true' : 'false',
    defaultTimer: String(data.defaultTimer || 45),
    lockAllDifficulty: data.lockAllDifficulty ? 'true' : 'false',
    defaultDifficulty: data.defaultDifficulty || 'All',
    watermarkMode: data.watermarkMode || 'default',
    watermarkCustom: data.watermarkCustom || 'MCQ Quiz Module'
  };
  const values = sh.getDataRange().getValues();
  Object.keys(map).forEach(function (key) {
    let found = false;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === key) {
        sh.getRange(i + 1, 2).setValue(map[key]);
        found = true;
        break;
      }
    }
    if (!found) sh.appendRow([key, map[key]]);
  });
  return { success: true, settings: data };
}

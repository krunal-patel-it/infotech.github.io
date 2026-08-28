/**
 * =============================================================================
 * MCQ Quiz Module – Google Apps Script Backend (Code.gs)
 * =============================================================================
 *
 * SETUP
 * 1. Open your Google Spreadsheet
 * 2. Extensions → Apps Script → paste this entire file → Save
 * 3. Select function setupSpreadsheet → Run (authorize when asked)
 * 4. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL (ends with /exec) into:
 *    admin/js/config.js  and  student/js/config.js
 *    Set USE_GOOGLE_SHEETS: true in both files
 *
 * After any later edit to this file:
 * Deploy → Manage deployments → Edit (pencil) → New version → Deploy
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Sheet names
// ---------------------------------------------------------------------------
const SHEET_QUESTIONS = 'Questions';
const SHEET_USERS = 'Users';
const SHEET_ATTEMPTS = 'Attempts';
const SHEET_SETTINGS = 'Settings';

// Questions sheet columns (0-based index)
// Subject | Unit/Chapter | Session | Q. No. | Question |
// Option A | Option B | Option C | Option D | Right Answer |
// Explanation | Difficulty | Previous Board Exam? | PYQ Status |
// PYQ / Source Year | Source Type | Verification Note | Locked | Timer Seconds
const Q_COL = {
  SUBJECT: 0,
  UNIT: 1,
  SESSION: 2,
  QNO: 3,
  QUESTION: 4,
  OPTION_A: 5,
  OPTION_B: 6,
  OPTION_C: 7,
  OPTION_D: 8,
  RIGHT_ANSWER: 9,
  EXPLANATION: 10,
  DIFFICULTY: 11,
  PREV_BOARD: 12,
  PYQ_STATUS: 13,
  PYQ_SOURCE_YEAR: 14,
  SOURCE_TYPE: 15,
  VERIFICATION: 16,
  LOCKED: 17,
  TIMER: 18
};

// =============================================================================
// ONE-TIME SETUP
// =============================================================================
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  setupQuestionsSheet_(ss);
  setupUsersSheet_(ss);
  setupAttemptsSheet_(ss);
  setupSettingsSheet_(ss);

  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) {
    try { ss.deleteSheet(def); } catch (e) {}
  }

  SpreadsheetApp.getUi().alert(
    'Setup complete!\n\nSheets created:\n• Questions\n• Users\n• Attempts\n• Settings'
  );
}

function setupQuestionsSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_QUESTIONS);
  if (!sh) sh = ss.insertSheet(SHEET_QUESTIONS);
  sh.clear();

  sh.appendRow([
    'Subject', 'Unit/Chapter', 'Session', 'Q. No.', 'Question',
    'Option A', 'Option B', 'Option C', 'Option D', 'Right Answer',
    'Explanation', 'Difficulty', 'Previous Board Exam?', 'PYQ Status',
    'PYQ / Source Year', 'Source Type', 'Verification Note', 'Locked', 'Timer Seconds'
  ]);
  sh.setFrozenRows(1);

  const samples = [
    ['Physics', 'Work, Energy & Power', 'Session 1 – Work, Energy & Power', 1,
      'A body of mass 2 kg is moving with a velocity of 5 m/s. What is its kinetic energy?',
      '10 J', '25 J', '50 J', '100 J', 'B',
      'Kinetic Energy = ½ mv² = ½ × 2 × 5² = 25 J', 'Medium', 'No', '', '', '',
      'Verified', 'FALSE', 45],
    ['Physics', 'Laws of Motion', 'Session 1 – Laws of Motion', 2,
      'The SI unit of force is:',
      'Joule', 'Watt', 'Newton', 'Pascal', 'C',
      'Force is measured in Newton (N). 1 N = 1 kg·m/s²', 'Easy', 'Yes', 'Confirmed', 'CBSE 2023', 'Board',
      '', 'FALSE', 30],
    ['Physics', 'Motion in a Straight Line', 'Session 2 – Motion in a Straight Line', 3,
      'Which of the following is a scalar quantity?',
      'Velocity', 'Acceleration', 'Force', 'Speed', 'D',
      'Speed has only magnitude, while velocity, acceleration and force are vectors.', 'Medium', 'No', '', '', '',
      '', 'FALSE', 45],
    ['Chemistry', 'Atomic Structure', 'Session 1 – Atomic Structure', 4,
      'The atomic number of Carbon is:',
      '6', '12', '8', '14', 'A',
      'Carbon has 6 protons, so its atomic number is 6. Mass number is 12.', 'Easy', 'Yes', 'Confirmed', 'NCERT 2022', 'Textbook',
      '', 'FALSE', 30],
    ['Chemistry', 'Chemical Reactions', 'Session 2 – Chemical Reactions', 5,
      'Which gas is evolved when zinc reacts with dilute H₂SO₄?',
      'Oxygen', 'Hydrogen', 'Nitrogen', 'Carbon dioxide', 'B',
      'Zn + H₂SO₄ → ZnSO₄ + H₂↑. Hydrogen gas is liberated.', 'Medium', 'No', '', '', '',
      'Lab verified', 'FALSE', 45],
    ['Physics', 'Units & Dimensions', 'Session 3 – Units & Dimensions', 6,
      'The dimensional formula of power is:',
      '[ML²T⁻³]', '[MLT⁻²]', '[ML²T⁻²]', '[MLT⁻¹]', 'A',
      'Power = Work/Time = (Force × Displacement)/Time = [MLT⁻²][L]/[T] = [ML²T⁻³]', 'Hard', 'Yes', 'Confirmed', 'JEE Main 2021', 'Entrance',
      '', 'FALSE', 60],
    ['Chemistry', 'Equilibrium', 'Session 3 – Equilibrium', 7,
      'pH of a neutral solution at 25°C is:',
      '0', '7', '14', '1', 'B',
      'At 25°C, pure water has [H⁺] = 10⁻⁷ mol/L, so pH = 7.', 'Easy', 'Yes', 'Confirmed', 'CBSE 2024', 'Board',
      '', 'FALSE', 30],
    ['Physics', 'Ray Optics', 'Session 4 – Ray Optics', 8,
      'A convex lens forms a real inverted image when object is placed:',
      'At focus', 'Between focus and optical centre', 'Beyond 2F', 'At optical centre', 'C',
      'When object is beyond 2F, convex lens forms a real, inverted and diminished image between F and 2F.', 'Medium', 'No', '', '', '',
      '', 'FALSE', 45]
  ];

  samples.forEach(function (row) { sh.appendRow(row); });
}

function setupUsersSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_USERS);
  if (!sh) sh = ss.insertSheet(SHEET_USERS);
  sh.clear();
  sh.appendRow([
    'ID', 'Email', 'Mobile', 'Name', 'PasswordHash', 'CreatedAt', 'LastLogin',
    'IsLocked', 'TimerLocked', 'ForcedTimer'
  ]);
  sh.setFrozenRows(1);
}

function setupAttemptsSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_ATTEMPTS);
  if (!sh) sh = ss.insertSheet(SHEET_ATTEMPTS);
  sh.clear();
  sh.appendRow([
    'ID', 'Email', 'Category', 'Session', 'Difficulty', 'Total', 'Correct', 'Wrong',
    'Percentage', 'DurationSec', 'CompletedAt', 'Date', 'Time', 'AnswersJSON'
  ]);
  sh.setFrozenRows(1);
}

function setupSettingsSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_SETTINGS);
  if (!sh) sh = ss.insertSheet(SHEET_SETTINGS);
  sh.clear();
  sh.appendRow(['Key', 'Value']);
  sh.appendRow(['lockAllTimers', 'false']);
  sh.appendRow(['defaultTimer', '45']);
  sh.appendRow(['watermarkMode', 'default']);
  sh.appendRow(['watermarkCustom', 'MCQ Quiz Module']);
}

// =============================================================================
// HTTP ENTRY POINTS
// =============================================================================
function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function handleRequest_(e, method) {
  try {
    const params = (e && e.parameter) || {};
    let body = {};

    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (err) {
        body = {};
      }
    }

    const action = params.action || body.action || '';
    const data = body.data !== undefined ? body.data : body;
    let result;

    switch (action) {
      case 'getQuestions':
        result = getQuestions(params);
        break;
      case 'addQuestion':
        result = addQuestion(data);
        break;
      case 'updateQuestion':
        result = updateQuestion(data);
        break;
      case 'deleteQuestion':
        result = deleteQuestion(data.qNo || params.qNo);
        break;
      case 'bulkAddQuestions':
        result = bulkAddQuestions(data.questions || data);
        break;
      case 'getUsers':
        result = getUsers();
        break;
      case 'registerUser':
        result = registerUser(data);
        break;
      case 'loginUser':
        result = loginUser(data);
        break;
      case 'updateUser':
        result = updateUser(data);
        break;
      case 'deleteUser':
        result = deleteUser(data.email || params.email);
        break;
      case 'getAttempts':
        result = getAttempts(params.email || data.email);
        break;
      case 'getAllAttempts':
        result = getAllAttempts();
        break;
      case 'saveAttempt':
        result = saveAttempt(data);
        break;
      case 'getSettings':
        result = getSettings();
        break;
      case 'saveSettings':
        result = saveSettings(data);
        break;
      case 'ping':
        result = { ok: true, time: new Date().toISOString() };
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }

    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_({ error: String(err.message || err), stack: String(err.stack || '') });
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// QUESTIONS
// =============================================================================
function getQuestions(params) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { questions: [] };

  let questions = values.slice(1).map(function (row, idx) {
    return rowToQuestion_(row, idx);
  });

  if (params.category) {
    const cat = String(params.category);
    questions = questions.filter(function (q) { return q.category === cat; });
  }
  if (params.session) {
    const sess = String(params.session);
    questions = questions.filter(function (q) { return q.relevantSession === sess; });
  }
  if (params.difficulty && params.difficulty !== 'All') {
    const diff = String(params.difficulty);
    questions = questions.filter(function (q) { return q.difficulty === diff; });
  }
  if (params.forStudent === '1' || params.forStudent === 'true') {
    questions = questions.filter(function (q) { return !q.locked; });
  }

  return { questions: questions };
}

function rowToQuestion_(row, idx) {
  const lockedVal = row[Q_COL.LOCKED];
  const sourceYear = String(row[Q_COL.PYQ_SOURCE_YEAR] || '');
  const sourceType = String(row[Q_COL.SOURCE_TYPE] || '');
  let verificationNote = String(row[Q_COL.VERIFICATION] || '');

  if (sourceType && verificationNote.indexOf(sourceType) === -1) {
    verificationNote = verificationNote
      ? verificationNote + ' | Source Type: ' + sourceType
      : 'Source Type: ' + sourceType;
  }

  return {
    qNo: Number(row[Q_COL.QNO]) || (idx + 1),
    category: String(row[Q_COL.SUBJECT] || ''),
    questionBank: String(row[Q_COL.UNIT] || ''),
    relevantSession: String(row[Q_COL.SESSION] || ''),
    question: String(row[Q_COL.QUESTION] || ''),
    optionA: String(row[Q_COL.OPTION_A] || ''),
    optionB: String(row[Q_COL.OPTION_B] || ''),
    optionC: String(row[Q_COL.OPTION_C] || ''),
    optionD: String(row[Q_COL.OPTION_D] || ''),
    rightAnswer: String(row[Q_COL.RIGHT_ANSWER] || '').toUpperCase(),
    explanation: String(row[Q_COL.EXPLANATION] || ''),
    difficulty: String(row[Q_COL.DIFFICULTY] || 'Medium'),
    previousBoardExam: String(row[Q_COL.PREV_BOARD] || 'No'),
    pyqStatus: String(row[Q_COL.PYQ_STATUS] || ''),
    pyqSource: sourceYear,
    year: '',
    sourceType: sourceType,
    verificationNote: verificationNote,
    locked: lockedVal === true || lockedVal === 'TRUE' || lockedVal === 'true',
    timerSeconds: Number(row[Q_COL.TIMER]) || 45
  };
}

function questionToRow_(q) {
  const sourceYear = q.pyqSource || q.year || '';
  const sourceType = q.sourceType || '';

  return [
    q.category || '',
    q.questionBank || '',
    q.relevantSession || '',
    q.qNo || '',
    q.question || '',
    q.optionA || '',
    q.optionB || '',
    q.optionC || '',
    q.optionD || '',
    q.rightAnswer || '',
    q.explanation || '',
    q.difficulty || 'Medium',
    q.previousBoardExam || 'No',
    q.pyqStatus || '',
    sourceYear,
    sourceType,
    q.verificationNote || '',
    q.locked ? 'TRUE' : 'FALSE',
    q.timerSeconds || 45
  ];
}

function nextQuestionNumber_(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 1;
  const nos = sh.getRange(2, Q_COL.QNO + 1, lastRow - 1, 1).getValues().map(function (r) {
    return Number(r[0]) || 0;
  });
  return Math.max.apply(null, nos.concat([0])) + 1;
}

function addQuestion(data) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  data.qNo = nextQuestionNumber_(sh);
  sh.appendRow(questionToRow_(data));
  return { success: true, question: data };
}

function updateQuestion(data) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  const values = sh.getDataRange().getValues();
  const qNo = Number(data.qNo);

  for (let i = 1; i < values.length; i++) {
    if (Number(values[i][Q_COL.QNO]) === qNo) {
      const row = questionToRow_(data);
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
    if (Number(values[i][Q_COL.QNO]) === qNo) {
      sh.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Question not found' };
}

function bulkAddQuestions(list) {
  if (!Array.isArray(list)) {
    return { success: false, error: 'Expected array of questions' };
  }

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  let nextNo = nextQuestionNumber_(sh);
  let added = 0;

  list.forEach(function (q) {
    q.qNo = nextNo++;
    sh.appendRow(questionToRow_(q));
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

  const users = values.slice(1).map(function (row) {
    return {
      id: String(row[0] || ''),
      email: String(row[1] || '').toLowerCase(),
      mobile: String(row[2] || ''),
      name: String(row[3] || ''),
      passwordHash: String(row[4] || ''),
      createdAt: String(row[5] || ''),
      lastLogin: row[6] ? String(row[6]) : null,
      isLocked: isTruthy_(row[7]),
      timerLocked: isTruthy_(row[8]),
      forcedTimer: Number(row[9]) || 45
    };
  });

  return { users: users };
}

function findUserRow_(email) {
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

function ensureUserStub_(email, name, mobile) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return;
  if (findUserRow_(email)) return;

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  sh.appendRow([
    'u_' + Date.now(),
    email,
    String(mobile || ''),
    String(name || email.split('@')[0]),
    '',
    new Date().toISOString(),
    '',
    'FALSE',
    'FALSE',
    45
  ]);
}

function registerUser(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const mobile = String(data.mobile || '').trim();
  const password = String(data.password || '');
  const name = String(data.name || email.split('@')[0]);

  if (!email || !mobile || !password) {
    return { success: false, message: 'All fields are required.' };
  }
  if (findUserRow_(email)) {
    return { success: false, message: 'Email already registered.' };
  }

  const hash = simpleHash_(password);
  const id = 'u_' + Date.now();
  const createdAt = new Date().toISOString();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);

  sh.appendRow([
    id, email, mobile, name, hash, createdAt, '',
    data.isLocked ? 'TRUE' : 'FALSE',
    data.timerLocked ? 'TRUE' : 'FALSE',
    data.forcedTimer || 45
  ]);

  return {
    success: true,
    message: 'Registration successful!',
    user: {
      id: id,
      email: email,
      mobile: mobile,
      name: name,
      createdAt: createdAt,
      lastLogin: null,
      isLocked: false,
      timerLocked: false,
      forcedTimer: 45
    }
  };
}

function loginUser(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  const found = findUserRow_(email);

  if (!found) {
    return { success: false, message: 'No account found with this email.' };
  }

  const row = found.row;
  if (isTruthy_(row[7])) {
    return { success: false, message: 'Your account has been locked by admin.' };
  }

  const hash = simpleHash_(password);
  if (String(row[4]) !== hash) {
    if (!row[4]) {
      return {
        success: false,
        message: 'Account incomplete. Please register again with this email.'
      };
    }
    return { success: false, message: 'Incorrect password.' };
  }

  const lastLogin = new Date().toISOString();
  found.sheet.getRange(found.rowIndex, 7).setValue(lastLogin);

  return {
    success: true,
    message: 'Login successful!',
    user: {
      id: String(row[0]),
      email: String(row[1]).toLowerCase(),
      mobile: String(row[2]),
      name: String(row[3]),
      lastLogin: lastLogin,
      isLocked: false,
      timerLocked: isTruthy_(row[8]),
      forcedTimer: Number(row[9]) || 45
    }
  };
}

function updateUser(data) {
  const found = findUserRow_(data.email);
  if (!found) return { success: false, error: 'User not found' };

  const row = found.row;
  const name = data.name !== undefined ? data.name : row[3];
  const mobile = data.mobile !== undefined ? data.mobile : row[2];
  const isLocked = data.isLocked !== undefined ? data.isLocked : isTruthy_(row[7]);
  const timerLocked = data.timerLocked !== undefined ? data.timerLocked : isTruthy_(row[8]);
  const forcedTimer = data.forcedTimer !== undefined ? data.forcedTimer : (Number(row[9]) || 45);

  let hash = row[4];
  if (data.password && String(data.password).length >= 6) {
    hash = simpleHash_(data.password);
  }

  found.sheet.getRange(found.rowIndex, 1, 1, 10).setValues([[
    row[0],
    String(data.email).toLowerCase(),
    mobile,
    name,
    hash,
    row[5],
    row[6],
    isLocked ? 'TRUE' : 'FALSE',
    timerLocked ? 'TRUE' : 'FALSE',
    forcedTimer
  ]]);

  return { success: true };
}

function deleteUser(email) {
  const found = findUserRow_(email);
  if (!found) return { success: false, error: 'User not found' };
  found.sheet.deleteRow(found.rowIndex);
  return { success: true };
}

/** Must match frontend Auth._hash() */
function simpleHash_(str) {
  let hash = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function isTruthy_(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
}

// =============================================================================
// ATTEMPTS
// =============================================================================
function getAttempts(email) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTEMPTS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { attempts: [] };

  email = email ? String(email).toLowerCase() : '';

  const attempts = values.slice(1)
    .filter(function (row) {
      return !email || String(row[1]).toLowerCase() === email;
    })
    .map(function (row) {
      return {
        id: String(row[0] || ''),
        email: String(row[1] || '').toLowerCase(),
        category: String(row[2] || ''),
        session: String(row[3] || ''),
        difficulty: String(row[4] || ''),
        total: Number(row[5]) || 0,
        correct: Number(row[6]) || 0,
        wrong: Number(row[7]) || 0,
        percentage: Number(row[8]) || 0,
        durationSec: Number(row[9]) || 0,
        completedAt: String(row[10] || ''),
        date: String(row[11] || ''),
        time: String(row[12] || ''),
        answers: tryParseJSON_(row[13])
      };
    });

  attempts.sort(function (a, b) {
    return new Date(b.completedAt || 0) - new Date(a.completedAt || 0);
  });

  return { attempts: attempts };
}

function getAllAttempts() {
  return getAttempts(null);
}

function saveAttempt(data) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTEMPTS);
  const id = data.id || ('att_' + Date.now());
  const email = String(data.email || '').toLowerCase();

  ensureUserStub_(email, data.name, data.mobile);

  sh.appendRow([
    id,
    email,
    data.category || '',
    data.session || '',
    data.difficulty || '',
    data.total || 0,
    data.correct || 0,
    data.wrong || 0,
    data.percentage || 0,
    data.durationSec || 0,
    data.completedAt || new Date().toISOString(),
    data.date || '',
    data.time || '',
    JSON.stringify(data.answers || [])
  ]);

  return { success: true, id: id };
}

function tryParseJSON_(v) {
  if (!v) return [];
  try {
    return JSON.parse(String(v));
  } catch (e) {
    return [];
  }
}

// =============================================================================
// SETTINGS
// =============================================================================
function getSettings() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const values = sh.getDataRange().getValues();

  const settings = {
    lockAllTimers: false,
    defaultTimer: 45,
    watermarkMode: 'default',
    watermarkCustom: 'MCQ Quiz Module'
  };

  values.slice(1).forEach(function (row) {
    const key = String(row[0]);
    const val = row[1];
    if (key === 'lockAllTimers') {
      settings.lockAllTimers = isTruthy_(val);
    } else if (key === 'defaultTimer') {
      settings.defaultTimer = Number(val) || 45;
    } else if (key === 'watermarkMode') {
      settings.watermarkMode = String(val || 'default');
    } else if (key === 'watermarkCustom') {
      settings.watermarkCustom = String(val || 'MCQ Quiz Module');
    }
  });

  return { settings: settings };
}

function saveSettings(data) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const map = {
    lockAllTimers: data.lockAllTimers ? 'true' : 'false',
    defaultTimer: String(data.defaultTimer || 45),
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
    if (!found) {
      sh.appendRow([key, map[key]]);
    }
  });

  return { success: true, settings: data };
}

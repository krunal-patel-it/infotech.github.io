/**
 * MCQ Quiz Module – Google Apps Script Backend
 * =============================================
 * SETUP:
 * 1. Create a new Google Spreadsheet
 * 2. Extensions → Apps Script → paste this entire file
 * 3. Run setupSpreadsheet() once from the editor (authorize when asked)
 * 4. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL into config.js in both admin/ and student/ folders
 */

const SHEET_QUESTIONS = 'Questions';
const SHEET_USERS = 'Users';
const SHEET_ATTEMPTS = 'Attempts';
const SHEET_SETTINGS = 'Settings';

// ---------- Setup (run once) ----------
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Questions
  let sh = ss.getSheetByName(SHEET_QUESTIONS);
  if (!sh) sh = ss.insertSheet(SHEET_QUESTIONS);
  sh.clear();
  sh.appendRow([
    'Q. No.', 'Question Bank', 'Category', 'Difficulty', 'Question',
    'Option A', 'Option B', 'Option C', 'Option D', 'Right Answer',
    'Explanation', 'Previous Board Exam?', 'PYQ / Source', 'Year',
    'PYQ Status', 'Verification Note', 'Relevant Session',
    'Locked', 'Timer Seconds'
  ]);
  sh.setFrozenRows(1);
  // Sample rows
  sh.appendRow([1, 'NEET 2025', 'Physics', 'Medium',
    'A body of mass 2 kg is moving with a velocity of 5 m/s. What is its kinetic energy?',
    '10 J', '25 J', '50 J', '100 J', 'B',
    'Kinetic Energy = ½ mv² = ½ × 2 × 5² = 25 J', 'No', '', '', '', 'Verified',
    'Session 1 – Work, Energy & Power', 'FALSE', 45]);
  sh.appendRow([2, 'NEET 2025', 'Physics', 'Easy',
    'The SI unit of force is:',
    'Joule', 'Watt', 'Newton', 'Pascal', 'C',
    'Force is measured in Newton (N). 1 N = 1 kg·m/s²', 'Yes', 'CBSE', '2023', 'Confirmed', '',
    'Session 1 – Laws of Motion', 'FALSE', 30]);
  sh.appendRow([3, 'NEET 2025', 'Physics', 'Medium',
    'Which of the following is a scalar quantity?',
    'Velocity', 'Acceleration', 'Force', 'Speed', 'D',
    'Speed has only magnitude, while velocity, acceleration and force are vectors.', 'No', '', '', '', '',
    'Session 2 – Motion in a Straight Line', 'FALSE', 45]);
  sh.appendRow([4, 'NEET 2025', 'Chemistry', 'Easy',
    'The atomic number of Carbon is:',
    '6', '12', '8', '14', 'A',
    'Carbon has 6 protons, so its atomic number is 6. Mass number is 12.', 'Yes', 'NCERT', '2022', 'Confirmed', '',
    'Session 1 – Atomic Structure', 'FALSE', 30]);
  sh.appendRow([5, 'NEET 2025', 'Chemistry', 'Medium',
    'Which gas is evolved when zinc reacts with dilute H₂SO₄?',
    'Oxygen', 'Hydrogen', 'Nitrogen', 'Carbon dioxide', 'B',
    'Zn + H₂SO₄ → ZnSO₄ + H₂↑. Hydrogen gas is liberated.', 'No', '', '', '', 'Lab verified',
    'Session 2 – Chemical Reactions', 'FALSE', 45]);
  sh.appendRow([6, 'NEET 2025', 'Physics', 'Hard',
    'The dimensional formula of power is:',
    '[ML²T⁻³]', '[MLT⁻²]', '[ML²T⁻²]', '[MLT⁻¹]', 'A',
    'Power = Work/Time = (Force × Displacement)/Time = [MLT⁻²][L]/[T] = [ML²T⁻³]', 'Yes', 'JEE Main', '2021', 'Confirmed', '',
    'Session 3 – Units & Dimensions', 'FALSE', 60]);
  sh.appendRow([7, 'NEET 2025', 'Chemistry', 'Easy',
    'pH of a neutral solution at 25°C is:',
    '0', '7', '14', '1', 'B',
    'At 25°C, pure water has [H⁺] = 10⁻⁷ mol/L, so pH = 7.', 'Yes', 'CBSE', '2024', 'Confirmed', '',
    'Session 3 – Equilibrium', 'FALSE', 30]);
  sh.appendRow([8, 'NEET 2025', 'Physics', 'Medium',
    'A convex lens forms a real inverted image when object is placed:',
    'At focus', 'Between focus and optical centre', 'Beyond 2F', 'At optical centre', 'C',
    'When object is beyond 2F, convex lens forms a real, inverted and diminished image between F and 2F.', 'No', '', '', '', '',
    'Session 4 – Ray Optics', 'FALSE', 45]);

  // Users
  sh = ss.getSheetByName(SHEET_USERS);
  if (!sh) sh = ss.insertSheet(SHEET_USERS);
  sh.clear();
  sh.appendRow([
    'ID', 'Email', 'Mobile', 'Name', 'PasswordHash', 'CreatedAt', 'LastLogin',
    'IsLocked', 'TimerLocked', 'ForcedTimer'
  ]);
  sh.setFrozenRows(1);

  // Attempts
  sh = ss.getSheetByName(SHEET_ATTEMPTS);
  if (!sh) sh = ss.insertSheet(SHEET_ATTEMPTS);
  sh.clear();
  sh.appendRow([
    'ID', 'Email', 'Category', 'Session', 'Difficulty', 'Total', 'Correct', 'Wrong',
    'Percentage', 'DurationSec', 'CompletedAt', 'Date', 'Time', 'AnswersJSON'
  ]);
  sh.setFrozenRows(1);

  // Settings
  sh = ss.getSheetByName(SHEET_SETTINGS);
  if (!sh) sh = ss.insertSheet(SHEET_SETTINGS);
  sh.clear();
  sh.appendRow(['Key', 'Value']);
  sh.appendRow(['lockAllTimers', 'false']);
  sh.appendRow(['defaultTimer', '45']);
  sh.appendRow(['watermarkMode', 'default']);
  sh.appendRow(['watermarkCustom', 'MCQ Quiz Module']);

  // Remove default Sheet1 if empty
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) {
    try { ss.deleteSheet(def); } catch (e) {}
  }

  SpreadsheetApp.getUi().alert('Setup complete! Sheets created: Questions, Users, Attempts, Settings.');
}

// ---------- HTTP entry points ----------
function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    const params = e.parameter || {};
    let body = {};
    if (e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
    }
    const action = params.action || body.action || '';
    const data = body.data !== undefined ? body.data : body;

    let result;
    switch (action) {
      // Questions
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

      // Users
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

      // Attempts
      case 'getAttempts':
        result = getAttempts(params.email || data.email);
        break;
      case 'getAllAttempts':
        result = getAllAttempts();
        break;
      case 'saveAttempt':
        result = saveAttempt(data);
        break;

      // Settings
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

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message, stack: err.stack });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Questions ----------
function getQuestions(params) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { questions: [] };

  const headers = values[0];
  const rows = values.slice(1);
  let questions = rows.map((row, idx) => rowToQuestion(row, idx));

  // Optional filters
  if (params.category) {
    questions = questions.filter(q => q.category === params.category);
  }
  if (params.session) {
    questions = questions.filter(q => q.relevantSession === params.session);
  }
  if (params.difficulty && params.difficulty !== 'All') {
    questions = questions.filter(q => q.difficulty === params.difficulty);
  }
  // Students should not get locked questions for quiz (optional)
  if (params.forStudent === '1' || params.forStudent === 'true') {
    questions = questions.filter(q => !q.locked);
  }

  return { questions: questions };
}

function rowToQuestion(row, idx) {
  const lockedVal = row[17];
  return {
    qNo: Number(row[0]) || (idx + 1),
    questionBank: String(row[1] || ''),
    category: String(row[2] || ''),
    difficulty: String(row[3] || 'Medium'),
    question: String(row[4] || ''),
    optionA: String(row[5] || ''),
    optionB: String(row[6] || ''),
    optionC: String(row[7] || ''),
    optionD: String(row[8] || ''),
    rightAnswer: String(row[9] || '').toUpperCase(),
    explanation: String(row[10] || ''),
    previousBoardExam: String(row[11] || 'No'),
    pyqSource: String(row[12] || ''),
    year: String(row[13] || ''),
    pyqStatus: String(row[14] || ''),
    verificationNote: String(row[15] || ''),
    relevantSession: String(row[16] || ''),
    locked: lockedVal === true || lockedVal === 'TRUE' || lockedVal === 'true',
    timerSeconds: Number(row[18]) || 45
  };
}

function questionToRow(q) {
  return [
    q.qNo || '',
    q.questionBank || '',
    q.category || '',
    q.difficulty || 'Medium',
    q.question || '',
    q.optionA || '',
    q.optionB || '',
    q.optionC || '',
    q.optionD || '',
    q.rightAnswer || '',
    q.explanation || '',
    q.previousBoardExam || 'No',
    q.pyqSource || '',
    q.year || '',
    q.pyqStatus || '',
    q.verificationNote || '',
    q.relevantSession || '',
    q.locked ? 'TRUE' : 'FALSE',
    q.timerSeconds || 45
  ];
}

function addQuestion(data) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  const lastRow = sh.getLastRow();
  let nextNo = 1;
  if (lastRow > 1) {
    const nos = sh.getRange(2, 1, lastRow - 1, 1).getValues().map(r => Number(r[0]) || 0);
    nextNo = Math.max(...nos, 0) + 1;
  }
  data.qNo = nextNo;
  sh.appendRow(questionToRow(data));
  return { success: true, question: data };
}

function updateQuestion(data) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  const values = sh.getDataRange().getValues();
  const qNo = Number(data.qNo);
  for (let i = 1; i < values.length; i++) {
    if (Number(values[i][0]) === qNo) {
      const row = questionToRow(data);
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
    if (Number(values[i][0]) === qNo) {
      sh.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Question not found' };
}

function bulkAddQuestions(list) {
  if (!Array.isArray(list)) return { success: false, error: 'Expected array' };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  const lastRow = sh.getLastRow();
  let nextNo = 1;
  if (lastRow > 1) {
    const nos = sh.getRange(2, 1, lastRow - 1, 1).getValues().map(r => Number(r[0]) || 0);
    nextNo = Math.max(...nos, 0) + 1;
  }
  let added = 0;
  list.forEach(q => {
    q.qNo = nextNo++;
    sh.appendRow(questionToRow(q));
    added++;
  });
  return { success: true, added: added };
}

// ---------- Users ----------
function getUsers() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { users: [] };
  const users = values.slice(1).map(row => ({
    id: String(row[0] || ''),
    email: String(row[1] || '').toLowerCase(),
    mobile: String(row[2] || ''),
    name: String(row[3] || ''),
    passwordHash: String(row[4] || ''),
    createdAt: String(row[5] || ''),
    lastLogin: row[6] ? String(row[6]) : null,
    isLocked: row[7] === true || row[7] === 'TRUE' || row[7] === 'true',
    timerLocked: row[8] === true || row[8] === 'TRUE' || row[8] === 'true',
    forcedTimer: Number(row[9]) || 45
  }));
  return { users: users };
}

function findUserRow(email) {
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

function registerUser(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const mobile = String(data.mobile || '').trim();
  const password = String(data.password || '');
  const name = String(data.name || email.split('@')[0]);

  if (!email || !mobile || !password) {
    return { success: false, message: 'All fields are required.' };
  }
  if (findUserRow(email)) {
    return { success: false, message: 'Email already registered.' };
  }

  const hash = simpleHash(password);
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
    user: { id, email, mobile, name, createdAt, lastLogin: null, isLocked: false, timerLocked: false, forcedTimer: 45 }
  };
}

function loginUser(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  const found = findUserRow(email);
  if (!found) return { success: false, message: 'No account found with this email.' };

  const row = found.row;
  const isLocked = row[7] === true || row[7] === 'TRUE' || row[7] === 'true';
  if (isLocked) return { success: false, message: 'Your account has been locked by admin.' };

  const hash = simpleHash(password);
  if (String(row[4]) !== hash) {
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
      timerLocked: row[8] === true || row[8] === 'TRUE' || row[8] === 'true',
      forcedTimer: Number(row[9]) || 45
    }
  };
}

function updateUser(data) {
  const found = findUserRow(data.email);
  if (!found) return { success: false, error: 'User not found' };

  const row = found.row;
  const name = data.name !== undefined ? data.name : row[3];
  const mobile = data.mobile !== undefined ? data.mobile : row[2];
  const isLocked = data.isLocked !== undefined ? data.isLocked : (row[7] === true || row[7] === 'TRUE');
  const timerLocked = data.timerLocked !== undefined ? data.timerLocked : (row[8] === true || row[8] === 'TRUE');
  const forcedTimer = data.forcedTimer !== undefined ? data.forcedTimer : (Number(row[9]) || 45);
  let hash = row[4];
  if (data.password && String(data.password).length >= 6) {
    hash = simpleHash(data.password);
  }

  found.sheet.getRange(found.rowIndex, 1, 1, 10).setValues([[
    row[0], String(data.email).toLowerCase(), mobile, name, hash, row[5], row[6],
    isLocked ? 'TRUE' : 'FALSE',
    timerLocked ? 'TRUE' : 'FALSE',
    forcedTimer
  ]]);

  return { success: true };
}

function deleteUser(email) {
  const found = findUserRow(email);
  if (!found) return { success: false, error: 'User not found' };
  found.sheet.deleteRow(found.rowIndex);
  return { success: true };
}

function simpleHash(str) {
  // Must match frontend hash for compatibility
  let hash = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// ---------- Attempts ----------
function getAttempts(email) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTEMPTS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { attempts: [] };
  email = email ? String(email).toLowerCase() : '';
  const attempts = values.slice(1)
    .filter(row => !email || String(row[1]).toLowerCase() === email)
    .map(row => ({
      id: String(row[0] || ''),
      email: String(row[1] || ''),
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
      answers: tryParseJSON(row[13])
    }));
  // Newest first
  attempts.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  return { attempts: attempts };
}

function getAllAttempts() {
  return getAttempts(null);
}

function saveAttempt(data) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTEMPTS);
  const id = data.id || ('att_' + Date.now());
  const email = String(data.email || '').toLowerCase();
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

function tryParseJSON(v) {
  if (!v) return [];
  try { return JSON.parse(String(v)); } catch (e) { return []; }
}

// ---------- Settings ----------
function getSettings() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const values = sh.getDataRange().getValues();
  const settings = {
    lockAllTimers: false,
    defaultTimer: 45,
    watermarkMode: 'default',
    watermarkCustom: 'MCQ Quiz Module'
  };
  values.slice(1).forEach(row => {
    const key = String(row[0]);
    let val = row[1];
    if (key === 'lockAllTimers') settings.lockAllTimers = val === true || val === 'true' || val === 'TRUE';
    else if (key === 'defaultTimer') settings.defaultTimer = Number(val) || 45;
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
    watermarkMode: data.watermarkMode || 'default',
    watermarkCustom: data.watermarkCustom || 'MCQ Quiz Module'
  };
  const values = sh.getDataRange().getValues();
  Object.keys(map).forEach(key => {
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

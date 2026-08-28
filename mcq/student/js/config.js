/**
 * config.js – Student Panel
 * Use the SAME Web App URL as admin/js/config.js
 * USE_GOOGLE_SHEETS must be true on BOTH panels
 */
const CONFIG = {
  // PASTE the SAME Web App URL as in admin/js/config.js
  API_URL: 'https://script.google.com/macros/s/AKfycbxrCFyd5fANp9xJVx0rWn9KJ4jFSi1VB06UMSsiTxk4BZw1ZSaNxrdAwrjJihdIvFtJ8w/exec',

  // Must be true for multi-device sync
  USE_GOOGLE_SHEETS: true,

  TIMEOUT: 25000
};

window.CONFIG = CONFIG;

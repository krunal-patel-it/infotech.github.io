/**
 * config.js – Admin Panel
 * ============================================================
 * CRITICAL: Without this, each device has its OWN separate data
 * (localStorage only). Mobile will never see PC uploads.
 *
 * SETUP:
 * 1. Deploy Apps Script as Web App (Anyone, Execute as Me)
 * 2. Paste the Web App URL below
 * 3. Set USE_GOOGLE_SHEETS to true
 * 4. Commit & push to GitHub so the LIVE site gets these values
 * ============================================================
 */
const CONFIG = {
  // PASTE your Web App URL here (must end with /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycby41YZmH-QaHHXlcj0AZabC99Bulvxg4z57WJTG-KfP39mTjApApuWwdeeyk5IIDkSk1w/exec',

  // Must be true for multi-device / multi-browser sync
  USE_GOOGLE_SHEETS: true,

  TIMEOUT: 25000
};

window.CONFIG = CONFIG;

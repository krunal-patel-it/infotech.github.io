/**
 * config.js – Student Panel
 * Use the SAME Web App URL as admin/js/config.js
 * USE_GOOGLE_SHEETS must be true on BOTH panels
 */
const CONFIG = {
  // PASTE the SAME Web App URL as in admin/js/config.js
  API_URL: 'https://script.google.com/macros/s/AKfycbx1VEImFgUYFlkEq9qQid6_f6K3xhCG5aACsTN60rUc0FFRVmEGUmGiuIoXL0K0c0OCQw/exec',

  // Must be true for multi-device sync
  USE_GOOGLE_SHEETS: true,

  TIMEOUT: 25000
};

window.CONFIG = CONFIG;

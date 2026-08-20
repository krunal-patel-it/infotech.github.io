/**
 * config.js – Student Panel
 * Use the SAME Web App URL as admin/js/config.js
 * USE_GOOGLE_SHEETS must be true on BOTH panels
 */
const CONFIG = {
  // PASTE the SAME Web App URL as in admin/js/config.js
  API_URL: 'https://script.google.com/macros/s/AKfycbxwJOyo3L39KK1fA6vQhXY5suSY8wwWR7fN9c0wSIkjt6LizUxFqqLXMLQB7FQk45vp8g/exec',

  // Must be true for multi-device sync
  USE_GOOGLE_SHEETS: true,

  TIMEOUT: 25000
};

window.CONFIG = CONFIG;

/**
 * config.js – Admin Panel
 * Paste your Google Apps Script Web App URL below after deploying.
 *
 * How to get the URL:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Paste Code.gs → Run setupSpreadsheet() once
 * 3. Deploy → New deployment → Web app → Execute as: Me → Anyone
 * 4. Copy the Web App URL and paste it here
 */
const CONFIG = {
  // REPLACE THIS with your deployed Web App URL
  API_URL: 'https://script.google.com/macros/s/AKfycbxnR3shuqC-veeQamuy_GYSh_BP0v2PMrckKtyORZ49ISJTU8JAXeKmRiFs2NL7eGMI2Q/exec',

  // Set true only after you have pasted a valid API_URL
  USE_GOOGLE_SHEETS: true,

  // Request timeout (ms)
  TIMEOUT: 20000
};

window.CONFIG = CONFIG;

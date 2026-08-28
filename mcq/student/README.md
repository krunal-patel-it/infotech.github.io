# MCQ Quiz Module – Student Panel (MVP)

## Overview
Student-facing Progressive Web App for taking MCQ quizzes with timer, progress tracking, offline support, and dark mode.

## Features Implemented
- **Authentication**: Register (email + mobile + password) & Login
- **Home Dashboard**: Welcome, quick actions, recent attempts
- **Quiz Selection**: Category, Session, Difficulty, Timer (1min / 45s / 30s / 15s), Question count
- **Quiz Engine**: One question at a time, 4 options, live timer, explanation after answer
- **Results**: Score, attempted, correct, wrong, percentage
- **My Progress**: Full history of past attempts with date/time & scores
- **Profile**: User info + logout
- **Dark Mode**: Toggle available
- **Basic Security**: Right-click disabled, common dev-tool shortcuts blocked
- **Offline Ready**: Data stored in localStorage (sync queue prepared for Google Sheets later)
- **PWA Manifest**: Ready for install

## Tech Stack
- HTML5 + CSS3 (custom properties, dark mode)
- Vanilla JavaScript (no frameworks)
- localStorage for persistence
- Prepared for Google Apps Script + Google Sheets backend

## How to Run
1. Open `index.html` in a modern browser (Chrome / Edge recommended)
2. Or serve with any static server:
   ```bash
   npx serve .
   # or
   python -m http.server 8000
   ```

## Sample Credentials
Register a new account or use the local storage after first registration.

## Sample Questions
8 demo questions (Physics + Chemistry) are included for offline testing.  
In production these will be loaded from Google Sheets.

## Folder Structure
```
student-panel/
├── index.html
├── manifest.json
├── css/
│   └── style.css
├── js/
│   ├── storage.js
│   ├── auth.js
│   ├── quiz.js
│   └── app.js
├── assets/          (icons to be added)
└── README.md
```

## Next Steps
1. Connect to Google Sheets via Apps Script for real question bank & user sync
2. Add Service Worker for full offline caching
3. Improve anti-cheating measures
4. Build Admin Panel
5. Add icons (192px & 512px) for PWA install

## Notes
- Password hashing is very basic (for MVP only). Replace with proper hashing before production.
- Timer and question filters work on the sample data.
- All student progress is saved locally and queued for future online sync.

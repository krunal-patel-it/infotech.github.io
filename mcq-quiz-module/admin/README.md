# MCQ Quiz Module – Admin Panel (MVP)

## Login Credentials (Demo)
- **Email:** `admin@quiz.com`
- **Password:** `admin123`

## Features
- **Dashboard** – Overview stats (users, questions, attempts, average score)
- **Manage Users** – View all students, lock/unlock, delete, detailed activity & subject-wise performance
- **Question Bank** – Full CRUD matching your column format:
  - Q.No, Question Bank, Category, Difficulty, Question, Options A-D, Right Answer, Explanation
  - Previous Board Exam, PYQ/Source, Year, PYQ Status, Verification Note, Relevant Session
  - Per-question timer + Lock question
- **Reports** – Recent quiz attempts across all students
- **Settings** – Lock timer globally for students, set default timer
- **Dark Mode**

## Important Note (MVP)
Student Panel and Admin Panel share the **same localStorage keys**.  
For best results, open both panels in the **same browser** (even different tabs).  
Data created in Student Panel (registrations & attempts) will appear in Admin Panel.

## How to Run
1. Open `index.html` in Chrome/Edge
2. Login with the demo credentials above

## Next Steps
- Connect both panels to Google Sheets via Apps Script for real multi-user / multi-device support
- Add Service Worker / PWA
- More advanced filtering and export

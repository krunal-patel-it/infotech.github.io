# MCQ Quiz Module – Combined Package (MVP)

## How to open
1. Extract this folder
2. Open **`index.html`** in Chrome or Edge
3. Choose **Student Panel** or **Admin Panel**

## Admin Login
- Email: `admin@quiz.com`
- Password: `admin123`

## Structure
```
mcq-quiz-module/
├── index.html          ← Landing page (choose panel)
├── student/            ← Student Panel
│   ├── index.html
│   ├── css/
│   └── js/
└── admin/              ← Admin Panel
    ├── index.html
    ├── css/
    └── js/
```

## Important
Both panels share the **same browser localStorage**.  
Open them in the **same browser** so student registrations and quiz attempts appear in the Admin Panel.

## Features
### Student
- Register / Login
- Must select a Subject before starting quiz
- Timer locked when Admin locks it (individual lock overrides global)
- Dynamic question count based on available questions
- One question at a time + timer + explanation
- My Progress & Profile
- Dark mode

### Admin
- Dashboard stats
- Manage Users (Add / Edit / Lock / Delete / Report / PDF)
- Individual timer lock per student
- Question Bank (CRUD, filters, sort, Bulk CSV upload, PDF export)
- Reports with filter & sort + PDF export
- Settings (global timer lock, PDF watermark)
- Large diagonal watermark on all PDFs

## PDF Export
Requires internet once to load jsPDF from CDN. After that, cached by browser.
All PDFs carry a watermark (configurable in Admin → Settings).

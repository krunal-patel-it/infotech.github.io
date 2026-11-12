# MCQ Quiz Module (Enhanced MVP)

## Features (beyond base MVP)

1. **Full post-quiz review** – students can review every question with correct/wrong + explanation  
2. **Bulk create students** – Admin CSV: Name, Email, Mobile, Password  
3. **Unit-wise analytics** – Admin dashboard shows weakest units first  
4. **Option shuffle + no back** – options shuffled per attempt; only forward navigation  
8. **Export attempts CSV** – alongside PDF in Reports  
9. **SHA-256 passwords** – server-side hashing with legacy hash upgrade on login  
10. **Conflict-safe attempts** – upsert by id + `updatedAt`  
14. **PWA install prompt + offline banner**  
15. **Accessibility** – ARIA labels on options, review list, status regions  

## Deploy

1. Paste `google-apps-script/Code.gs` → Deploy **New version** (Anyone)  
2. Set `API_URL` + `USE_GOOGLE_SHEETS: true` in both config.js files  
3. Share only `/student/` with learners; keep `/admin/` private  

## Student URL
`…/student/index.html`

## Admin URL
`…/admin/index.html`

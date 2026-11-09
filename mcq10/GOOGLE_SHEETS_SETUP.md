# Connect MCQ Quiz Module to Google Sheets

## Step 1 – Create the Spreadsheet
1. Go to [https://sheets.google.com](https://sheets.google.com) and create a **new blank spreadsheet**.
2. Name it e.g. `MCQ Quiz Database`.

## Step 2 – Install Apps Script
1. In the spreadsheet menu: **Extensions → Apps Script**
2. Delete any default code in `Code.gs`
3. Open the file from this package:  
   `google-apps-script/Code.gs`
4. Copy **all** of its contents into the Apps Script editor and **Save**

## Step 3 – Initialize sheets
1. In the Apps Script editor, select function **`setupSpreadsheet`** from the dropdown
2. Click **Run**
3. Authorize the script when Google asks (Review permissions → Allow)
4. You should see an alert: *Setup complete!*
5. Go back to the spreadsheet – you will now have tabs:
   - **Questions** (with sample NEET-style questions)
   - **Users**
   - **Attempts**
   - **Settings**

## Step 4 – Deploy as Web App
1. In Apps Script: **Deploy → New deployment**
2. Click the gear ⚙️ → choose **Web app**
3. Settings:
   - **Description:** MCQ Quiz API
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**
5. **Copy the Web App URL** (looks like `https://script.google.com/macros/s/XXXX/exec`)

## Step 5 – Paste URL into the app
Edit **both** files and paste the same URL:

```
admin/js/config.js
student/js/config.js
```

Change them to:

```javascript
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  USE_GOOGLE_SHEETS: true,
  TIMEOUT: 20000
};
```

Save both files.

## Step 6 – Test
1. Serve the app over HTTP (required for fetch + service worker):
   ```bash
   cd mcq-quiz-module
   python -m http.server 8000
   ```
2. Open `http://localhost:8000`
3. Admin Panel → Question Bank should load questions from the Sheet
4. Student Panel → Register / Login → Start Quiz using live data

## How data flows
| Data | Source of truth | Offline |
|------|-----------------|---------|
| Questions | Google Sheet `Questions` | Cached in localStorage |
| Users | Google Sheet `Users` | Cached locally after register/login |
| Attempts | Google Sheet `Attempts` | Saved locally + synced when online |
| Settings | Google Sheet `Settings` | Cached in localStorage |

## Adding your full question bank
- Open the **Questions** tab in Google Sheets
- Keep the header row exactly as created by `setupSpreadsheet`
- Add / paste your questions (same columns as your original bank)
- Or use **Admin → Question Bank → Bulk Upload** (CSV) which writes to the Sheet when connected

## Re-deploy after script changes
If you edit `Code.gs` later:
**Deploy → Manage deployments → Edit (pencil) → New version → Deploy**

## Security notes (MVP)
- Web app is set to “Anyone” so the front-end can call it without Google login
- Password hashing is simple (same algorithm on client and server) – upgrade before production
- For stronger security later: add an API key parameter or Google OAuth

---

## Why phone shows default questions & Admin sheet is empty

**Cause:** `admin/js/config.js` and `student/js/config.js` still have:

```javascript
API_URL: '',
USE_GOOGLE_SHEETS: false,
```

With that setting, **every browser stores data only in its own localStorage**:

| Device | What you see |
|--------|----------------|
| Your PC | 64 questions + 1 user (local only) |
| Your phone | Default sample Physics/Chemistry questions |
| Google Sheet | Empty / unchanged |
| Live GitHub site on phone | Sample data only |

Mobile registrations and attempts stay on the phone. They never reach the PC Admin panel or the Sheet.

### Fix (required for multi-device)

1. Complete Steps 1–4 in this guide (Sheet + Apps Script + Deploy).
2. Edit **both** files on your PC project:

`admin/js/config.js`  
`student/js/config.js`

```javascript
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/PASTE_YOUR_ID/exec',
  USE_GOOGLE_SHEETS: true,
  TIMEOUT: 25000
};
```

3. **Commit and push to GitHub** so the live site picks up the new config.
4. On PC Admin (after config is live):
   - Open Admin → you should see a green **Connected to Google Sheets** banner (or yellow if still local).
   - Question Bank → **☁ Push to Sheets** to upload your existing local questions once.
5. On phone: hard-refresh the site (or clear site data once), then register/login again. New attempts will appear in the Sheet and on PC Admin after Sync.

### Checklist if still not syncing

- [ ] URL ends with `/exec` (not `/dev`)
- [ ] Deployment: **Execute as Me**, **Who has access: Anyone**
- [ ] After changing `Code.gs`, create a **New version** of the deployment
- [ ] Both student and admin `config.js` on GitHub have the same URL and `USE_GOOGLE_SHEETS: true`
- [ ] Open the Web App URL in a browser — you should see JSON like `{"error":"Unknown action: "}` not a Google login page
- [ ] Live site is served over **https** (GitHub Pages is fine)


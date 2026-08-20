# Deploy on GitHub Pages (fix 404)

## Correct folder layout on GitHub

The **root of the branch GitHub Pages uses** must look like this:

```
index.html          ← landing page (required at root)
.nojekyll           ← required (stops Jekyll from breaking paths)
404.html
admin/
  index.html
  js/
  css/
  ...
student/
  index.html
  js/
  css/
  ...
google-apps-script/  (optional on Pages)
```

**Wrong (causes 404):**

```
mcq-quiz-module/     ← extra nested folder
  index.html
  admin/
  student/
```

If you uploaded the zip so GitHub has an extra outer folder, either:
- Move everything up one level, **or**
- Open: `https://USER.github.io/REPO/mcq-quiz-module/`

## Enable Pages

1. Repo → **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` (or `master`) → folder **`/ (root)`**
4. Save and wait 1–2 minutes

## Correct URLs

| Page | URL |
|------|-----|
| Home | `https://USER.github.io/REPO/` |
| Student | `https://USER.github.io/REPO/student/` or `.../student/index.html` |
| Admin | `https://USER.github.io/REPO/admin/` or `.../admin/index.html` |

Replace `USER` and `REPO` with your GitHub username and repository name.

## If you still see 404

1. Confirm `index.html` is at the **root** of the published branch (not inside a subfolder).
2. Confirm `.nojekyll` exists at the root (this repo includes it).
3. Open the exact file URL: `.../admin/index.html` — if that works but `/admin` does not, add the trailing path as above.
4. Hard-refresh / clear cache (old service worker can cache a bad path).
5. Repo must be **public** for free GitHub Pages (or use a GitHub Pro private Pages setup).

## Config after deploy

`admin/js/config.js` and `student/js/config.js` must still contain your live Apps Script URL and `USE_GOOGLE_SHEETS: true` **in the GitHub files**, then push again.

## Clear old Service Worker (if page looks stuck)

On the phone/PC that had 404:

1. Open the site → DevTools / browser settings → Application → Service Workers → Unregister  
2. Clear site data  
3. Reload the home URL  


# VelocityMAX

A private engineering metrics dashboard that pulls data from **Linear** (issues, cycle time, velocity) and **Everhour** (budget tracking) and displays them in a single view.

Deployed as a static site on GitHub Pages. All API keys stay in the browser — nothing is sent to any backend.

---

## Features

- **Linear integration** — issues, cycle time, lead time, weekly velocity, burn-up chart, time-in-status breakdown
- **Everhour integration** — budget overview per project (consumed vs. total, % used with colour-coded progress bars)
- **Presets** — one-click switching between team/project combinations (e.g. "Logtex", "TFS TMA", "All")
- **Filters** — project, assignee, multi-select status, date range; all persist across page refreshes
- **Password protection** — SHA-256 hashed password baked into the bundle at build time; plaintext never stored anywhere
- **No backend** — pure static SPA; API keys stored in `localStorage` only

---

## Getting started

### 1. Fork / clone

```bash
git clone https://github.com/Stem0794/VelocityMaxApp.git
cd VelocityMaxApp
npm install
```

### 2. Enable GitHub Pages

In the repo settings → **Pages** → Source: **GitHub Actions**.

### 3. Set GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `VITE_APP_PASSWORD_HASH` | SHA-256 hash of your chosen password (see below) |
| `LINEAR_API_KEY` | Your Linear personal API key (used only by the data-fetch GitHub Action) |
| `LINEAR_TEAM_ID` | Your Linear team ID |
| `LINEAR_PROJECT_IDS` | *(optional)* Comma-separated Linear project IDs to pre-filter |

### 4. Generate a password hash

```bash
node scripts/hash-password.js
# prints a random strong password + its SHA-256 hash

node scripts/hash-password.js "mypassword"
# hashes a specific password
```

Copy the hash into the `VITE_APP_PASSWORD_HASH` secret. Store the plaintext password in your password manager — it is never saved anywhere in the codebase.

### 5. Deploy

Push to `main`. The GitHub Action will build and deploy to GitHub Pages automatically.

---

## First-time setup in the app

1. Open the deployed URL and log in with your password.
2. Click **⚙ Settings**.
3. Paste your **Linear API key** (Linear → Settings → API → Personal API keys).
4. *(Optional)* Paste your **Everhour API key** (Everhour → Settings → API).
5. Click **+ Add Preset**, give it a name, select a team and projects.
   - Select Everhour projects in the same preset to show a budget overview for it.
6. Save. The dashboard loads immediately.

API keys are stored in your browser's `localStorage` only — they never leave your machine.

---

## Sharing with teammates

Everyone uses the **same password** (the one whose hash is in `VITE_APP_PASSWORD_HASH`). Each person enters their own API keys in Settings after logging in — those keys stay in their own browser.

To change the password: generate a new hash, update the GitHub Secret, and re-deploy.

---

## Local development

```bash
cp .env.local.example .env.local   # or create manually
npm run dev
```

`.env.local` (not committed):
```
LINEAR_API_KEY=lin_api_...
LINEAR_TEAM_ID=...
LINEAR_PROJECT_IDS=...   # optional
VITE_APP_PASSWORD_HASH=  # leave empty to bypass auth in dev
```

Auth is bypassed in dev when `VITE_APP_PASSWORD_HASH` is not set.

To pre-fetch a `data.json` snapshot for the demo data fallback:
```bash
node scripts/fetch-data.js
```

---

## Architecture

```
src/
  App.jsx           — main dashboard, auth, preset switching, filter state
  SettingsModal.jsx — API key input, preset create/edit/delete
  linearApi.js      — Linear GraphQL client (issues, history, workflow states)
  everhourApi.js    — Everhour REST client (projects, budget)
  index.css         — all styles (dark glassmorphism theme)

scripts/
  fetch-data.js     — Node script run by GitHub Action to cache data.json
  hash-password.js  — CLI helper to generate a password hash

.github/workflows/
  deploy.yml        — build + deploy to GitHub Pages on push to main
```

**Data flow:**
1. On login, the active preset's Linear data is fetched directly from the browser via the Linear GraphQL API.
2. Issue status histories are fetched in background batches of 10 (with a 400 ms delay between batches to respect rate limits).
3. Everhour budget data is fetched in parallel, independently of Linear.
4. If no API key or preset is configured, the app falls back to the cached `public/data.json` snapshot produced by the GitHub Action.

---

## Security notes

- The password hash is baked into the JS bundle — it is public. Use a strong, unique password.
- `data.json` is publicly accessible on GitHub Pages (static file). It contains only aggregated metrics, no credentials.
- The Linear and Everhour API keys are **never** in the bundle or in any server — they live only in the user's `localStorage`.
- Content Security Policy is enforced via `<meta>` tags (GitHub Pages does not support HTTP headers). `connect-src` is restricted to `api.linear.app` and `api.everhour.com`.

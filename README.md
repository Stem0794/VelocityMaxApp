# VelocityMAX

VelocityMAX is a static engineering delivery dashboard for **Linear** and **Everhour**. It combines throughput, cycle/lead time, sprint flow, forecasts, issue-level data and budget consumption in one responsive view.

The application is deployed to GitHub Pages. Linear and Everhour API keys are stored in the user's browser and are sent only to the corresponding provider APIs.

## Current feature set

- Google Identity Services sign-in with an optional email allow-list.
- Demo mode backed by `public/data.json`.
- Linear issues, workflow states and issue-history loading.
- Everhour project budget consumption.
- Saved presets for team/project combinations.
- Project, assignee, status and date filters with saved defaults.
- Weekly velocity, cycle comparison, cycle-time scatter, burn-up, sprint burndown, lead-time histogram, flow efficiency, time in status, cumulative flow and scope prediction.
- Team health score and PNG snapshot export.
- Searchable/sortable Issues table with hardened CSV export.
- Responsive dashboard with keyboard-accessible controls and reduced-motion support.

## Authentication

VelocityMAX uses **Google Identity Services (GIS)**. The OAuth client ID is configured in the frontend and GitHub Pages build.

Set the optional GitHub Actions secret:

| Secret | Purpose |
|---|---|
| `VITE_ALLOWED_EMAILS` | Comma-separated list of Google account email addresses allowed to enter the connected dashboard. If omitted, any valid Google account can sign in. |

The app also includes **Explore with demo data**. This intentionally allows anyone who can open the site to view the demo snapshot. Google sign-in is therefore an access gate for connected usage, not a substitute for server-side authorization.

### Google OAuth setup

Create a Google OAuth 2.0 Web application client and add the deployed GitHub Pages origin to **Authorized JavaScript origins**. If the client ID changes, update `GOOGLE_CLIENT_ID` in `src/App.jsx`.

## GitHub Pages deployment

1. Fork or clone the repository.
2. In repository settings, enable **Pages → GitHub Actions**.
3. Add the relevant Actions secrets:

| Secret | Required | Purpose |
|---|---:|---|
| `VITE_ALLOWED_EMAILS` | No | Google sign-in allow-list. |
| `LINEAR_API_KEY` | No | Used by the scheduled workflow to refresh the public demo snapshot. |
| `LINEAR_TEAM_ID` | No | Linear team used for the demo snapshot. |
| `LINEAR_PROJECT_IDS` | No | Optional comma-separated project IDs for the demo snapshot. |

4. Push to `main`. `.github/workflows/deploy.yml` builds and publishes the site.

A separate `.github/workflows/ci.yml` runs lint, unit tests and the production build for pull requests.

## First-time connected setup

1. Open the deployed site and sign in with Google.
2. Open **Settings**.
3. Enter a Linear personal API key and choose **Test connection**.
4. Optionally enter an Everhour API key and test it.
5. Add a preset, select a Linear team and optional project subset, then select optional Everhour projects.
6. Save settings and select the preset from the dashboard header.

Credentials are persisted in `localStorage` on that browser only.

## Local development

```bash
npm ci
npm run dev
```

Quality checks:

```bash
npm run lint
npm test
npm run build
# or all three
npm run check
```

The unit tests use Node's built-in test runner, so no additional test framework dependency is required.

## Architecture

```text
src/
  App.jsx                         application composition + Google sign-in
  SettingsModal.jsx               credentials, connection checks and presets
  IssuesTable.jsx                 searchable/sortable issue table + CSV export
  linearApi.js                    Linear GraphQL client and history processing
  everhourApi.js                  Everhour REST client and budgets
  computeCharts.js                pure chart/metric calculations
  dashboardState.js               pure preset/chart/status state helpers
  hooks/
    useDashboardData.js           refresh, Linear history and Everhour state
    useDashboardFilters.js        persistent filters, local-date ranges
    useDashboardMetrics.js        derived metrics and health score
  components/
    DashboardHeader.jsx
    DashboardFilters.jsx
    KpiGrid.jsx
    HealthScore.jsx
    BudgetOverview.jsx
    ChartCard.jsx
    DashboardCharts.jsx           chart ordering/composition
    charts/                       one component per visualization
  utils/
    csv.js                        hardened CSV output
    date.js                       local date-range helpers
  index.css                       legacy/base styles
  redesign.css                    redesign stylesheet entry point
  styles/                         modular redesign styles

test/
  computeCharts.test.js
  csv.test.js
  dashboardState.test.js
```

### Data flow

1. `useDashboardData` loads the active preset and guards against stale responses when presets change.
2. Core Linear issues render first; issue histories continue in the background with partial-failure tolerance.
3. Everhour budgets load independently and errors do not block Linear metrics.
4. `useDashboardFilters` applies local browser filters and validates date ranges.
5. `useDashboardMetrics` derives chart data, KPI values and the health score from the filtered issues.
6. The chart components are pure presentation layers over those derived datasets.

## Security and privacy notes

- Linear and Everhour API keys are stored in browser `localStorage`; anyone with access to the browser profile can read them.
- A static frontend cannot provide the same credential protection as a server-side proxy. Use least-privilege API keys where the providers support them.
- `public/data.json` is public on GitHub Pages. Only place demo/snapshot data there that is safe to expose publicly.
- The CSP in `index.html` restricts scripts, frames and API connections to the app's required origins.
- CSV exports neutralize cells beginning with common spreadsheet formula prefixes (`=`, `+`, `-`, `@`).

## Scheduled demo refresh

`.github/workflows/deploy.yml` runs hourly and on `main` pushes. When Linear snapshot secrets are configured, `scripts/fetch-data.js` refreshes `public/data.json` before the production build. Snapshot refresh is non-blocking so a temporary Linear failure does not prevent deployment of the current app.

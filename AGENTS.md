# Repository Guidelines

## Project Structure

- `src/` contains the React dashboard. `App.jsx` owns page state and filters; `linearApi.js`, `everhourApi.js`, and `computeCharts.js` contain integrations and pure metric calculations. Reusable UI lives in `IssuesTable.jsx` and `SettingsModal.jsx`.
- `src/assets/` contains bundled images and icons; `public/` contains static assets and the cached `data.json` fallback snapshot.
- `scripts/` contains the Node data-refresh and password utility scripts. `.github/workflows/deploy.yml` fetches Linear data and deploys the Vite build to GitHub Pages.

## Build, Test, and Development Commands

```bash
npm install              # Install locked dependencies
npm run dev              # Start the Vite development server
npm run lint             # Run ESLint across source and scripts
npm run build            # Produce the production bundle in dist/
npm run preview          # Serve the production bundle locally
node scripts/fetch-data.js  # Refresh public/data.json from Linear
```

The data refresh requires `LINEAR_API_KEY`, `LINEAR_TEAM_ID`, and optionally `LINEAR_PROJECT_IDS`. Keep credentials in an uncommitted `.env.local` or GitHub Actions secrets.

## Coding Style & Naming

Use two-space indentation, semicolons, ES modules, and functional React components. Name components in `PascalCase`, functions and variables in `camelCase`, and chart/data fields descriptively. Keep metric calculations pure and colocated in `computeCharts.js` or the relevant API module. Run `npm run lint` before submitting changes.

## Testing Guidelines

There is currently no formal test framework or test directory. For every change, run `npm run lint`, `npm run build`, and manually check the demo flow with `npm run dev`. Calculation changes should also verify KPI totals against chart endpoints using representative cached data. UI changes should be checked at desktop and mobile widths.

## Commit & Pull Requests

Use short, imperative commit subjects matching the existing history, such as `Fix chart aggregation` or `Replace password auth`. Pull requests should explain the user-visible impact, list validation commands, identify configuration or snapshot-data changes, and include screenshots for visual changes. Never include API keys, `.env.local`, or sensitive Linear/Everhour data.

## Security & Configuration

API keys are browser-side configuration and must remain in `localStorage` or secrets; do not hard-code them. `public/data.json` is publicly served, so it must contain only safe demo or aggregated data. Update deployment configuration and documentation together when changing authentication or GitHub Pages settings.

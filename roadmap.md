# VelocityMAX redesign roadmap

The redesign and reliability roadmap is complete on `ui-redesign-foundations`.

## Status

- [x] Done

## Phase 1 — UI foundations

### 1. Visual foundations and application shell
- [x] Dedicated redesign stylesheet and design tokens.
- [x] Denser surfaces, page width, chart spacing, keyboard focus, disabled states, reduced motion and `100dvh` handling.

### 2. Dashboard header and preset navigation
- [x] Product app bar with VelocityMAX brand, team context and last synchronization time.
- [x] Lucide Refresh, Settings, Sign out and Add Preset actions.
- [x] Compact scrollable preset tabs and responsive header.
- [x] Auto-refresh control retained in the global header.

### 3. Filter bar redesign
- [x] Hierarchical project, assignee, status and date controls.
- [x] Active quick-range states for 30d / 90d / Quarter / All.
- [x] Reset and Save Defaults separated from fields.
- [x] Collapsible mobile filter treatment with active-filter count.

### 4. KPI cards with context
- [x] Denser four-card KPI grid.
- [x] Completion percentage, delivered points and median cycle-time context.
- [x] Responsive 4/2-column layouts with non-color hierarchy.

### 5. Chart-card density and explanations
- [x] One-line summaries with detailed help popovers.
- [x] Standard title/action/empty-state treatment.
- [x] Smaller chart margins and axes.
- [x] Mouse drag plus keyboard move-up/down reordering.

### 6. Icon and interaction consistency
- [x] Lucide icons used for application and chart controls.
- [x] Consistent hit areas, tooltips and accessible names.

### 7. Accessibility pass
- [x] Multi-select ARIA state/menu semantics and Escape handling.
- [x] Settings dialog semantics, focus trap, focus restore and Escape-to-close.
- [x] Sortable table headers use buttons and `aria-sort`.
- [x] Icon-only controls have accessible names.
- [x] Contrast and reduced-motion rules reviewed in the redesign stylesheet.

### 8. Mobile dashboard pass
- [x] Single-column charts, two-column KPIs and collapsible filters.
- [x] Page-level horizontal overflow prevented while Issues remains horizontally scrollable.
- [x] Preset tabs scroll horizontally and touch targets remain usable.
- [x] Settings modal becomes a mobile bottom sheet.

### 9. Issues table redesign
- [x] Search, result count and export hierarchy improved.
- [x] Accessible sort direction and sticky identifier column.
- [x] Filtered-empty and pagination states improved.
- [x] CSV export hardened against formula injection.

### 10. Settings experience
- [x] Connections and presets separated.
- [x] Explicit Linear/Everhour connection tests with status feedback.
- [x] API-key typing no longer causes network requests.
- [x] Preset add/edit hierarchy and delete confirmation added.
- [x] Mobile and keyboard behavior improved.

### 11. Loading, empty and error states
- [x] Routine refresh preserves the current dashboard and uses header refresh state.
- [x] Linear, Everhour and history errors are independent.
- [x] Empty states added for issue scope, cycles, history and configured budgets without returned data.

## Phase 2 — Reliability fixes

### 12. Data refresh correctness
- [x] Auto-refresh uses current preset and credential values.
- [x] Editing the active preset triggers a reload.
- [x] Source signatures and sequence guards prevent prior preset responses from becoming visible.

### 13. History loading resilience
- [x] One failed history request no longer fails a batch.
- [x] Partial failure counts and non-blocking warnings added.
- [x] Progress increments in `finally`, including failures.

### 14. Metric correctness
- [x] Lead-time boundaries corrected at 3, 7, 14 and 30 days.
- [x] Health score `≤7d` derives from the corrected first two buckets.
- [x] Flow efficiency is validated and clamped to 0–100%.
- [x] Boundary regression tests added.

### 15. Date and filter correctness
- [x] Quick ranges use local calendar formatting instead of UTC `toISOString()` conversion.
- [x] Workflow status selections reconcile when team states change.
- [x] Invalid From/To ranges show inline validation.

### 16. Export hardening
- [x] CSV formula prefixes are neutralized.
- [x] UTF-8 BOM/CRLF output improves Excel/Sheets compatibility.
- [x] PNG export preserved with Web Share support and visible export errors.

### 17. Everhour error handling
- [x] Budget errors are surfaced independently.
- [x] No configured budget and configured-but-empty budget are distinguished.

## Phase 3 — Maintainability

### 18. Break up `App.jsx`
- [x] `DashboardHeader`, `DashboardFilters`, `KpiGrid`, `HealthScore`, `BudgetOverview` and `ChartCard` extracted.
- [x] Individual chart visualizations moved to `src/components/charts/`.
- [x] `DashboardCharts` is limited to chart composition and ordering.

### 19. Extract stateful hooks
- [x] `useDashboardData()` handles source loading, refresh, history and Everhour state.
- [x] `useDashboardFilters()` handles persistent filters, quick ranges and validation.
- [x] `useDashboardMetrics()` centralizes derived metric/chart data.
- [x] Stale effect-dependency suppressions removed from the rewritten dashboard code.

### 20. Automated tests
- [x] Node's built-in test runner added through `npm test`.
- [x] Pure metric calculations have regression coverage.
- [x] Lead-time, burndown, cumulative flow, velocity and prediction regressions covered.
- [x] CSV escaping/formula neutralization covered.
- [x] Extracted filter/preset/status/chart-order state behavior covered.
- [x] PR CI runs lint, tests and production build.

### 21. Repository cleanup
- [x] Legacy `App.css`, React/Vite starter assets and stale monolithic UI code are removed in the redesign branch.
- [x] Existing production dependencies remain in active use.

### 22. Documentation accuracy
- [x] README documents Google Identity Services instead of the removed password flow.
- [x] `VITE_ALLOWED_EMAILS`, deployment secrets and setup flow documented.
- [x] Architecture matches the component/hook split.
- [x] Static-hosting and public demo-data security limits documented.

## Verification

- [x] Pure regression suite passes locally (`12/12`).
- [x] CI workflow added for lint, unit tests and production build on pull requests.
- [x] Final PR review and GitHub CI passed before merge.

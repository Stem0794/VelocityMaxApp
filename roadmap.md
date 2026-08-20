# VelocityMAX redesign roadmap

This roadmap turns the current dashboard into a denser, clearer engineering product while preserving the existing metrics and integrations.

## Status

- [x] Done
- [ ] Planned

## Phase 1 — UI foundations

### 1. Visual foundations and application shell

- [x] Introduce a dedicated redesign stylesheet loaded after the legacy styles.
- [x] Define clearer surface, border, text, accent, spacing, radius and shadow tokens.
- [x] Reduce the heavy glassmorphism effect in favor of more stable dashboard surfaces.
- [x] Improve card density, page width and chart-grid spacing.
- [x] Add consistent keyboard focus states for buttons, inputs, selects and interactive controls.
- [x] Add disabled states, `prefers-reduced-motion` handling and `100dvh` login sizing.
- [x] Tighten the mobile spacing baseline without redesigning individual components yet.

Definition of done: the existing dashboard reads as one coherent product before component-level redesign begins, with no functional behavior change.

### 2. Dashboard header and preset navigation

- [ ] Turn the connected header into a real application bar with the VelocityMAX brand.
- [ ] Show the current team/preset and last synchronization time prominently.
- [ ] Move Refresh, Settings and Sign out into compact, labeled or tooltipped actions.
- [ ] Replace text symbols such as `⚙`, `⏻` and `↻` with Lucide icons.
- [ ] Keep presets in a compact secondary tab row with a clear active state.
- [ ] Make the header responsive and usable with many presets.

Definition of done: users can identify where they are, how fresh the data is and the primary global actions without scanning the filter area.

### 3. Filter bar redesign

- [ ] Separate filtering controls from dashboard actions.
- [ ] Group Project, Assignee, Status and Date Range by hierarchy rather than treating every control equally.
- [ ] Give 30d / 90d / Quarter / All an explicit active state.
- [ ] Move Reset, Save Filters and Refresh out of the field flow.
- [ ] Add a compact/collapsible filter treatment for mobile.
- [ ] Show an active-filter count or summary when filters are collapsed.

Definition of done: the filter bar uses less vertical space and the current filtering state is visible at a glance.

### 4. KPI cards with context

- [ ] Redesign the four KPI cards with stronger hierarchy and less empty space.
- [ ] Add useful context where data allows it, for example completion percentage and cycle-time movement.
- [ ] Distinguish primary values from supporting values without relying only on color.
- [ ] Keep cards readable at 2-column and 1-column mobile widths.

Definition of done: KPIs answer both “what is the value?” and “is it changing / healthy?” where the available data supports that conclusion.

### 5. Chart-card density and explanations

- [ ] Reduce multi-sentence descriptions that currently consume large amounts of vertical space.
- [ ] Keep a one-line summary visible and move detailed examples/help into an information affordance.
- [ ] Standardize chart title rows, legends, controls and empty states.
- [ ] Improve chart spacing and axis readability at smaller widths.
- [ ] Keep drag-to-reorder but replace the text drag symbol with a proper icon and accessible label.

Definition of done: materially more chart data is visible above the fold without losing explanatory help.

### 6. Icon and interaction consistency

- [ ] Use the existing `lucide-react` dependency for Settings, Log out, Refresh, Download, Plus, Grip and related actions.
- [ ] Standardize icon button sizes, hit areas, tooltips and accessible names.
- [ ] Remove remaining decorative Unicode controls where a real icon is appropriate.

### 7. Accessibility pass

- [ ] Add ARIA state to the multi-select trigger and menu.
- [ ] Give the settings modal dialog semantics, focus management and Escape-to-close behavior.
- [ ] Make sortable table headers keyboard-operable with `aria-sort`.
- [ ] Review color contrast for secondary text, chips, health grades and chart annotations.
- [ ] Verify all icon-only actions have accessible names.
- [ ] Preserve reduced-motion support introduced in task 1.

### 8. Mobile dashboard pass

- [ ] Test the dashboard at narrow phone widths and tablet widths.
- [ ] Prevent charts and tables from forcing page-level horizontal overflow.
- [ ] Make high-priority controls reachable without excessive scrolling.
- [ ] Keep the issues table horizontally scrollable while the surrounding page remains fixed-width.
- [ ] Review touch target sizes for preset tabs, chips and icon buttons.

### 9. Issues table redesign

- [ ] Improve search, result count and export action hierarchy.
- [ ] Make sort direction clearer and accessible.
- [ ] Consider a sticky first identifier/title column on wide tables.
- [ ] Improve empty, filtered-empty and pagination states.
- [ ] Preserve CSV export while fixing spreadsheet formula injection in Phase 2.

### 10. Settings experience

- [ ] Clarify the separation between credentials and presets.
- [ ] Add connection status / validation feedback for Linear and Everhour.
- [ ] Avoid network requests on every API-key keystroke; debounce or use an explicit connection action.
- [ ] Improve preset edit/add hierarchy and destructive-action confirmation.
- [ ] Improve mobile modal behavior and keyboard navigation.

### 11. Loading, empty and error states

- [ ] Replace full-screen loading for routine refreshes with an in-dashboard refresh state where possible.
- [ ] Differentiate Linear errors, Everhour errors and history-loading errors.
- [ ] Add useful empty states for no issues, no cycles, no history and no budget.
- [ ] Preserve currently visible data during refresh when safe instead of clearing the dashboard immediately.

## Phase 2 — Reliability fixes found during UI audit

### 12. Data refresh correctness

- [ ] Fix auto-refresh using stale preset/API-key values.
- [ ] Reload data when the active preset is edited, not only when the API key changes or the preset disappears.
- [ ] Ensure switching presets cannot leave requests from a previous preset visible.

### 13. History loading resilience

- [ ] Prevent one failed Linear issue-history request from failing the entire batch.
- [ ] Track partial failures and show a non-blocking warning when time-in-status data is incomplete.
- [ ] Keep progress reporting accurate when requests fail.

### 14. Metric correctness

- [ ] Fix lead-time histogram boundaries so the labels match the actual inclusive/exclusive ranges.
- [ ] Verify the health-score “completed in ≤7d” calculation against the corrected buckets.
- [ ] Clamp flow-efficiency calculations to a valid 0–100% range and account for invalid source values.
- [ ] Add boundary tests for 3, 7, 14 and 30 days.

### 15. Date and filter correctness

- [ ] Stop using UTC `toISOString()` formatting for local quick-range dates such as Quarter.
- [ ] Reconcile selected chart statuses when a new preset/team exposes a different workflow-state list.
- [ ] Validate From/To ranges and provide feedback when From is after To.

### 16. Export hardening

- [ ] Neutralize CSV cells beginning with spreadsheet formula prefixes (`=`, `+`, `-`, `@`).
- [ ] Verify exported dates and number fields remain useful in Excel/Sheets after hardening.
- [ ] Keep the existing PNG snapshot behavior and improve its mobile error handling if needed.

### 17. Everhour error handling

- [ ] Stop silently swallowing budget-loading failures.
- [ ] Add a dedicated budget error state that does not block Linear data.
- [ ] Distinguish “no budget configured” from “Everhour request failed”.

## Phase 3 — Maintainability

### 18. Break up `App.jsx`

- [ ] Extract `DashboardHeader`.
- [ ] Extract `DashboardFilters`.
- [ ] Extract `KpiGrid`.
- [ ] Extract `HealthScore`.
- [ ] Introduce a reusable `ChartCard` shell.
- [ ] Move individual charts into `src/charts/` or `src/components/charts/`.

Goal: keep `App.jsx` focused on composition rather than authentication, data fetching, filtering, export, drag-and-drop and every chart implementation at once.

### 19. Extract stateful hooks

- [ ] Add `useDashboardData()` for preset loading, refresh state, Linear history and Everhour budget state.
- [ ] Add `useDashboardFilters()` for persistent filters, quick ranges and reset/save behavior.
- [ ] Remove effect dependency suppressions where practical by making callbacks stable and dependencies explicit.

### 20. Automated tests

- [ ] Add a test runner suitable for the Vite project.
- [ ] Unit-test all pure functions in `computeCharts.js`.
- [ ] Add regression tests for lead-time boundaries, burndown windows, cumulative flow and predictions.
- [ ] Add tests for CSV escaping/formula neutralization.
- [ ] Add targeted component tests for filters and preset switching after the component split.

### 21. Repository cleanup

- [ ] Verify and remove unused `App.css` and legacy Vite/React assets if they are no longer referenced.
- [ ] Remove dead helper functions and stale comments after the component split.
- [ ] Review whether all dependencies are still required after the redesign.

### 22. Documentation accuracy

- [ ] Update the README authentication documentation from the old SHA-256 password flow to Google Identity Services.
- [ ] Document `VITE_ALLOWED_EMAILS` and the current Google OAuth behavior.
- [ ] Update deployment secrets and first-time setup instructions.
- [ ] Align the architecture section with the refactored component/hook structure.

## Suggested delivery order

1. UI foundations
2. Header
3. Filters
4. KPI cards
5. Chart cards
6. Icons + accessibility
7. Mobile pass
8. Issues table + settings
9. Error/loading states
10. Reliability and metric fixes
11. Component/hook refactor
12. Tests, cleanup and documentation

The UI work is intentionally delivered before the larger refactor so each visual change can be reviewed independently while the existing feature set remains stable.
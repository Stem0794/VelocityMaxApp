import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CHART_ORDER, normalizeChartOrder, reconcileStatuses, resolveActivePreset } from '../src/dashboardState.js';
import { getQuickRangeDates, isValidDateRange, toLocalDateInput } from '../src/utils/date.js';

test('resolves the requested preset and falls back safely', () => {
  const presets = [{ id: 'a' }, { id: 'b' }];
  assert.equal(resolveActivePreset(presets, 'b').id, 'b');
  assert.equal(resolveActivePreset(presets, 'missing').id, 'a');
  assert.equal(resolveActivePreset([], 'missing'), null);
});

test('chart order removes stale ids and appends new defaults', () => {
  const normalized = normalizeChartOrder(['issues', 'stale', 'issues', 'velocity']);
  assert.deepEqual(normalized.slice(0, 2), ['issues', 'velocity']);
  assert.equal(normalized.length, DEFAULT_CHART_ORDER.length);
});

test('status reconciliation removes states from another team', () => {
  assert.deepEqual(reconcileStatuses(['Review', 'Gone'], ['Todo', 'Review']), ['Review']);
  assert.deepEqual(reconcileStatuses(['Gone'], ['Todo', 'Review']), ['Todo', 'Review']);
});

test('quick ranges format local dates without UTC shifting', () => {
  const now = new Date(2026, 7, 20, 23, 30, 0);
  assert.equal(toLocalDateInput(now), '2026-08-20');
  assert.deepEqual(getQuickRangeDates('quarter', now), { from: '2026-07-01', to: '2026-08-20' });
  assert.equal(isValidDateRange('2026-08-21', '2026-08-20'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CHART_ORDER, filterDeliveredWindow, filterInventoryScope,
  normalizeChartOrder, reconcileStatuses, resolveActivePreset,
} from '../src/dashboardState.js';
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

test('inventory scope filters current ownership without hiding old issues by creation date', () => {
  const issues = [
    { id: 'OLD-1', project: 'App', assignee: 'Ada', currentStatus: 'In dev', createdAt: '2025-01-01T00:00:00Z' },
    { id: 'NEW-1', project: 'API', assignee: 'Ben', currentStatus: 'Todo', createdAt: '2026-08-19T00:00:00Z' },
  ];
  const result = filterInventoryScope(issues, { selectedProject: 'App', selectedAssignee: 'All', selectedCurrentStatuses: [] });
  assert.deepEqual(result.map(issue => issue.id), ['OLD-1']);
});

test('delivery window uses deliveredAt rather than createdAt', () => {
  const issues = [
    { id: 'OLD-DELIVERED', createdAt: '2025-01-01T00:00:00Z', deliveredAt: '2026-08-18T10:00:00Z' },
    { id: 'NEW-NOT-DELIVERED', createdAt: '2026-08-19T00:00:00Z', deliveredAt: '' },
    { id: 'OLD-DELIVERY', createdAt: '2026-08-01T00:00:00Z', deliveredAt: '2026-08-01T10:00:00Z' },
  ];
  const result = filterDeliveredWindow(issues, '2026-08-15', '2026-08-20');
  assert.deepEqual(result.map(issue => issue.id), ['OLD-DELIVERED']);
});

test('delivery window falls back to completedAt for workspaces without custom milestones', () => {
  const issues = [
    { id: 'A', completedAt: '2026-08-20T10:00:00Z' },
    { id: 'B', completedAt: '2026-07-20T10:00:00Z' },
  ];
  const result = filterDeliveredWindow(issues, '2026-08-01', '2026-08-20');
  assert.deepEqual(result.map(issue => issue.id), ['A']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSprintBurndown } from '../src/computeCharts.js';
import { prepareSprintBurndownIssues, sprintBurndownUnit } from '../src/utils/sprintBurndown.js';

function cycleIssue(overrides = {}) {
  return {
    id: 'A-1',
    cycleNumber: 12,
    cycleStartsAt: '2026-08-17T00:00:00Z',
    cycleEndsAt: '2026-08-21T23:59:59Z',
    createdAt: '2026-08-17T08:00:00Z',
    completedAt: '',
    linearCompletedAt: '',
    points: 0,
    ...overrides,
  };
}

test('burndown falls back to issue count when a cycle has no estimates', () => {
  const source = [
    cycleIssue({ linearCompletedAt: '2026-08-18T12:00:00Z' }),
    cycleIssue({ id: 'A-2' }),
  ];
  assert.equal(sprintBurndownUnit(source, 12), 'issues');
  const prepared = prepareSprintBurndownIssues(source, 12);
  assert.equal(prepared.unit, 'issues');
  const data = computeSprintBurndown(prepared.issues, 12);
  assert.equal(data[0].remaining, 2);
  assert.ok(data.some(point => point.remaining === 1));
});

test('burndown keeps story points when the cycle is estimated', () => {
  const source = [
    cycleIssue({ points: 5, linearCompletedAt: '2026-08-18T12:00:00Z' }),
    cycleIssue({ id: 'A-2', points: 3 }),
  ];
  assert.equal(sprintBurndownUnit(source, 12), 'points');
  const prepared = prepareSprintBurndownIssues(source, 12);
  assert.equal(prepared.issues, source);
  const data = computeSprintBurndown(prepared.issues, 12);
  assert.equal(data[0].remaining, 8);
  assert.ok(data.some(point => point.remaining === 3));
});

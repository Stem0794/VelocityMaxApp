import test from 'node:test';
import assert from 'node:assert/strict';
import { processIssues, resolveDeliveredAt } from '../src/linearApi.js';

function rawIssue(overrides = {}) {
  return {
    id: 'issue-1',
    identifier: 'ENG-1',
    title: 'Ship feature',
    estimate: 5,
    priorityLabel: 'High',
    createdAt: '2026-01-01T00:00:00Z',
    startedAt: '2026-01-02T00:00:00Z',
    completedAt: '2026-01-10T00:00:00Z',
    canceledAt: null,
    state: { id: 'prod', name: 'Prod', type: 'completed' },
    assignee: { name: 'Ada' },
    project: { id: 'project-a', name: 'App' },
    labels: { nodes: [] },
    cycle: null,
    ...overrides,
  };
}

const devRule = { 'project-a': { stateId: 'dev', stateName: 'Dev' } };

test('projects without a delivery rule use Linear completion', () => {
  const result = resolveDeliveredAt(rawIssue(), {});
  assert.equal(result.deliveredAt, '2026-01-10T00:00:00Z');
  assert.equal(result.deliveryConfigured, false);
});

test('configured projects use the first transition into the delivery state', () => {
  const issue = rawIssue({
    _history: [
      { createdAt: '2026-01-03T00:00:00Z', fromState: { id: 'todo', name: 'Todo' }, toState: { id: 'dev', name: 'Dev' } },
      { createdAt: '2026-01-08T00:00:00Z', fromState: { id: 'dev', name: 'Dev' }, toState: { id: 'prod', name: 'Prod' } },
    ],
  });
  const result = resolveDeliveredAt(issue, devRule);
  assert.equal(result.deliveredAt, '2026-01-03T00:00:00Z');
  assert.equal(result.deliverySource, 'workflow-history');
});

test('a configured milestone is not delivered when history shows it was never reached', () => {
  const issue = rawIssue({
    _history: [
      { createdAt: '2026-01-08T00:00:00Z', fromState: { id: 'todo', name: 'Todo' }, toState: { id: 'prod', name: 'Prod' } },
    ],
  });
  const result = resolveDeliveredAt(issue, devRule);
  assert.equal(result.deliveredAt, '');
  assert.equal(result.deliverySource, 'not-reached');
});

test('history failures conservatively fall back to Linear completion', () => {
  const issue = rawIssue({ _history: [], _historyFailed: true });
  const result = resolveDeliveredAt(issue, devRule);
  assert.equal(result.deliveredAt, '2026-01-10T00:00:00Z');
  assert.equal(result.deliverySource, 'history-fallback');
});

test('processed metrics use delivery time while preserving Linear completion', () => {
  const issue = rawIssue({
    _history: [
      { createdAt: '2026-01-05T00:00:00Z', fromState: { id: 'doing', name: 'Doing' }, toState: { id: 'dev', name: 'Dev' } },
      { createdAt: '2026-01-09T00:00:00Z', fromState: { id: 'dev', name: 'Dev' }, toState: { id: 'prod', name: 'Prod' } },
    ],
  });
  const [processed] = processIssues([issue], devRule);
  assert.equal(processed.completedAt, '2026-01-05T00:00:00Z');
  assert.equal(processed.deliveredAt, '2026-01-05T00:00:00Z');
  assert.equal(processed.linearCompletedAt, '2026-01-10T00:00:00Z');
  assert.equal(processed.projectId, 'project-a');
  assert.equal(processed.cycleTimeDays, 3);
  assert.equal(processed.leadTimeDays, 4);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCumulativeFlow, computeFlowEfficiency, computeLeadTimeHistogram, computePrediction,
  computeSprintBurndown, computeVelocityWithTrend,
} from '../src/computeCharts.js';

function issue(overrides = {}) {
  return { id: 'A-1', title: 'Issue', points: 1, createdAt: '2026-01-01T10:00:00Z', completedAt: '', startedAt: '', canceledAt: '', ...overrides };
}

test('lead-time buckets include exact boundaries', () => {
  const days = [0, 3, 3.1, 7, 7.1, 14, 14.1, 30, 30.1];
  const result = computeLeadTimeHistogram(days.map((leadTimeDays, index) => issue({ id: `A-${index}`, leadTimeDays })));
  assert.deepEqual(result.map(bucket => bucket.count), [2, 2, 2, 2, 1]);
});

test('flow efficiency is clamped to 0–100%', () => {
  const result = computeFlowEfficiency([
    issue({ completedAt: '2026-01-02T00:00:00Z', cycleTimeDays: 10, leadTimeDays: 5 }),
    issue({ id: 'A-2', completedAt: '2026-01-02T00:00:00Z', cycleTimeDays: 1, leadTimeDays: 4 }),
  ]);
  assert.equal(result.avg, 63);
  assert.equal(result.distribution.reduce((sum, bucket) => sum + bucket.count, 0), 2);
});

test('burndown uses cycle metadata and reaches ideal zero on final day', () => {
  const data = computeSprintBurndown([
    issue({ points: 5, cycleNumber: 7, cycleStartsAt: '2026-01-05T00:00:00Z', cycleEndsAt: '2026-01-07T23:59:59Z', completedAt: '2026-01-06T12:00:00Z' }),
    issue({ id: 'A-2', points: 3, cycleNumber: 7, cycleStartsAt: '2026-01-05T00:00:00Z', cycleEndsAt: '2026-01-07T23:59:59Z' }),
  ], 7);
  assert.equal(data.length, 3);
  assert.equal(data[0].remaining, 8);
  assert.equal(data[1].remaining, 3);
  assert.equal(data.at(-1).ideal, 0);
});

test('cumulative flow classifies issue states over time', () => {
  const data = computeCumulativeFlow([
    issue({ createdAt: '2026-01-05T00:00:00Z', startedAt: '2026-01-06T00:00:00Z', completedAt: '2026-01-19T00:00:00Z' }),
  ], '2026-01-19T00:00:00Z');
  assert.ok(data.some(point => point.Backlog === 1));
  assert.ok(data.some(point => point['In Progress'] === 1));
  assert.ok(data.some(point => point.Done === 1));
});

test('velocity includes empty weeks and a rolling average', () => {
  const data = computeVelocityWithTrend([
    issue({ completedAt: '2026-01-05T12:00:00Z', points: 5 }),
    issue({ id: 'A-2', completedAt: '2026-01-19T12:00:00Z', points: 3 }),
  ], '2026-01-19T12:00:00Z');
  assert.equal(data.length, 3);
  assert.equal(data[1].points, 0);
  assert.equal(typeof data.at(-1).rollingAvgCount, 'number');
});

test('prediction never returns negative remaining scope', () => {
  const issues = [issue({ points: 5, completedAt: '2026-01-05T00:00:00Z' })];
  const velocity = computeVelocityWithTrend(issues, '2026-01-05T00:00:00Z');
  const prediction = computePrediction(issues, velocity, '2026-01-05T00:00:00Z');
  assert.equal(prediction.remaining, 0);
  assert.ok(prediction.chartData.every(point => point.actual == null || point.actual >= 0));
});

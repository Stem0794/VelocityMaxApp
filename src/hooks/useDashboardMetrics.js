import { useMemo } from 'react';
import {
  computeCumulativeFlow, computeFlowEfficiency, computeLeadTimeHistogram, computePrediction, computeVelocityWithTrend,
} from '../computeCharts';
import { computeBurnupData } from '../linearApi';

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

export default function useDashboardMetrics(issues, lastUpdated, workflowStates = []) {
  const velocityData = useMemo(() => computeVelocityWithTrend(issues, lastUpdated), [issues, lastUpdated]);
  const leadTimeHistogram = useMemo(() => computeLeadTimeHistogram(issues), [issues]);
  const flowEfficiency = useMemo(() => computeFlowEfficiency(issues), [issues]);
  const predictionResult = useMemo(() => computePrediction(issues, velocityData, lastUpdated), [issues, lastUpdated, velocityData]);
  const cumulativeFlowData = useMemo(() => computeCumulativeFlow(issues, lastUpdated), [issues, lastUpdated]);
  const burnupData = useMemo(() => computeBurnupData(issues), [issues]);

  const cycleTimeData = useMemo(() => issues
    .filter(issue => issue.completedAt && Number.isFinite(Number(issue.cycleTimeDays)))
    .map(issue => ({
      completed: new Date(issue.completedAt).getTime(),
      dateStr: new Date(issue.completedAt).toLocaleDateString(),
      cycleTime: Number(issue.cycleTimeDays),
      title: issue.title,
      points: Number(issue.points) || 0,
    }))
    .filter(point => Number.isFinite(point.completed))
    .sort((a, b) => a.completed - b.completed), [issues]);

  const uniqueCycles = useMemo(() => {
    const map = new Map();
    issues.forEach(issue => {
      if (issue.cycleNumber === '' || issue.cycleNumber == null) return;
      if (!map.has(issue.cycleNumber)) {
        map.set(issue.cycleNumber, {
          number: issue.cycleNumber,
          startsAt: issue.cycleStartsAt || '',
          endsAt: issue.cycleEndsAt || '',
        });
      }
    });
    return [...map.values()].sort((a, b) => Number(b.number) - Number(a.number));
  }, [issues]);

  const currentCycleNumber = useMemo(() => {
    const today = new Date();
    const active = uniqueCycles.find(cycle => {
      const start = cycle.startsAt ? new Date(cycle.startsAt) : null;
      const end = cycle.endsAt ? new Date(cycle.endsAt) : null;
      return start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= today && today <= end;
    });
    return active?.number ?? uniqueCycles[0]?.number ?? null;
  }, [uniqueCycles]);

  const cycleComparison = useMemo(() => uniqueCycles.slice(0, 8).map(cycle => {
    const cycleIssues = issues.filter(issue => String(issue.cycleNumber) === String(cycle.number));
    const completed = cycleIssues.filter(issue => issue.completedAt);
    const cycleTimes = completed.map(issue => Number(issue.cycleTimeDays)).filter(Number.isFinite);
    return {
      label: `C${cycle.number}${cycle.number === currentCycleNumber ? ' •' : ''}`,
      points: completed.reduce((sum, issue) => sum + (Number(issue.points) || 0), 0),
      tickets: completed.length,
      avgCycleTime: cycleTimes.length
        ? Math.round((cycleTimes.reduce((sum, value) => sum + value, 0) / cycleTimes.length) * 10) / 10
        : 0,
      completionPct: cycleIssues.length ? Math.round((completed.length / cycleIssues.length) * 100) : 0,
    };
  }).reverse(), [currentCycleNumber, issues, uniqueCycles]);

  const allStatuses = useMemo(() => workflowStates.length
    ? [...workflowStates]
    : [...new Set(issues.flatMap(issue => Object.keys(issue.timeByStatus || {})))].sort(), [issues, workflowStates]);

  const totalIssues = issues.length;
  const completedIssues = issues.filter(issue => issue.completedAt).length;
  const totalPoints = issues.reduce((sum, issue) => sum + (Number(issue.points) || 0), 0);
  const completedPoints = issues.filter(issue => issue.completedAt)
    .reduce((sum, issue) => sum + (Number(issue.points) || 0), 0);
  const cycleValues = cycleTimeData.map(point => point.cycleTime);
  const avgCycleTime = cycleValues.length
    ? Math.round((cycleValues.reduce((sum, value) => sum + value, 0) / cycleValues.length) * 10) / 10
    : null;
  const medianCycleTime = median(cycleValues);

  const healthScore = useMemo(() => {
    const factors = [];
    if (velocityData.length >= 2) {
      const last4 = velocityData.slice(-4).map(week => week.points);
      const prev4 = velocityData.slice(-8, -4).map(week => week.points);
      const lastAvg = last4.reduce((sum, value) => sum + value, 0) / last4.length;
      const prevAvg = prev4.length ? prev4.reduce((sum, value) => sum + value, 0) / prev4.length : lastAvg;
      const ratio = prevAvg > 0 ? lastAvg / prevAvg : 1;
      const score = ratio >= 1.1 ? 100 : ratio >= 0.9 ? 75 : ratio >= 0.7 ? 50 : 25;
      const value = ratio >= 1.1
        ? `+${Math.round((ratio - 1) * 100)}% vs prior`
        : ratio >= 0.9 ? 'Stable' : `-${Math.round((1 - ratio) * 100)}% vs prior`;
      factors.push({ key: 'velocity', label: 'Velocity', value, score });
    }
    if (flowEfficiency) {
      const score = flowEfficiency.avg >= 50 ? 100 : flowEfficiency.avg >= 30 ? 75 : flowEfficiency.avg >= 15 ? 50 : 25;
      factors.push({ key: 'flow', label: 'Flow efficiency', value: `${flowEfficiency.avg}% active`, score });
    }
    const totalLead = leadTimeHistogram.reduce((sum, bucket) => sum + bucket.count, 0);
    if (totalLead) {
      const fast = leadTimeHistogram.slice(0, 2).reduce((sum, bucket) => sum + bucket.count, 0);
      const pct = Math.round((fast / totalLead) * 100);
      const score = pct >= 70 ? 100 : pct >= 50 ? 75 : pct >= 30 ? 50 : 25;
      factors.push({ key: 'leadtime', label: 'Lead time', value: `${pct}% ≤7d`, score });
    }
    if (totalIssues) {
      const pct = Math.round((completedIssues / totalIssues) * 100);
      const score = pct >= 70 ? 100 : pct >= 50 ? 75 : pct >= 30 ? 50 : 25;
      factors.push({ key: 'delivery', label: 'Delivery', value: `${pct}% delivered`, score });
    }
    if (!factors.length) return null;
    return {
      overall: Math.round(factors.reduce((sum, factor) => sum + factor.score, 0) / factors.length),
      factors,
    };
  }, [completedIssues, flowEfficiency, leadTimeHistogram, totalIssues, velocityData]);

  return {
    velocityData, leadTimeHistogram, flowEfficiency, predictionResult, cumulativeFlowData, burnupData,
    cycleTimeData, uniqueCycles, currentCycleNumber, cycleComparison, allStatuses,
    totalIssues, completedIssues, totalPoints, completedPoints, avgCycleTime, medianCycleTime, healthScore,
  };
}

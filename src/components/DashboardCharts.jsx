import { RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { computeSprintBurndown } from '../computeCharts';
import { DEFAULT_CHART_ORDER, normalizeChartOrder } from '../dashboardState';
import IssuesTable from '../IssuesTable';
import ChartCard from './ChartCard';
import BurnupChart from './charts/BurnupChart';
import BurndownChart from './charts/BurndownChart';
import CumulativeFlowChart from './charts/CumulativeFlowChart';
import CycleComparisonChart from './charts/CycleComparisonChart';
import CycleTimesChart from './charts/CycleTimesChart';
import FlowEfficiencyChart from './charts/FlowEfficiencyChart';
import LeadTimeChart from './charts/LeadTimeChart';
import PredictionChart from './charts/PredictionChart';
import StatusBreakdownChart from './charts/StatusBreakdownChart';
import VelocityChart from './charts/VelocityChart';

function loadChartOrder() {
  try { return normalizeChartOrder(JSON.parse(localStorage.getItem('vmChartOrder') || '[]')); }
  catch { return DEFAULT_CHART_ORDER; }
}

export default function DashboardCharts({
  metrics,
  issues,
  selectedStatuses,
  setSelectedStatuses,
  loadingHistory,
  historyProgress,
  visibleIds = null,
  reorderable = true,
}) {
  const [chartOrder, setChartOrder] = useState(loadChartOrder);
  const [dragOverId, setDragOverId] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState('');
  const dragId = useRef(null);
  const activeOrder = visibleIds || chartOrder;

  useEffect(() => {
    if (metrics.currentCycleNumber != null) setSelectedCycle(String(metrics.currentCycleNumber));
  }, [metrics.currentCycleNumber]);

  const burndownData = useMemo(() => computeSprintBurndown(issues, selectedCycle), [issues, selectedCycle]);
  const statusBreakdownData = useMemo(() => {
    const statuses = selectedStatuses.length ? selectedStatuses : metrics.allStatuses;
    return statuses.map(status => {
      const values = issues.map(issue => Number(issue.timeByStatus?.[status])).filter(Number.isFinite);
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const median = sorted.length ? (sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : 0;
      return {
        status,
        avg: values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0,
        median: Math.round(median * 10) / 10,
      };
    });
  }, [issues, metrics.allStatuses, selectedStatuses]);

  const persistOrder = next => {
    setChartOrder(next);
    localStorage.setItem('vmChartOrder', JSON.stringify(next));
  };

  const move = (id, offset) => {
    const index = chartOrder.indexOf(id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= chartOrder.length) return;
    const next = [...chartOrder];
    [next[index], next[target]] = [next[target], next[index]];
    persistOrder(next);
  };

  const dragProps = id => {
    if (!reorderable) return undefined;
    return {
      draggable: true,
      onDragStart: event => {
        dragId.current = id;
        event.dataTransfer.effectAllowed = 'move';
      },
      onDragEnter: () => {
        if (dragId.current && dragId.current !== id) setDragOverId(id);
      },
      onDragOver: event => event.preventDefault(),
      onDrop: event => {
        event.preventDefault();
        const source = dragId.current;
        if (!source || source === id) return;
        const next = [...chartOrder];
        const from = next.indexOf(source);
        const to = next.indexOf(id);
        if (from < 0 || to < 0) return;
        next.splice(to, 0, next.splice(from, 1)[0]);
        persistOrder(next);
        dragId.current = null;
        setDragOverId(null);
      },
      onDragEnd: () => {
        dragId.current = null;
        setDragOverId(null);
      },
      'data-drag-over': dragOverId === id ? 'true' : undefined,
    };
  };

  const cardProps = (id, title, extra = {}) => ({
    id,
    title,
    dragProps: dragProps(id),
    first: activeOrder[0] === id,
    last: activeOrder.at(-1) === id,
    onMoveUp: () => move(id, -1),
    onMoveDown: () => move(id, 1),
    reorderable,
    ...extra,
  });

  const renderChart = id => {
    switch (id) {
      case 'velocity':
        return <ChartCard key={id} {...cardProps(id, 'Weekly velocity')} summary="Delivered points and ticket throughput by ISO week." details="Bars show delivered story points; the ticket line shows delivered issue count. Delivery is resolved from each project's configured milestone, or Linear completion when no rule exists. The dashed line is a four-week rolling average of tickets."><VelocityChart data={metrics.velocityData} /></ChartCard>;
      case 'cycle-compare':
        return metrics.cycleComparison.length >= 2 ? <ChartCard key={id} {...cardProps(id, 'Cycle comparison')} summary="Delivery across recent cycles." details="Compare delivered points, ticket count and delivery percentage for up to eight recent cycles. The dot marks the current cycle."><CycleComparisonChart data={metrics.cycleComparison} /></ChartCard> : null;
      case 'cycle-times':
        return <ChartCard key={id} {...cardProps(id, 'Issue cycle times')} summary="Delivered issues plotted by delivery date and time in progress." details="Each point is an issue that reached its delivery milestone. Red points exceeded 14 days in progress and are useful candidates for retro review."><CycleTimesChart data={metrics.cycleTimeData} /></ChartCard>;
      case 'burnup':
        return <ChartCard key={id} {...cardProps(id, 'Burn-up')} summary="Cumulative scope versus delivered story points." details="Scope rises when estimated issues are created. Delivered work rises when issues reach their configured project milestone. A widening gap signals growing remaining scope."><BurnupChart data={metrics.burnupData} /></ChartCard>;
      case 'burndown':
        return <ChartCard key={id} {...cardProps(id, 'Sprint burndown', { actions: metrics.uniqueCycles.length ? <select className="chart-inline-select" value={selectedCycle} onChange={event => setSelectedCycle(event.target.value)} aria-label="Sprint cycle">{metrics.uniqueCycles.map(cycle => <option key={cycle.number} value={cycle.number}>Cycle {cycle.number}{cycle.number === metrics.currentCycleNumber ? ' · current' : ''}</option>)}</select> : null })} summary="Remaining points versus ideal sprint pace." details="A flat remaining line means no point-bearing work reached its delivery milestone during that period. Falling faster than ideal means the sprint is ahead of a linear pace.">{metrics.uniqueCycles.length ? <BurndownChart data={burndownData} /> : <div className="chart-empty">No cycle data in the current scope.</div>}</ChartCard>;
      case 'lead-time':
        return <ChartCard key={id} {...cardProps(id, 'Lead-time distribution')} summary="Time from issue creation to delivery." details="Lead time ends when the issue first reaches its configured delivery milestone. Buckets are inclusive at their displayed upper bounds: ≤3d, >3–7d, >7–14d, >14–30d and >30d."><LeadTimeChart data={metrics.leadTimeHistogram} /></ChartCard>;
      case 'flow-efficiency':
        return <ChartCard key={id} {...cardProps(id, 'Flow efficiency')} summary={metrics.flowEfficiency ? `${metrics.flowEfficiency.avg}% average active-time ratio.` : 'Requires issues with cycle and lead time.'} details="Flow efficiency is cycle time divided by lead time, clamped to 0–100% to protect against inconsistent source timestamps."><FlowEfficiencyChart data={metrics.flowEfficiency} /></ChartCard>;
      case 'status-breakdown':
        return <ChartCard key={id} {...cardProps(id, 'Time in status')} summary="Average and median days by workflow state." details="Large gaps between average and median often indicate a few long-running outliers. History loads after the core dashboard, so this chart can update progressively."><StatusBreakdownChart data={statusBreakdownData} statuses={metrics.allStatuses} selectedStatuses={selectedStatuses} setSelectedStatuses={setSelectedStatuses} loadingHistory={loadingHistory} historyProgress={historyProgress} /></ChartCard>;
      case 'cfd':
        return <ChartCard key={id} {...cardProps(id, 'Cumulative flow')} summary="Weekly inventory across backlog, active work and delivered states." details="A widening In Progress band can indicate WIP accumulation. Done grows cumulatively as issues reach their delivery milestone."><CumulativeFlowChart data={metrics.cumulativeFlowData} /></ChartCard>;
      case 'prediction':
        return metrics.predictionResult ? <ChartCard key={id} {...cardProps(id, 'Scope forecast')} summary={`${metrics.predictionResult.remaining} points remain in the current scope.`} details="Forecasts use the most recent four weeks of delivered point velocity. Optimistic uses the best recent week, average uses the mean and pessimistic uses the slowest non-zero week."><PredictionChart data={metrics.predictionResult} /></ChartCard> : null;
      case 'issues':
        return <ChartCard key={id} {...cardProps(id, 'Issues', { fullWidth: true })} summary="Search, sort and export the issues in the current scope." details="Delivered and Linear-completed dates are shown separately. CSV export neutralizes spreadsheet-formula prefixes in user-controlled text fields."><IssuesTable issues={issues} /></ChartCard>;
      default:
        return null;
    }
  };

  return (
    <>
      <div className={`charts-grid-v2${reorderable ? '' : ' fixed-order'}`}>{activeOrder.map(renderChart)}</div>
      {reorderable && JSON.stringify(chartOrder) !== JSON.stringify(DEFAULT_CHART_ORDER) ? (
        <div className="chart-order-reset">
          <button className="subtle-btn" type="button" onClick={() => { localStorage.removeItem('vmChartOrder'); setChartOrder(DEFAULT_CHART_ORDER); }}>
            <RotateCcw size={14} aria-hidden="true" /> Reset chart order
          </button>
        </div>
      ) : null}
    </>
  );
}

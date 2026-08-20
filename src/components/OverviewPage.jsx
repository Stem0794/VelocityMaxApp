import { ArrowRight, SlidersHorizontal } from 'lucide-react';
import BudgetOverview from './BudgetOverview';
import DashboardCharts from './DashboardCharts';
import HealthScore from './HealthScore';

function pulseCopy(score) {
  if (score >= 80) return ['Delivery is in a healthy rhythm.', 'Throughput and flow are broadly stable across the current scope.'];
  if (score >= 65) return ['Delivery is steady, with a few signals to watch.', 'The system is moving, but one or two dimensions deserve attention.'];
  return ['Delivery needs attention.', 'Use the signals below to find where work is slowing down or becoming less predictable.'];
}

function completion(total, completed) {
  return total ? Math.round((completed / total) * 100) : 0;
}

export default function OverviewPage({ metrics, issues, team, presetName, budgetData, budgetError, budgetConfigured, onNavigate, onOpenScope }) {
  const score = metrics.healthScore?.overall ?? 0;
  const [headline, body] = pulseCopy(score);
  const factors = metrics.healthScore?.factors || [];
  const strongest = factors.length ? [...factors].sort((a, b) => b.score - a.score)[0] : null;
  const weakest = factors.length ? [...factors].sort((a, b) => a.score - b.score)[0] : null;

  return (
    <div className="overview-page">
      <section className="overview-hero">
        <div className="overview-hero-copy">
          <span className="page-eyebrow">Delivery pulse</span>
          <h2>{headline}</h2>
          <p>{body}</p>
          <div className="overview-hero-actions">
            <button type="button" className="hero-primary" onClick={() => onNavigate('delivery')}>Explore delivery <ArrowRight size={17} /></button>
            <button type="button" className="hero-secondary" onClick={onOpenScope}><SlidersHorizontal size={17} /> Adjust scope</button>
          </div>
        </div>
        <div className="overview-score" aria-label={`Health score ${score} out of 100`}><strong>{score}</strong><span>Health score</span><small>{presetName || team || 'Current workspace'}</small></div>
      </section>

      <section className="metric-ribbon" aria-label="Key metrics">
        <div><span>Completion</span><strong>{completion(metrics.totalIssues, metrics.completedIssues)}%</strong><small>{metrics.completedIssues} of {metrics.totalIssues} issues</small></div>
        <div><span>Delivered</span><strong>{metrics.completedPoints}</strong><small>story points</small></div>
        <div><span>Cycle time</span><strong>{metrics.avgCycleTime == null ? '—' : `${metrics.avgCycleTime}d`}</strong><small>{metrics.medianCycleTime == null ? 'No median yet' : `Median ${metrics.medianCycleTime}d`}</small></div>
        <div><span>In scope</span><strong>{metrics.totalIssues}</strong><small>issues tracked</small></div>
      </section>

      <section className="overview-signals">
        <div className="section-intro"><span>Signals</span><h2>What stands out</h2><p>VelocityMAX surfaces the strongest and weakest parts of the current delivery system.</p></div>
        <div className="signal-grid">
          <article className="signal-card positive"><span>Strongest signal</span><strong>{strongest?.label || 'No signal yet'}</strong><p>{strongest ? `${strongest.value} · score ${strongest.score}/100` : 'More completed work is needed before this can be scored.'}</p></article>
          <article className="signal-card attention"><span>Needs attention</span><strong>{weakest?.label || 'No signal yet'}</strong><p>{weakest ? `${weakest.value} · score ${weakest.score}/100` : 'No weak signal is available in this scope.'}</p></article>
        </div>
      </section>

      {budgetConfigured || budgetError ? <BudgetOverview budgetData={budgetData} error={budgetError} configured={budgetConfigured} /> : null}

      <section className="overview-section">
        <div className="section-intro"><span>Trend</span><h2>Delivery momentum</h2><p>Two views only: recent throughput and the forecast for remaining scope.</p></div>
        <DashboardCharts metrics={metrics} issues={issues} selectedStatuses={[]} setSelectedStatuses={() => {}} loadingHistory={false} historyProgress={{ done: 0, total: 0, failed: 0 }} visibleIds={['velocity', 'prediction']} reorderable={false} />
      </section>

      <section className="overview-section">
        <div className="section-intro"><span>Health</span><h2>System factors</h2><p>Use these factors as diagnostic signals, not as a single productivity score.</p></div>
        <HealthScore healthScore={metrics.healthScore} presetName={presetName} team={team} metrics={{ totalIssues: metrics.totalIssues, completedIssues: metrics.completedIssues, totalPoints: metrics.totalPoints, avgCycleTime: metrics.avgCycleTime }} />
      </section>
    </div>
  );
}

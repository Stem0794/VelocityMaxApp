import { CheckCircle2, CircleGauge, Layers3, TimerReset } from 'lucide-react';

function KpiCard({ icon: Icon, label, value, context }) {
  return (
    <div className="kpi-card-v2">
      <div className="kpi-icon"><Icon size={17} aria-hidden="true" /></div>
      <div className="kpi-copy">
        <div className="kpi-label-v2">{label}</div>
        <div className="kpi-value-v2">{value}</div>
        <div className="kpi-context">{context}</div>
      </div>
    </div>
  );
}

export default function KpiGrid({ totalIssues, completedIssues, totalPoints, completedPoints, avgCycleTime, medianCycleTime }) {
  const completion = totalIssues ? Math.round((completedIssues / totalIssues) * 100) : 0;
  return (
    <section className="kpi-grid-v2" aria-label="Key metrics">
      <KpiCard icon={Layers3} label="Issues in scope" value={totalIssues} context={`${completedIssues} completed`} />
      <KpiCard icon={CheckCircle2} label="Completion" value={`${completion}%`} context={`${completedIssues} of ${totalIssues} issues`} />
      <KpiCard icon={CircleGauge} label="Story points" value={totalPoints} context={`${completedPoints} points delivered`} />
      <KpiCard icon={TimerReset} label="Avg cycle time" value={avgCycleTime == null ? '—' : `${avgCycleTime}d`} context={medianCycleTime == null ? 'No completed issues' : `Median ${medianCycleTime}d`} />
    </section>
  );
}

import DashboardCharts from './DashboardCharts';

export default function MetricPage({ eyebrow, title, description, chartIds, metrics, issues, burndownIssues, selectedStatuses, setSelectedStatuses, loadingHistory, historyProgress }) {
  return (
    <div className="metric-page">
      <section className="metric-page-intro">
        <span className="page-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </section>
      <DashboardCharts
        metrics={metrics}
        issues={issues}
        burndownIssues={burndownIssues}
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        loadingHistory={loadingHistory}
        historyProgress={historyProgress}
        visibleIds={chartIds}
        reorderable={false}
      />
    </div>
  );
}

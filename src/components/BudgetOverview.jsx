export default function BudgetOverview({ budgetData, error, configured = false }) {
  if (!configured && !budgetData?.length && !error) return null;
  return (
    <section className="budget-card-v2">
      <div className="section-heading-v2"><div><div className="section-eyebrow">Everhour</div><h2>Budget overview</h2></div></div>
      {error ? <div className="inline-warning" role="status">{error}</div> : null}
      {configured && !error && !budgetData?.length ? <div className="budget-empty">No budget data was returned for the configured Everhour projects.</div> : null}
      {budgetData?.length ? <div className="budget-list-v2">{budgetData.map(project => {
        const pct = project.percentUsed;
        const tone = pct == null ? 'neutral' : pct > 90 ? 'bad' : pct > 75 ? 'warn' : 'good';
        return <div className="budget-row-v2" key={project.id}>
          <div className="budget-project"><strong>{project.name}</strong><span>{project.consumedDisplay ?? '—'} of {project.budgetDisplay ?? '—'}</span></div>
          <div className="budget-progress-v2"><div><span className={`tone-bg-${tone}`} style={{ width: `${Math.min(100, Math.max(0, pct || 0))}%` }} /></div><strong className={`tone-${tone}`}>{pct == null ? '—' : `${pct}%`}</strong></div>
        </div>;
      })}</div> : null}
    </section>
  );
}

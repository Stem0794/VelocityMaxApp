import { ArrowDown, ArrowUp, GripVertical, Info } from 'lucide-react';

export default function ChartCard({
  id, title, summary, details, children, fullWidth = false,
  dragProps, onMoveUp, onMoveDown, first, last, actions, reorderable = true,
}) {
  return (
    <section className={`chart-card-v2${fullWidth ? ' chart-full-width' : ''}`} {...(dragProps || {})}>
      <div className="chart-card-header">
        <div className="chart-card-copy">
          <div className="chart-title-row-v2">
            <h3>{title}</h3>
            {details ? (
              <details className="chart-help">
                <summary aria-label={`About ${title}`} title={`About ${title}`}><Info size={15} aria-hidden="true" /></summary>
                <div className="chart-help-popover">{details}</div>
              </details>
            ) : null}
          </div>
          {summary ? <p>{summary}</p> : null}
        </div>
        <div className="chart-card-actions">
          {actions}
          {reorderable ? (
            <>
              <button type="button" className="chart-order-btn" onClick={onMoveUp} disabled={first} aria-label={`Move ${title} up`} title="Move up">
                <ArrowUp size={14} aria-hidden="true" />
              </button>
              <button type="button" className="chart-order-btn" onClick={onMoveDown} disabled={last} aria-label={`Move ${title} down`} title="Move down">
                <ArrowDown size={14} aria-hidden="true" />
              </button>
              <span className="chart-drag-handle-v2" role="img" aria-label={`Drag ${title} to reorder`} title="Drag to reorder">
                <GripVertical size={17} aria-hidden="true" />
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="chart-card-body" data-chart-id={id}>{children}</div>
    </section>
  );
}

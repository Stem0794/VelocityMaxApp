import { RotateCcw, Save, X } from 'lucide-react';
import { useEffect } from 'react';
import MultiSelectDropdown from './MultiSelectDropdown';

const QUICK_RANGES = [['30d', '30 days'], ['90d', '90 days'], ['quarter', 'Quarter'], ['all', 'All time']];

export default function ScopeDrawer({ open, onClose, filters, onSaveDefaults, canSaveDefaults }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="scope-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="scope-drawer" role="dialog" aria-modal="true" aria-labelledby="scope-title">
        <header>
          <div><span>Measurement scope</span><h2 id="scope-title">Choose inventory and delivery windows</h2></div>
          <button type="button" className="square-action" onClick={onClose} aria-label="Close scope"><X size={20} /></button>
        </header>

        <div className="scope-body">
          <div className="scope-count-card" role="status">
            <span><strong>{filters.loadedIssueCount}</strong> loaded</span>
            <span><strong>{filters.scopeIssueCount}</strong> in inventory scope</span>
            <span><strong>{filters.deliveredIssueCount}</strong> delivered · {filters.deliveryWindowLabel}</span>
          </div>

          <section className="scope-group">
            <div className="scope-group-copy"><span>Inventory scope</span><p>Project, assignee and current workflow status apply to every page. They describe which tickets belong to the workspace inventory right now.</p></div>
            <label>Project<select value={filters.selectedProject} onChange={event => filters.setSelectedProject(event.target.value)}><option value="All">All projects</option>{filters.uniqueProjects.map(project => <option key={project}>{project}</option>)}</select></label>
            <label>Assignee<select value={filters.selectedAssignee} onChange={event => filters.setSelectedAssignee(event.target.value)}><option value="All">All assignees</option>{filters.uniqueAssignees.map(assignee => <option key={assignee}>{assignee}</option>)}</select></label>
            <label>Current status<MultiSelectDropdown options={filters.uniqueCurrentStatuses} selected={filters.selectedCurrentStatuses} onChange={filters.setSelectedCurrentStatuses} /></label>
          </section>

          <section className="scope-group delivery-window-group">
            <div className="scope-group-copy">
              <span>Delivery window</span>
              <p>Dates are matched against <strong>Delivered</strong>, not issue creation. Older tickets delivered during this window still count. The Issues inventory and current WIP are never hidden because they were created earlier.</p>
            </div>
            <div className="scope-range-pills">{QUICK_RANGES.map(([value, label]) => <button key={value} type="button" className={filters.quickRange === value ? 'active' : ''} aria-pressed={filters.quickRange === value} onClick={() => filters.applyQuickRange(value)}>{label}</button>)}</div>
            <div className="scope-date-grid">
              <label>Delivered from<input type="date" value={filters.dateFrom} onChange={event => filters.setDateFrom(event.target.value)} aria-invalid={Boolean(filters.rangeError)} /></label>
              <label>Delivered to<input type="date" value={filters.dateTo} onChange={event => filters.setDateTo(event.target.value)} aria-invalid={Boolean(filters.rangeError)} /></label>
            </div>
            {filters.rangeError ? <p className="inline-error" role="alert">{filters.rangeError}</p> : null}
          </section>
        </div>

        <footer>
          <button type="button" className="drawer-secondary" onClick={filters.reset} disabled={!filters.activeFilterCount}><RotateCcw size={16} /> Reset</button>
          <button type="button" className="drawer-primary" onClick={onSaveDefaults} disabled={!canSaveDefaults || Boolean(filters.rangeError)}><Save size={16} /> Save as workspace default</button>
        </footer>
      </aside>
    </div>
  );
}

import { Filter, RotateCcw, Save } from 'lucide-react';
import { useState } from 'react';
import MultiSelectDropdown from './MultiSelectDropdown';

function FilterActions({ filters, onSaveDefaults, canSaveDefaults }) {
  return (
    <>
      <button className="subtle-btn" type="button" onClick={filters.reset} disabled={!filters.activeFilterCount}>
        <RotateCcw size={14} aria-hidden="true" /> Reset
      </button>
      <button className="subtle-btn" type="button" onClick={onSaveDefaults} disabled={!canSaveDefaults || Boolean(filters.rangeError)}>
        <Save size={14} aria-hidden="true" /> Save defaults
      </button>
    </>
  );
}

export default function DashboardFilters({ filters, onSaveDefaults, canSaveDefaults }) {
  const [expanded, setExpanded] = useState(false);
  const ranges = [
    ['30d', '30d'], ['90d', '90d'], ['quarter', 'Quarter'], ['all', 'All'],
  ];

  return (
    <section className={`filter-panel${expanded ? ' expanded' : ''}`} aria-label="Dashboard filters">
      <div className="filter-panel-heading">
        <div>
          <div className="section-eyebrow">Scope</div>
          <div className="filter-title-row">
            <h2>Filters</h2>
            {filters.activeFilterCount ? <span className="filter-count">{filters.activeFilterCount} active</span> : null}
          </div>
        </div>
        <div className="filter-heading-actions">
          <button className="filter-mobile-toggle" type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
            <Filter size={15} aria-hidden="true" />
            {expanded ? 'Hide' : 'Show'} filters
          </button>
          <div className="filter-desktop-actions">
            <FilterActions filters={filters} onSaveDefaults={onSaveDefaults} canSaveDefaults={canSaveDefaults} />
          </div>
        </div>
      </div>

      <div className="filter-controls">
        <div className="filter-field filter-field-wide">
          <label htmlFor="filter-project">Project</label>
          <select id="filter-project" value={filters.selectedProject} onChange={event => filters.setSelectedProject(event.target.value)}>
            <option value="All">All projects</option>
            {filters.uniqueProjects.map(project => <option key={project}>{project}</option>)}
          </select>
        </div>
        <div className="filter-field filter-field-wide">
          <label htmlFor="filter-assignee">Assignee</label>
          <select id="filter-assignee" value={filters.selectedAssignee} onChange={event => filters.setSelectedAssignee(event.target.value)}>
            <option value="All">All assignees</option>
            {filters.uniqueAssignees.map(assignee => <option key={assignee}>{assignee}</option>)}
          </select>
        </div>
        <div className="filter-field filter-field-wide">
          <label>Status</label>
          <MultiSelectDropdown
            options={filters.uniqueCurrentStatuses}
            selected={filters.selectedCurrentStatuses}
            onChange={filters.setSelectedCurrentStatuses}
          />
        </div>
        <div className="filter-field filter-field-range">
          <label>Date range</label>
          <div className="quick-ranges" aria-label="Quick date ranges">
            {ranges.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filters.quickRange === value ? 'active' : ''}
                aria-pressed={filters.quickRange === value}
                onClick={() => filters.applyQuickRange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-field filter-field-date">
          <label htmlFor="filter-from">From</label>
          <input id="filter-from" type="date" value={filters.dateFrom} onChange={event => filters.setDateFrom(event.target.value)} aria-invalid={Boolean(filters.rangeError)} />
        </div>
        <div className="filter-field filter-field-date">
          <label htmlFor="filter-to">To</label>
          <input id="filter-to" type="date" value={filters.dateTo} onChange={event => filters.setDateTo(event.target.value)} aria-invalid={Boolean(filters.rangeError)} />
        </div>
      </div>
      <div className="filter-mobile-actions">
        <FilterActions filters={filters} onSaveDefaults={onSaveDefaults} canSaveDefaults={canSaveDefaults} />
      </div>
      {filters.rangeError ? <p className="inline-error" role="alert">{filters.rangeError}</p> : null}
    </section>
  );
}

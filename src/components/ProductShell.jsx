import { Activity, ChartNoAxesCombined, GitBranch, ListTodo, LogOut, Plus, RefreshCw, Settings, SlidersHorizontal } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'delivery', label: 'Delivery', icon: ChartNoAxesCombined },
  { id: 'flow', label: 'Flow', icon: GitBranch },
  { id: 'issues', label: 'Issues', icon: ListTodo },
];

const PAGE_TITLES = {
  overview: ['Overview', 'What needs attention right now'],
  delivery: ['Delivery', 'Throughput, scope and forecast'],
  flow: ['Flow', 'How work moves through the system'],
  issues: ['Issues', 'The work behind the metrics'],
};

function formatUpdatedAt(value) {
  if (!value) return 'Not synced yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last sync unavailable';
  return `Updated ${date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}

function Navigation({ activeView, onViewChange, mobile = false }) {
  return (
    <nav className={mobile ? 'mobile-nav' : 'product-nav'} aria-label="Primary navigation">
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={activeView === id ? 'active' : ''}
          aria-current={activeView === id ? 'page' : undefined}
          onClick={() => onViewChange(id)}
        >
          <Icon size={mobile ? 19 : 18} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export default function ProductShell({
  activeView,
  onViewChange,
  presets,
  activePresetId,
  onSelectPreset,
  onAddPreset,
  onOpenScope,
  activeFilterCount,
  onSettings,
  onSignOut,
  onRefresh,
  refreshing,
  autoRefreshInterval,
  onAutoRefreshChange,
  team,
  lastUpdated,
  children,
}) {
  const [title, subtitle] = PAGE_TITLES[activeView] || PAGE_TITLES.overview;

  return (
    <div className="product-shell">
      <aside className="product-sidebar">
        <div className="product-brand">
          <div className="product-brand-mark">VM</div>
          <div><strong>VelocityMAX</strong><span>Delivery intelligence</span></div>
        </div>

        <div className="workspace-switcher">
          <span>Workspace</span>
          <div className="workspace-select-row">
            <select value={activePresetId} onChange={event => onSelectPreset(event.target.value)} aria-label="Workspace">
              {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
            <button type="button" className="square-action" onClick={onAddPreset} aria-label="Add workspace" title="Add workspace"><Plus size={17} /></button>
          </div>
        </div>

        <Navigation activeView={activeView} onViewChange={onViewChange} />

        <div className="sidebar-spacer" />
        <div className="sidebar-tools">
          <button type="button" onClick={onOpenScope}>
            <SlidersHorizontal size={18} aria-hidden="true" />
            <span>Scope</span>
            {activeFilterCount ? <b>{activeFilterCount}</b> : null}
          </button>
          <button type="button" onClick={onSettings}><Settings size={18} aria-hidden="true" /><span>Settings</span></button>
          <button type="button" onClick={onSignOut}><LogOut size={18} aria-hidden="true" /><span>Sign out</span></button>
        </div>
        <div className="sidebar-sync">
          <div><span>Auto refresh</span><small>{formatUpdatedAt(lastUpdated)}</small></div>
          <select value={autoRefreshInterval} onChange={event => onAutoRefreshChange(event.target.value)} aria-label="Auto refresh interval">
            <option value="off">Off</option><option value="5m">5m</option><option value="15m">15m</option><option value="30m">30m</option>
          </select>
        </div>
      </aside>

      <div className="product-stage">
        <header className="product-topbar">
          <div className="mobile-brand"><span className="product-brand-mark">VM</span><strong>VelocityMAX</strong></div>
          <div className="page-heading"><span>{team || 'Engineering'}</span><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="topbar-actions">
            <button type="button" className="scope-action" onClick={onOpenScope}><SlidersHorizontal size={17} /> Scope{activeFilterCount ? <b>{activeFilterCount}</b> : null}</button>
            <button type="button" className="square-action" onClick={onRefresh} disabled={refreshing} aria-label="Refresh data" title="Refresh data"><RefreshCw size={18} className={refreshing ? 'spin-icon' : ''} /></button>
          </div>
        </header>
        <main className="product-content">{children}</main>
      </div>

      <Navigation activeView={activeView} onViewChange={onViewChange} mobile />
    </div>
  );
}

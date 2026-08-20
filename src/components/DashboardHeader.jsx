import { LogOut, Plus, RefreshCw, Settings } from 'lucide-react';

function formatUpdatedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardHeader({
  presets, activePresetId, onSelectPreset, onAddPreset, onSettings, onSignOut,
  onRefresh, refreshing, data, loadingHistory, historyProgress, autoRefreshInterval, onAutoRefreshChange,
}) {
  const updatedLabel = formatUpdatedAt(data?.lastUpdated);

  return (
    <header className="dashboard-header">
      <div className="app-bar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div className="brand-copy">
            <div className="brand-name">VelocityMAX</div>
            <div className="brand-context">{data?.team || 'Engineering'}</div>
          </div>
        </div>

        <nav className="preset-tabs" aria-label="Dashboard presets">
          {presets.map(preset => (
            <button
              key={preset.id}
              type="button"
              className={`preset-tab${activePresetId === preset.id ? ' active' : ''}`}
              aria-current={activePresetId === preset.id ? 'page' : undefined}
              onClick={() => onSelectPreset(preset.id)}
            >
              {preset.name}
            </button>
          ))}
        </nav>

        <div className="app-actions" aria-label="Dashboard actions">
          {updatedLabel ? <span className="sync-meta">{updatedLabel}</span> : null}
          <label className="auto-refresh-control">
            <span className="sr-only">Auto refresh</span>
            <select value={autoRefreshInterval} onChange={event => onAutoRefreshChange(event.target.value)} aria-label="Auto refresh interval">
              <option value="off">Auto off</option>
              <option value="5m">Auto 5m</option>
              <option value="15m">Auto 15m</option>
              <option value="30m">Auto 30m</option>
            </select>
          </label>
          <button className="icon-action" type="button" onClick={onAddPreset} aria-label="Add preset" title="Add preset">
            <Plus size={17} aria-hidden="true" />
          </button>
          <button className="icon-action" type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh data" title="Refresh data">
            <RefreshCw size={17} className={refreshing ? 'spin-icon' : ''} aria-hidden="true" />
          </button>
          <button className="icon-action" type="button" onClick={onSettings} aria-label="Settings" title="Settings">
            <Settings size={17} aria-hidden="true" />
          </button>
          <button className="icon-action" type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      {loadingHistory ? (
        <div className="header-progress" role="status" aria-live="polite">
          <span>Syncing issue history</span>
          <strong>{historyProgress.done}/{historyProgress.total}</strong>
          {historyProgress.failed ? <span>{historyProgress.failed} failed</span> : null}
        </div>
      ) : null}
    </header>
  );
}

import { LogOut, Plus, RefreshCw, Settings } from 'lucide-react';

export default function DashboardHeader({
  presets, activePresetId, onSelectPreset, onAddPreset, onSettings, onSignOut,
  onRefresh, refreshing, data, loadingHistory, historyProgress, autoRefreshInterval, onAutoRefreshChange,
}) {
  return (
    <header className="dashboard-header">
      <div className="app-bar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">VM</div>
          <div>
            <div className="brand-name">VelocityMAX</div>
            <div className="brand-context">
              <span>{data?.team || 'Engineering dashboard'}</span>
              {data?.lastUpdated ? (
                <span className="sync-meta">Updated {new Date(data.lastUpdated).toLocaleString()}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="app-actions" aria-label="Dashboard actions">
          <label className="auto-refresh-control">
            <span>Auto refresh</span>
            <select value={autoRefreshInterval} onChange={event => onAutoRefreshChange(event.target.value)} aria-label="Auto refresh interval">
              <option value="off">Off</option>
              <option value="5m">5 min</option>
              <option value="15m">15 min</option>
              <option value="30m">30 min</option>
            </select>
          </label>
          <button className="action-btn" type="button" onClick={onRefresh} disabled={refreshing} title="Refresh data">
            <RefreshCw size={16} className={refreshing ? 'spin-icon' : ''} aria-hidden="true" />
            <span className="action-label">Refresh</span>
          </button>
          <button className="action-btn" type="button" onClick={onSettings} title="Settings">
            <Settings size={16} aria-hidden="true" />
            <span className="action-label">Settings</span>
          </button>
          <button className="icon-action" type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="preset-nav-row">
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
        <button className="preset-add-btn" type="button" onClick={onAddPreset}>
          <Plus size={14} aria-hidden="true" />
          Preset
        </button>
      </div>

      {loadingHistory ? (
        <div className="header-progress" role="status" aria-live="polite">
          Loading issue history {historyProgress.done}/{historyProgress.total}
          {historyProgress.failed ? ` · ${historyProgress.failed} failed` : ''}
        </div>
      ) : null}
    </header>
  );
}

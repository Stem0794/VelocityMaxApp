import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import BudgetOverview from './components/BudgetOverview';
import DashboardCharts from './components/DashboardCharts';
import DashboardFilters from './components/DashboardFilters';
import DashboardHeader from './components/DashboardHeader';
import HealthScore from './components/HealthScore';
import KpiGrid from './components/KpiGrid';
import { resolveActivePreset } from './dashboardState';
import useDashboardData from './hooks/useDashboardData';
import useDashboardFilters from './hooks/useDashboardFilters';
import useDashboardMetrics from './hooks/useDashboardMetrics';
import SettingsModal from './SettingsModal';

const DEFAULT_PRESETS = [{ id: 'demo', name: 'Demo', teamId: '', projectIds: [], everhourProjectIds: [] }];
const GOOGLE_CLIENT_ID = '971045009454-n3krt7kq2ku7fg43he23elm9kg5vvq0v.apps.googleusercontent.com';

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
  catch { return fallback; }
}

function LoginScreen({ onAuthenticated, onDemo }) {
  const [authError, setAuthError] = useState('');
  const handleCredential = useCallback(response => {
    try {
      const part = response.credential?.split('.')[1];
      if (!part) throw new Error('Missing credential');
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)));
      if (payload.aud !== GOOGLE_CLIENT_ID || Number(payload.exp) * 1000 <= Date.now() || payload.email_verified === false) {
        throw new Error('Google credential is not valid for this application.');
      }
      const allowed = import.meta.env.VITE_ALLOWED_EMAILS;
      if (allowed) {
        const emails = allowed.split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
        if (!emails.includes(String(payload.email || '').toLowerCase())) throw new Error(`Access denied for ${payload.email || 'this account'}.`);
      }
      onAuthenticated();
    } catch (error) {
      setAuthError(error.message || 'Authentication failed. Please try again.');
    }
  }, [onAuthenticated]);

  useEffect(() => {
    const init = () => {
      const element = document.getElementById('google-signin-btn');
      if (!element || !window.google?.accounts?.id) return;
      element.replaceChildren();
      const width = Math.min(360, Math.max(240, element.clientWidth || 280));
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
      window.google.accounts.id.renderButton(element, { theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'rectangular', width });
    };
    if (window.google?.accounts?.id) {
      init();
      return undefined;
    }
    const existing = document.querySelector('script[data-velocitymax-google]');
    if (existing) {
      existing.addEventListener('load', init, { once: true });
      return () => existing.removeEventListener('load', init);
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.velocitymaxGoogle = 'true';
    script.addEventListener('load', init, { once: true });
    document.head.appendChild(script);
    return () => script.removeEventListener('load', init);
  }, [handleCredential]);

  return (
    <main className="login-screen-v2">
      <section className="login-card-v2">
        <div className="login-brand"><div className="brand-mark">VM</div><div><h1>VelocityMAX</h1><p>Engineering delivery metrics in one dashboard.</p></div></div>
        <div id="google-signin-btn" className="google-signin-slot" />
        {authError ? <p className="inline-error" role="alert">{authError}</p> : null}
        <div className="login-divider"><span>or</span></div>
        <button className="demo-btn" type="button" onClick={onDemo}>Explore with demo data</button>
        <p className="login-security-note">Google sign-in limits dashboard access. API keys remain stored locally in your browser.</p>
      </section>
    </main>
  );
}

function LoadingScreen({ presetName }) {
  return (
    <main className="login-screen-v2">
      <div className="loading-state-v2">
        <div className="loader" />
        <strong>Loading {presetName || 'dashboard'}…</strong>
        <span>Fetching the core dataset. Issue history will continue in the dashboard.</span>
      </div>
    </main>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('vmAuthed') === '1');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsAddPreset, setSettingsAddPreset] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('vmApiKey') || '');
  const [everhourApiKey, setEverhourApiKey] = useState(() => localStorage.getItem('vmEverhourKey') || '');
  const [presets, setPresets] = useState(() => loadJSON('vmPresets', DEFAULT_PRESETS));
  const [activePresetId, setActivePresetId] = useState(() => localStorage.getItem('vmActivePreset') || 'demo');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(() => localStorage.getItem('vmAutoRefresh') || 'off');
  const activePreset = useMemo(() => resolveActivePreset(presets, activePresetId), [activePresetId, presets]);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  useEffect(() => {
    if (activePreset && activePreset.id !== activePresetId) {
      setActivePresetId(activePreset.id);
      localStorage.setItem('vmActivePreset', activePreset.id);
    }
  }, [activePreset, activePresetId]);

  const dashboard = useDashboardData({ isAuthenticated, activePreset, apiKey, everhourApiKey, autoRefreshInterval });
  const filters = useDashboardFilters(dashboard.data, activePreset);
  const metrics = useDashboardMetrics(filters.filteredIssues, dashboard.data?.lastUpdated, dashboard.data?.workflowStates || []);

  const authenticate = () => {
    sessionStorage.setItem('vmAuthed', '1');
    setIsAuthenticated(true);
  };
  const demoLogin = () => {
    setActivePresetId('demo');
    localStorage.setItem('vmActivePreset', 'demo');
    authenticate();
  };
  const signOut = () => {
    sessionStorage.removeItem('vmAuthed');
    setIsAuthenticated(false);
    window.google?.accounts?.id?.disableAutoSelect?.();
  };
  const selectPreset = id => {
    setActivePresetId(id);
    localStorage.setItem('vmActivePreset', id);
  };
  const openSettings = (addPreset = false) => {
    setSettingsAddPreset(addPreset);
    setShowSettings(true);
  };

  const saveSettings = ({ apiKey: nextApiKey, everhourApiKey: nextEverhourKey, presets: nextPresets }) => {
    const safePresets = nextPresets.length ? nextPresets : DEFAULT_PRESETS;
    setApiKey(nextApiKey);
    localStorage.setItem('vmApiKey', nextApiKey);
    setEverhourApiKey(nextEverhourKey);
    localStorage.setItem('vmEverhourKey', nextEverhourKey);
    setPresets(safePresets);
    localStorage.setItem('vmPresets', JSON.stringify(safePresets));
    const nextActive = resolveActivePreset(safePresets, activePresetId);
    if (nextActive) {
      setActivePresetId(nextActive.id);
      localStorage.setItem('vmActivePreset', nextActive.id);
    }
  };

  const saveFilterDefaults = () => {
    if (!activePreset) return;
    const next = presets.map(preset => preset.id === activePreset.id ? { ...preset, ...filters.savedDefaults } : preset);
    setPresets(next);
    localStorage.setItem('vmPresets', JSON.stringify(next));
  };

  if (!isAuthenticated) return <LoginScreen onAuthenticated={authenticate} onDemo={demoLogin} />;
  if (!dashboard.data && !dashboard.error) return <LoadingScreen presetName={activePreset?.name} />;

  if (!dashboard.data && dashboard.error) {
    return (
      <main className="login-screen-v2">
        <section className="error-state-v2">
          <AlertTriangle size={24} aria-hidden="true" />
          <h1>Could not load the dashboard</h1>
          <p>{dashboard.error}</p>
          <div>
            <button type="button" onClick={dashboard.retry}><RefreshCw size={15} aria-hidden="true" /> Retry</button>
            <button className="subtle-btn" type="button" onClick={() => openSettings(false)}><Settings size={15} aria-hidden="true" /> Settings</button>
          </div>
        </section>
        {showSettings ? <SettingsModal apiKey={apiKey} everhourApiKey={everhourApiKey} presets={presets} onSave={saveSettings} onClose={closeSettings} /> : null}
      </main>
    );
  }

  const snapshotMetrics = {
    totalIssues: metrics.totalIssues,
    completedIssues: metrics.completedIssues,
    totalPoints: metrics.totalPoints,
    avgCycleTime: metrics.avgCycleTime,
  };

  return (
    <>
      {showSettings ? <SettingsModal apiKey={apiKey} everhourApiKey={everhourApiKey} presets={presets} onSave={saveSettings} onClose={closeSettings} initialAdd={settingsAddPreset} /> : null}
      <div className="app-container-v2">
        <DashboardHeader
          presets={presets}
          activePresetId={activePresetId}
          onSelectPreset={selectPreset}
          onAddPreset={() => openSettings(true)}
          onSettings={() => openSettings(false)}
          onSignOut={signOut}
          onRefresh={dashboard.refresh}
          refreshing={dashboard.refreshing}
          data={dashboard.data}
          loadingHistory={dashboard.loadingHistory}
          historyProgress={dashboard.historyProgress}
          autoRefreshInterval={autoRefreshInterval}
          onAutoRefreshChange={value => { setAutoRefreshInterval(value); localStorage.setItem('vmAutoRefresh', value); }}
        />
        <main className="dashboard-main-v2">
          {dashboard.error ? <div className="inline-warning" role="status"><AlertTriangle size={15} aria-hidden="true" />Refresh failed: {dashboard.error}. Existing data is still shown.</div> : null}
          {dashboard.historyWarning ? <div className="inline-warning" role="status"><AlertTriangle size={15} aria-hidden="true" />{dashboard.historyWarning}</div> : null}
          <DashboardFilters filters={filters} onSaveDefaults={saveFilterDefaults} canSaveDefaults={Boolean(activePreset)} />
          <BudgetOverview budgetData={dashboard.budgetData} error={dashboard.budgetError} configured={Boolean(activePreset?.everhourProjectIds?.length)} />
          <KpiGrid totalIssues={metrics.totalIssues} completedIssues={metrics.completedIssues} totalPoints={metrics.totalPoints} completedPoints={metrics.completedPoints} avgCycleTime={metrics.avgCycleTime} medianCycleTime={metrics.medianCycleTime} />
          <HealthScore healthScore={metrics.healthScore} presetName={activePreset?.name} team={dashboard.data?.team} metrics={snapshotMetrics} />
          {!filters.filteredIssues.length ? <section className="dashboard-empty-state"><h2>No issues in this scope</h2><p>Adjust the filters or choose another preset. Charts that can render empty datasets remain available below.</p></section> : null}
          <DashboardCharts metrics={metrics} issues={filters.filteredIssues} selectedStatuses={filters.selectedStatuses} setSelectedStatuses={filters.setSelectedStatuses} loadingHistory={dashboard.loadingHistory} historyProgress={dashboard.historyProgress} />
        </main>
      </div>
    </>
  );
}

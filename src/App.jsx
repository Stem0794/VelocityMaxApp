import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import IssuesTable from './IssuesTable';
import MetricPage from './components/MetricPage';
import OverviewPage from './components/OverviewPage';
import ProductShell from './components/ProductShell';
import ScopeDrawer from './components/ScopeDrawer';
import { resolveActivePreset } from './dashboardState';
import useDashboardData from './hooks/useDashboardData';
import useDashboardFilters from './hooks/useDashboardFilters';
import useDashboardMetrics from './hooks/useDashboardMetrics';
import SettingsModal from './SettingsModal';

const DEFAULT_PRESETS = [{ id: 'demo', name: 'Demo', teamId: '', projectIds: [], everhourProjectIds: [] }];
const GOOGLE_CLIENT_ID = '971045009454-n3krt7kq2ku7fg43he23elm9kg5vvq0v.apps.googleusercontent.com';
const DELIVERY_CHARTS = ['velocity', 'cycle-compare', 'burnup', 'burndown', 'prediction'];
const FLOW_CHARTS = ['cycle-times', 'lead-time', 'flow-efficiency', 'status-breakdown', 'cfd'];
const VALID_VIEWS = new Set(['overview', 'delivery', 'flow', 'issues']);

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
  catch { return fallback; }
}

function loadView() {
  const value = localStorage.getItem('vmActiveView');
  return VALID_VIEWS.has(value) ? value : 'overview';
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
        <div className="login-brand"><div className="brand-mark">VM</div><div><h1>VelocityMAX</h1><p>Delivery intelligence for engineering teams.</p></div></div>
        <div id="google-signin-btn" className="google-signin-slot" />
        {authError ? <p className="inline-error" role="alert">{authError}</p> : null}
        <div className="login-divider"><span>or</span></div>
        <button className="demo-btn" type="button" onClick={onDemo}>Explore the demo workspace</button>
        <p className="login-security-note">Google sign-in limits dashboard access. API keys remain stored locally in your browser.</p>
      </section>
    </main>
  );
}

function LoadingScreen({ presetName }) {
  return (
    <main className="login-screen-v2"><div className="loading-state-v2"><div className="loader" /><strong>Opening {presetName || 'workspace'}…</strong><span>Core delivery data loads first. Workflow history continues progressively.</span></div></main>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('vmAuthed') === '1');
  const [activeView, setActiveView] = useState(loadView);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsAddPreset, setSettingsAddPreset] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('vmApiKey') || '');
  const [everhourApiKey, setEverhourApiKey] = useState(() => localStorage.getItem('vmEverhourKey') || '');
  const [presets, setPresets] = useState(() => loadJSON('vmPresets', DEFAULT_PRESETS));
  const [activePresetId, setActivePresetId] = useState(() => localStorage.getItem('vmActivePreset') || 'demo');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(() => localStorage.getItem('vmAutoRefresh') || 'off');
  const activePreset = useMemo(() => resolveActivePreset(presets, activePresetId), [activePresetId, presets]);

  useEffect(() => {
    if (activePreset && activePreset.id !== activePresetId) {
      setActivePresetId(activePreset.id);
      localStorage.setItem('vmActivePreset', activePreset.id);
    }
  }, [activePreset, activePresetId]);

  const dashboard = useDashboardData({ isAuthenticated, activePreset, apiKey, everhourApiKey, autoRefreshInterval });
  const filters = useDashboardFilters(dashboard.data, activePreset);
  const metrics = useDashboardMetrics(
    filters.scopeIssues,
    dashboard.data?.lastUpdated,
    dashboard.data?.workflowStates || [],
    filters.deliveredIssues,
  );

  const navigateView = view => {
    if (!VALID_VIEWS.has(view)) return;
    setActiveView(view);
    localStorage.setItem('vmActiveView', view);
  };
  const authenticate = () => { sessionStorage.setItem('vmAuthed', '1'); setIsAuthenticated(true); };
  const demoLogin = () => { setActivePresetId('demo'); localStorage.setItem('vmActivePreset', 'demo'); authenticate(); };
  const signOut = () => { sessionStorage.removeItem('vmAuthed'); setIsAuthenticated(false); window.google?.accounts?.id?.disableAutoSelect?.(); };
  const selectPreset = id => { setActivePresetId(id); localStorage.setItem('vmActivePreset', id); };
  const openSettings = (addPreset = false) => { setSettingsAddPreset(addPreset); setShowSettings(true); };

  const saveSettings = ({ apiKey: nextApiKey, everhourApiKey: nextEverhourKey, presets: nextPresets }) => {
    const safePresets = nextPresets.length ? nextPresets : DEFAULT_PRESETS;
    setApiKey(nextApiKey); localStorage.setItem('vmApiKey', nextApiKey);
    setEverhourApiKey(nextEverhourKey); localStorage.setItem('vmEverhourKey', nextEverhourKey);
    setPresets(safePresets); localStorage.setItem('vmPresets', JSON.stringify(safePresets));
    const nextActive = resolveActivePreset(safePresets, activePresetId);
    if (nextActive) { setActivePresetId(nextActive.id); localStorage.setItem('vmActivePreset', nextActive.id); }
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
        <section className="error-state-v2"><AlertTriangle size={24} aria-hidden="true" /><h1>Could not open this workspace</h1><p>{dashboard.error}</p><div><button type="button" onClick={dashboard.retry}><RefreshCw size={15} /> Retry</button><button className="subtle-btn" type="button" onClick={() => openSettings(false)}><Settings size={15} /> Settings</button></div></section>
        {showSettings ? <SettingsModal apiKey={apiKey} everhourApiKey={everhourApiKey} presets={presets} onSave={saveSettings} onClose={() => setShowSettings(false)} /> : null}
      </main>
    );
  }

  const sharedMetricProps = {
    metrics,
    issues: filters.scopeIssues,
    burndownIssues: filters.cycleScopeIssues,
    selectedStatuses: filters.selectedStatuses,
    setSelectedStatuses: filters.setSelectedStatuses,
    loadingHistory: dashboard.loadingHistory,
    historyProgress: dashboard.historyProgress,
  };

  return (
    <>
      {showSettings ? <SettingsModal apiKey={apiKey} everhourApiKey={everhourApiKey} presets={presets} onSave={saveSettings} onClose={() => setShowSettings(false)} initialAdd={settingsAddPreset} /> : null}
      <ScopeDrawer open={scopeOpen} onClose={() => setScopeOpen(false)} filters={filters} onSaveDefaults={saveFilterDefaults} canSaveDefaults={Boolean(activePreset)} />
      <ProductShell
        activeView={activeView}
        onViewChange={navigateView}
        presets={presets}
        activePresetId={activePresetId}
        onSelectPreset={selectPreset}
        onAddPreset={() => openSettings(true)}
        onOpenScope={() => setScopeOpen(true)}
        activeFilterCount={filters.activeFilterCount}
        loadedIssueCount={filters.loadedIssueCount}
        scopeIssueCount={filters.scopeIssueCount}
        deliveredIssueCount={filters.deliveredIssueCount}
        deliveryWindowActive={filters.deliveryWindowActive}
        deliveryWindowLabel={filters.deliveryWindowLabel}
        isLinearWorkspace={Boolean(activePreset?.teamId && apiKey)}
        onSettings={() => openSettings(false)}
        onSignOut={signOut}
        onRefresh={dashboard.refresh}
        refreshing={dashboard.refreshing}
        autoRefreshInterval={autoRefreshInterval}
        onAutoRefreshChange={value => { setAutoRefreshInterval(value); localStorage.setItem('vmAutoRefresh', value); }}
        team={dashboard.data?.team}
        lastUpdated={dashboard.data?.lastUpdated}
      >
        {dashboard.error ? <div className="workspace-notice" role="status"><AlertTriangle size={16} /> Refresh failed. Existing data remains available.</div> : null}
        {dashboard.historyWarning ? <div className="workspace-notice" role="status"><AlertTriangle size={16} /> {dashboard.historyWarning}</div> : null}

        {activeView === 'overview' ? <OverviewPage {...sharedMetricProps} team={dashboard.data?.team} presetName={activePreset?.name} budgetData={dashboard.budgetData} budgetError={dashboard.budgetError} budgetConfigured={Boolean(activePreset?.everhourProjectIds?.length)} deliveryWindowLabel={filters.deliveryWindowLabel} onNavigate={navigateView} onOpenScope={() => setScopeOpen(true)} /> : null}
        {activeView === 'delivery' ? <MetricPage {...sharedMetricProps} eyebrow="Delivery system" title="Throughput and scope" description={`Throughput and cycle outcomes use deliveries in ${filters.deliveryWindowLabel}. Remaining scope stays visible for forecasting.`} chartIds={DELIVERY_CHARTS} /> : null}
        {activeView === 'flow' ? <MetricPage {...sharedMetricProps} eyebrow="Flow system" title="Where work slows down" description={`Current workflow inventory is independent of issue creation date. Cycle and lead-time outcomes use deliveries in ${filters.deliveryWindowLabel}.`} chartIds={FLOW_CHARTS} /> : null}
        {activeView === 'issues' ? <div className="issues-page"><section className="metric-page-intro"><span className="page-eyebrow">Work inventory</span><h2>Issues</h2><p>Search, sort and export the current project / assignee / status scope. Delivery date windows do not hide older tickets from this inventory.</p></section><section className="issues-workspace"><IssuesTable issues={filters.scopeIssues} /></section></div> : null}
      </ProductShell>
    </>
  );
}

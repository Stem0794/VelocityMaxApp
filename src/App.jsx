import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import IssuesTable from './IssuesTable';
import SettingsModal from './SettingsModal';
import MetricPage from './components/MetricPage';
import OverviewPage from './components/OverviewPage';
import ProductShell from './components/ProductShell';
import ScopeDrawer from './components/ScopeDrawer';
import { resolveActivePreset } from './dashboardState';
import useDashboardData from './hooks/useDashboardData';
import useDashboardFilters from './hooks/useDashboardFilters';
import useDashboardMetrics from './hooks/useDashboardMetrics';

const DEFAULT_PRESETS = [{ id: 'demo', name: 'Demo workspace', teamId: '', projectIds: [], projectNames: [], everhourProjectIds: [], everhourProjectNames: [] }];
const VALID_VIEWS = new Set(['overview', 'delivery', 'flow', 'issues']);
const DELIVERY_CHARTS = ['velocity', 'cycle-compare', 'burnup', 'burndown', 'prediction'];
const FLOW_CHARTS = ['cycle-times', 'lead-time', 'flow-efficiency', 'status-breakdown', 'cfd'];

function loadPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem('vmPresets') || 'null');
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PRESETS;
  } catch {
    return DEFAULT_PRESETS;
  }
}

function parseJwt(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(normalized).split('').map(char => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function LoginScreen({ onAuthenticated, onDemo }) {
  const googleButtonRef = useRef(null);
  const [googleError, setGoogleError] = useState('');

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !googleButtonRef.current) return undefined;
    let cancelled = false;
    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return false;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: response => {
          const payload = parseJwt(response.credential);
          const allowed = (import.meta.env.VITE_ALLOWED_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
          const audience = Array.isArray(payload?.aud) ? payload.aud : [payload?.aud];
          const validAudience = audience.includes(clientId);
          const validExpiry = Number(payload?.exp || 0) * 1000 > Date.now();
          const emailVerified = payload?.email_verified === true;
          const emailAllowed = !allowed.length || allowed.includes(String(payload?.email || '').toLowerCase());
          if (!validAudience || !validExpiry || !emailVerified || !emailAllowed) {
            setGoogleError('This Google account is not authorized for this dashboard.');
            return;
          }
          setGoogleError('');
          onAuthenticated();
        },
      });
      const width = Math.max(240, Math.min(360, Math.floor(googleButtonRef.current.getBoundingClientRect().width || 320)));
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', shape: 'pill', width });
      return true;
    };
    if (init()) return () => { cancelled = true; };
    const script = document.querySelector('script[data-vm-google]') || document.createElement('script');
    if (!script.dataset.vmGoogle) {
      script.dataset.vmGoogle = 'true';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', init, { once: true });
    return () => { cancelled = true; script.removeEventListener('load', init); };
  }, [onAuthenticated]);

  return (
    <main className="login-screen-v2">
      <section className="login-card-v2">
        <span className="login-mark">VM</span>
        <p className="page-eyebrow">Delivery intelligence</p>
        <h1>VelocityMAX</h1>
        <p>One place to understand throughput, flow, scope and delivery health.</p>
        <div className="login-actions-v2">
          {import.meta.env.VITE_GOOGLE_CLIENT_ID ? <div ref={googleButtonRef} className="google-login-slot" /> : null}
          {googleError ? <p className="inline-error" role="alert">{googleError}</p> : null}
          <button type="button" className="hero-primary" onClick={onDemo}>Open demo workspace</button>
        </div>
      </section>
    </main>
  );
}

function LoadingScreen({ presetName }) {
  return <main className="loading-screen-v2"><span className="loading-orb" /><p>Opening {presetName || 'workspace'}…</p></main>;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('vmAuthed') === '1');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('vmApiKey') || '');
  const [everhourApiKey, setEverhourApiKey] = useState(() => localStorage.getItem('vmEverhourKey') || '');
  const [presets, setPresets] = useState(loadPresets);
  const [activePresetId, setActivePresetId] = useState(() => localStorage.getItem('vmActivePreset') || 'demo');
  const [activeView, setActiveView] = useState(() => {
    const saved = localStorage.getItem('vmActiveView') || 'overview';
    return VALID_VIEWS.has(saved) ? saved : 'overview';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsAddPreset, setSettingsAddPreset] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ComposedChart, LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  AreaChart, Area,
} from 'recharts';
import {
  fetchTeamName, fetchIssues, fetchWorkflowStates, fetchStatusHistories,
  processIssues, computeBurnupData,
} from './linearApi';
import { fetchEverhourBudgets, fetchMonthlyHours } from './everhourApi';
import SettingsModal from './SettingsModal';
import { computeVelocityWithTrend, computeLeadTimeHistogram, computeSprintBurndown, computeCumulativeFlow, computeFlowEfficiency, computePrediction } from './computeCharts';
import IssuesTable from './IssuesTable';

const DEFAULT_PRESETS = [];

// SHA-256 hash the entered password and compare to the stored hash.
// The plaintext password is never stored anywhere — only the hash is
// embedded in the bundle via the VITE_APP_PASSWORD_HASH build secret.
async function verifyPassword(input) {
  const stored = import.meta.env.VITE_APP_PASSWORD_HASH;
  if (!stored) return null; // not configured
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === stored.toLowerCase();
}

function loadFromStorage(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function MultiSelectDropdown({ options, selected, onChange, placeholder = 'All' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allSelected = selected.length === 0;
  const label = allSelected ? placeholder : `${selected.length} of ${options.length} selected`;

  const toggleOption = (opt) =>
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);

  return (
    <div className="multiselect" ref={ref}>
      <button
        type="button"
        className={`multiselect-btn${!allSelected ? ' has-selection' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {label}
      </button>
      {open && (
        <div className="multiselect-dropdown">
          <label className="multiselect-option">
            <input type="checkbox" checked={allSelected} onChange={() => onChange([])} />
            All Statuses
          </label>
          <hr className="multiselect-divider" />
          {options.map(opt => (
            <label key={opt} className="multiselect-option">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggleOption(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function getISOWeekLabel(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getFullYear() + '-W' + (weekNo < 10 ? '0' : '') + weekNo;
}

export default function App() {
  // ─── Auth ───
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('vmAuthed') === '1'
  );
  const [authError, setAuthError] = useState('');
  const [authChecking, setAuthChecking] = useState(false);

  // ─── Settings ───
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('vmApiKey') || '');
  const [everhourApiKey, setEverhourApiKey] = useState(() => localStorage.getItem('vmEverhourKey') || '');
  const [presets, setPresets] = useState(() => loadFromStorage('vmPresets', DEFAULT_PRESETS));
  const [activePresetId, setActivePresetId] = useState(
    () => localStorage.getItem('vmActivePreset') || 'demo'
  );

  const activePreset = useMemo(
    () => presets.find(p => p.id === activePresetId) || presets[0],
    [presets, activePresetId]
  );

  // ─── Data ───
  const [data, setData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyProgress, setHistoryProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const fetchSeq = useRef(0);

  // ─── Filters ───
  const [selectedProject, setSelectedProject] = useState('All');
  const [selectedAssignee, setSelectedAssignee] = useState('All');
  // Empty array = all statuses shown; non-empty = only those statuses shown
  const [selectedCurrentStatuses, setSelectedCurrentStatuses] = useState(() => {
    try { const s = sessionStorage.getItem('vmStatusFilter'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [dateFrom, setDateFrom] = useState(() => sessionStorage.getItem('vmDateFrom') || '');
  const [dateTo, setDateTo] = useState(() => sessionStorage.getItem('vmDateTo') || '');
  const [selectedCycle, setSelectedCycle] = useState('');
  const [monthlySpendData, setMonthlySpendData] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthChecking(true);
    setAuthError('');
    // Artificial delay — slows down any brute-force attempt
    await new Promise(r => setTimeout(r, 600));
    const result = await verifyPassword(password);
    if (result === null) {
      // Not configured — allow through in dev, block in prod
      if (import.meta.env.DEV) {
        sessionStorage.setItem('vmAuthed', '1');
        setIsAuthenticated(true);
      } else {
        setAuthError('No password configured. Set VITE_APP_PASSWORD_HASH in GitHub Secrets.');
        setAuthChecking(false);
      }
      return;
    }
    if (result) {
      sessionStorage.setItem('vmAuthed', '1');
      setIsAuthenticated(true);
    } else {
      setAuthError('Incorrect password.');
      setAuthChecking(false);
    }
  };

  const loadPresetData = async (preset, key) => {
    if (!preset) return;
    const seq = ++fetchSeq.current;
    setLoading(true);
    setLoadingHistory(false);
    setError('');
    setData(null);
    setBudgetData(null);
    setMonthlySpendData(null);
    setSelectedProject('All');
    setSelectedAssignee('All');

    // Apply preset's saved default filters if they exist
    if (preset.defaultStatuses !== undefined) setSelectedCurrentStatuses(preset.defaultStatuses);
    if (preset.defaultDateFrom !== undefined) setDateFrom(preset.defaultDateFrom);
    if (preset.defaultDateTo !== undefined) setDateTo(preset.defaultDateTo);

    // Everhour budget — fire independently so it doesn't block Linear data
    if (everhourApiKey && preset.everhourProjectIds?.length > 0) {
      fetchEverhourBudgets(everhourApiKey, preset.everhourProjectIds)
        .then(rows => { if (fetchSeq.current === seq) setBudgetData(rows); })
        .catch(() => {});
    }

    // Monthly spend (Everhour)
    if (everhourApiKey && preset.everhourProjectIds?.length > 0) {
      fetchMonthlyHours(everhourApiKey, preset.everhourProjectIds, 12)
        .then(rows => { if (fetchSeq.current === seq) setMonthlySpendData(rows); })
        .catch(() => {});
    }

    if (!preset.teamId || !key) {
      try {
        const res = await fetch(import.meta.env.BASE_URL + 'data.json');
        if (!res.ok) throw new Error('Demo data not available. Has the GitHub Action run?');
        const json = await res.json();
        if (fetchSeq.current !== seq) return;
        setData(json);
      } catch (err) {
        if (fetchSeq.current === seq) setError(err.message);
      } finally {
        if (fetchSeq.current === seq) setLoading(false);
      }
      return;
    }

    try {
      const [teamName, rawIssues, workflowStates] = await Promise.all([
        preset.teamName ? Promise.resolve(preset.teamName) : fetchTeamName(key, preset.teamId),
        fetchIssues(key, preset.teamId, preset.projectIds),
        fetchWorkflowStates(key, preset.teamId),
      ]);
      if (fetchSeq.current !== seq) return;

      const processed = processIssues(rawIssues);
      setData({
        issues: processed,
        burnupData: computeBurnupData(processed),
        workflowStates,
        lastUpdated: new Date().toISOString(),
        team: teamName,
      });
      setLoading(false);

      if (!rawIssues.length) return;
      setLoadingHistory(true);
      setHistoryProgress({ done: 0, total: rawIssues.length });

      await fetchStatusHistories(key, rawIssues, (done, total) => {
        if (fetchSeq.current === seq) setHistoryProgress({ done, total });
      });

      if (fetchSeq.current !== seq) return;
      const processedWithHistory = processIssues(rawIssues);
      setData(prev => prev ? { ...prev, issues: processedWithHistory } : prev);
    } catch (err) {
      if (fetchSeq.current !== seq) return;
      setError(err.message);
      setLoading(false);
    } finally {
      if (fetchSeq.current === seq) setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && activePreset) loadPresetData(activePreset, apiKey);
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sessionStorage.setItem('vmStatusFilter', JSON.stringify(selectedCurrentStatuses));
  }, [selectedCurrentStatuses]);

  useEffect(() => {
    sessionStorage.setItem('vmDateFrom', dateFrom);
    sessionStorage.setItem('vmDateTo', dateTo);
  }, [dateFrom, dateTo]);

  const selectPreset = (presetId) => {
    setActivePresetId(presetId);
    localStorage.setItem('vmActivePreset', presetId);
    const p = presets.find(x => x.id === presetId) || presets[0];
    loadPresetData(p, apiKey);
  };

  const handleSaveSettings = ({ apiKey: newKey, everhourApiKey: newEverhourKey, presets: newPresets }) => {
    const keyChanged = newKey !== apiKey;
    setApiKey(newKey);
    localStorage.setItem('vmApiKey', newKey);
    setEverhourApiKey(newEverhourKey);
    localStorage.setItem('vmEverhourKey', newEverhourKey);
    setPresets(newPresets);
    localStorage.setItem('vmPresets', JSON.stringify(newPresets));

    const stillExists = newPresets.find(p => p.id === activePresetId);
    const targetPreset = stillExists || newPresets[0] || null;
    const targetId = targetPreset?.id ?? null;
    setActivePresetId(targetId);
    if (targetId) localStorage.setItem('vmActivePreset', targetId);

    if (targetPreset && (keyChanged || !stillExists)) {
      loadPresetData(targetPreset, newKey);
    }
  };

  const handleSaveFiltersToPreset = () => {
    if (!activePreset) return;
    const updated = presets.map(p =>
      p.id === activePresetId
        ? { ...p, defaultStatuses: selectedCurrentStatuses, defaultDateFrom: dateFrom, defaultDateTo: dateTo }
        : p
    );
    setPresets(updated);
    localStorage.setItem('vmPresets', JSON.stringify(updated));
  };

  // ─── Derived filter options ───
  const uniqueProjects = useMemo(() => {
    if (!data?.issues) return [];
    return [...new Set(data.issues.map(i => i.project).filter(Boolean))].sort();
  }, [data]);

  const uniqueAssignees = useMemo(() => {
    if (!data?.issues) return [];
    return [...new Set(data.issues.map(i => i.assignee).filter(Boolean))].sort();
  }, [data]);

  // Prefer the authoritative list fetched from Linear so deleted states
  // don't appear. Falls back to deriving from issue data (e.g. demo data.json).
  const uniqueCurrentStatuses = useMemo(() => {
    if (data?.workflowStates?.length) return data.workflowStates;
    if (!data?.issues) return [];
    return [...new Set(data.issues.map(i => i.currentStatus).filter(Boolean))].sort();
  }, [data]);

  const allStatuses = useMemo(() => {
    if (data?.workflowStates?.length) return data.workflowStates;
    if (!data?.issues) return [];
    const set = new Set();
    data.issues.forEach(i => Object.keys(i.timeByStatus || {}).forEach(s => set.add(s)));
    return [...set].sort();
  }, [data]);

  useEffect(() => {
    if (allStatuses.length > 0 && selectedStatuses.length === 0) {
      setSelectedStatuses([...allStatuses]);
    }
  }, [allStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Filtered issues ───
  const filteredIssues = useMemo(() => {
    if (!data?.issues) return [];
    return data.issues.filter(issue => {
      if (selectedProject !== 'All' && issue.project !== selectedProject) return false;
      if (selectedAssignee !== 'All' && issue.assignee !== selectedAssignee) return false;
      if (selectedCurrentStatuses.length > 0 && !selectedCurrentStatuses.includes(issue.currentStatus)) return false;
      if (dateFrom && new Date(issue.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(issue.createdAt) > new Date(dateTo + 'T23:59:59Z')) return false;
      return true;
    });
  }, [data, selectedProject, selectedAssignee, selectedCurrentStatuses, dateFrom, dateTo]);

  // ─── Chart data ───
  const velocityData = useMemo(() => computeVelocityWithTrend(filteredIssues), [filteredIssues]);

  const cycleTimeData = useMemo(() => {
    return filteredIssues
      .filter(i => i.completedAt && i.cycleTimeDays != null)
      .map(i => ({
        completed: new Date(i.completedAt).getTime(),
        dateStr: new Date(i.completedAt).toLocaleDateString(),
        cycleTime: i.cycleTimeDays,
        title: i.title,
        points: i.points || 1,
      }))
      .sort((a, b) => a.completed - b.completed);
  }, [filteredIssues]);

  const statusBreakdownData = useMemo(() => {
    const statuses = selectedStatuses.length > 0 ? selectedStatuses : allStatuses;
    return statuses.map(status => {
      const values = filteredIssues.map(i => i.timeByStatus?.[status]).filter(v => v !== undefined);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length
        ? (sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)
        : 0;
      return { status, avg: Number(avg.toFixed(1)), median: Number(median.toFixed(1)) };
    });
  }, [filteredIssues, selectedStatuses, allStatuses]);

  const burnupData = useMemo(() => {
    if (!data?.burnupData) return [];
    if (selectedProject !== 'All' || selectedAssignee !== 'All' || selectedCurrentStatuses.length > 0 || dateFrom || dateTo) {
      const sorted = [...filteredIssues].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      if (!sorted.length) return [];
      const dailyMap = {};
      sorted.forEach(issue => {
        const cd = new Date(issue.createdAt).toISOString().split('T')[0];
        if (!dailyMap[cd]) dailyMap[cd] = { created: 0, completed: 0 };
        dailyMap[cd].created += issue.points || 0;
        if (issue.completedAt) {
          const dd = new Date(issue.completedAt).toISOString().split('T')[0];
          if (!dailyMap[dd]) dailyMap[dd] = { created: 0, completed: 0 };
          dailyMap[dd].completed += issue.points || 0;
        }
      });
      let cumCreated = 0, cumCompleted = 0;
      return Object.keys(dailyMap).sort().map(d => {
        cumCreated += dailyMap[d].created;
        cumCompleted += dailyMap[d].completed;
        return { date: d, totalScope: cumCreated, cumulativeCompleted: cumCompleted };
      });
    }
    return data.burnupData;
  }, [data, filteredIssues, selectedProject, selectedAssignee, selectedCurrentStatuses, dateFrom, dateTo]);

  const leadTimeHistogram = useMemo(() => computeLeadTimeHistogram(filteredIssues), [filteredIssues]);

  const uniqueCycles = useMemo(() => {
    if (!data?.issues) return [];
    return [...new Set(data.issues.map(i => i.cycleNumber).filter(Boolean))].sort((a, b) => b - a);
  }, [data]);

  const sprintBurndownData = useMemo(
    () => computeSprintBurndown(data?.issues || [], selectedCycle),
    [data, selectedCycle]
  );

  const cumulativeFlowData = useMemo(() => computeCumulativeFlow(filteredIssues), [filteredIssues]);

  const flowEfficiency = useMemo(() => computeFlowEfficiency(filteredIssues), [filteredIssues]);

  const predictionResult = useMemo(() => computePrediction(filteredIssues, velocityData), [filteredIssues, velocityData]);

  // For monthly spend chart - flatten to recharts format
  const monthlySpendChartData = useMemo(() => {
    if (!monthlySpendData?.length || !activePreset?.everhourProjectIds?.length) return [];
    const projectIds = activePreset.everhourProjectIds;
    const projectNames = activePreset.everhourProjectNames || projectIds;
    return monthlySpendData.map(row => {
      const entry = { month: row.month };
      projectIds.forEach((id, idx) => {
        const name = projectNames[idx] || id;
        entry[name] = Math.round((row[id] || 0) * 10) / 10;
      });
      return entry;
    });
  }, [monthlySpendData, activePreset]);

  const toggleStatus = (status) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const resetFilters = () => {
    setSelectedProject('All');
    setSelectedAssignee('All');
    setSelectedCurrentStatuses([]);
    setDateFrom('');
    setDateTo('');
    setSelectedStatuses([...allStatuses]);
  };

  // ─── Login screen ───
  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="glass-card login-card">
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>VelocityMAX</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Enter your password to access the dashboard
          </p>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                disabled={authChecking}
              />
            </div>
            {authError && (
              <p style={{ color: 'var(--chart-red)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {authError}
              </p>
            )}
            <button type="submit" disabled={authChecking}>
              {authChecking ? 'Checking…' : 'Sign In'}
            </button>
          </form>
          {import.meta.env.DEV && (
            <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Dev mode — auth bypassed. Set VITE_APP_PASSWORD_HASH in .env.local to test.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="login-screen">
        <div style={{ textAlign: 'center' }}>
          <div className="loader" />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
            Loading data for <strong style={{ color: 'var(--text-primary)' }}>{activePreset?.name}</strong>…
          </p>
        </div>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="login-screen">
        <div className="glass-card" style={{ maxWidth: 480, textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>Could not load data</h2>
          <p style={{ color: 'var(--chart-red)', marginBottom: '1.5rem' }}>{error}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button style={{ width: 'auto' }} onClick={() => loadPresetData(activePreset, apiKey)}>
              Retry
            </button>
            <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => setShowSettings(true)}>
              Open Settings
            </button>
          </div>
          {showSettings && (
            <SettingsModal
              apiKey={apiKey}
              everhourApiKey={everhourApiKey}
              presets={presets}
              onSave={handleSaveSettings}
              onClose={() => setShowSettings(false)}
            />
          )}
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{label || payload[0].payload.dateStr || payload[0].payload.status}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ margin: '4px 0 0 0', color: p.color }}>{p.name}: {p.value}</p>
          ))}
          {payload[0].payload.title && (
            <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>{payload[0].payload.title}</p>
          )}
        </div>
      );
    }
    return null;
  };

  const totalIssues = filteredIssues.length;
  const completedIssues = filteredIssues.filter(i => i.completedAt).length;
  const totalPoints = filteredIssues.reduce((s, i) => s + (i.points || 0), 0);
  const avgCycleTime = cycleTimeData.length
    ? (cycleTimeData.reduce((s, i) => s + i.cycleTime, 0) / cycleTimeData.length).toFixed(1)
    : '—';

  return (
    <>
      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          everhourApiKey={everhourApiKey}
          presets={presets}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      <div className="app-container">

      {/* ─── Header ─── */}
      <div className="header">
        <div className="header-top">
          <h1>VelocityMAX Dashboard</h1>
          <button
            className="btn-icon"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙
          </button>
        </div>

        {/* Preset bar */}
        <div className="preset-bar">
          {presets.map(p => (
            <button
              key={p.id}
              className={`preset-btn${activePresetId === p.id ? ' active' : ''}`}
              onClick={() => selectPreset(p.id)}
            >
              {p.name}
            </button>
          ))}
          <button
            className="preset-btn preset-btn-add"
            onClick={() => setShowSettings(true)}
            title="Manage presets"
          >
            {presets.length === 0 ? '+ Add Preset' : '+ Preset'}
          </button>
        </div>
        {presets.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            No presets yet — open ⚙ Settings to add your first one.
          </p>
        )}

        {data && (
          <p className="header-meta">
            {data.team && <>Team: <strong>{data.team}</strong> · </>}
            Updated: {new Date(data.lastUpdated).toLocaleString()}
            {loadingHistory && (
              <span className="history-badge">
                ⟳ Loading status data ({historyProgress.done}/{historyProgress.total})
              </span>
            )}
          </p>
        )}
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="glass-card filter-bar">
        <div className="filter-bar-inner">
          <div className="filter-group">
            <label htmlFor="filter-project">Project</label>
            <select id="filter-project" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
              <option value="All">All Projects</option>
              {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-assignee">Assignee</label>
            <select id="filter-assignee" value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)}>
              <option value="All">All Assignees</option>
              {uniqueAssignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {uniqueCurrentStatuses.length > 0 && (
            <div className="filter-group">
              <label>Status</label>
              <MultiSelectDropdown
                options={uniqueCurrentStatuses}
                selected={selectedCurrentStatuses}
                onChange={setSelectedCurrentStatuses}
                placeholder="All Statuses"
              />
            </div>
          )}
          <div className="filter-group">
            <label htmlFor="filter-from">From</label>
            <input id="filter-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-to">To</label>
            <input id="filter-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="filter-group">
            <button className="btn-secondary" onClick={resetFilters}>Reset Filters</button>
          </div>
          {activePreset && (
            <div className="filter-group">
              <button className="btn-secondary" onClick={handleSaveFiltersToPreset} title="Save current filters as default for this preset">
                ★ Save Filters
              </button>
            </div>
          )}
          <div className="filter-group">
            <button
              className="btn-secondary"
              onClick={() => loadPresetData(activePreset, apiKey)}
              title="Re-fetch data from Linear"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ─── Budget Overview ─── */}
      {budgetData?.length > 0 && (
        <div className="glass-card budget-card">
          <div className="chart-title">Budget Overview</div>
          <div className="chart-description">Everhour budget consumption per project.</div>
          <table className="budget-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Consumed</th>
                <th>Budget</th>
                <th style={{ minWidth: 200 }}>% Used</th>
              </tr>
            </thead>
            <tbody>
              {budgetData.map(p => {
                const pct = p.percentUsed ?? 0;
                const barColor = pct > 90 ? 'var(--chart-red)' : pct > 75 ? '#f59e0b' : 'var(--chart-green)';
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.consumedDisplay ?? '—'}</td>
                    <td>{p.budgetDisplay ?? '—'}</td>
                    <td>
                      {p.percentUsed != null ? (
                        <div className="budget-progress-cell">
                          <div className="budget-bar">
                            <div
                              className="budget-bar-fill"
                              style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
                            />
                          </div>
                          <span className="budget-pct" style={{ color: barColor }}>{pct}%</span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── KPI Cards ─── */}
      <div className="kpi-grid">
        <div className="glass-card kpi-card">
          <div className="kpi-value">{totalIssues}</div>
          <div className="kpi-label">Total Issues</div>
        </div>
        <div className="glass-card kpi-card">
          <div className="kpi-value">{completedIssues}</div>
          <div className="kpi-label">Completed</div>
        </div>
        <div className="glass-card kpi-card">
          <div className="kpi-value">{totalPoints}</div>
          <div className="kpi-label">Total Points</div>
        </div>
        <div className="glass-card kpi-card">
          <div className="kpi-value">{avgCycleTime}</div>
          <div className="kpi-label">Avg Cycle Time (days)</div>
        </div>
      </div>

      {/* ─── Charts ─── */}
      <div className="charts-grid">

        {/* Weekly Velocity */}
        <div className="glass-card">
          <div className="chart-title">Weekly Velocity</div>
          <div className="chart-description">Points (purple bars) and Tickets (red line) completed per week.</div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={velocityData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="week" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis yAxisId="left" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar yAxisId="left" dataKey="points" name="Points Completed" fill="var(--chart-purple)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="count" name="Tickets Completed" stroke="var(--chart-red)" strokeWidth={3} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="rollingAvgCount" name="4-wk Avg (tickets)" stroke="var(--chart-green)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Issue Cycle Times */}
        <div className="glass-card">
          <div className="chart-title">Issue Cycle Times</div>
          <div className="chart-description">Days from start to completion. Red dots = over 14 days.</div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" dataKey="completed" name="Date" domain={['dataMin', 'dataMax']}
                  tickFormatter={(tick) => new Date(tick).toLocaleDateString()} stroke="var(--text-secondary)" fontSize={12} />
                <YAxis type="number" dataKey="cycleTime" name="Cycle Time" stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                <Scatter name="Issues" data={cycleTimeData} fill="var(--chart-blue)">
                  {cycleTimeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cycleTime > 14 ? 'var(--chart-red)' : 'var(--chart-blue)'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Burn-up Chart */}
        <div className="glass-card">
          <div className="chart-title">Burn-up Chart</div>
          <div className="chart-description">Cumulative scope (red) vs completed work (green).</div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={burnupData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(t) => new Date(t).toLocaleDateString()} stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="stepAfter" dataKey="totalScope" name="Total Scope" stroke="var(--chart-red)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cumulativeCompleted" name="Completed" stroke="var(--chart-green)" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="glass-card">
          <div className="chart-title">Time Spent in Each Status</div>
          <div className="chart-description">
            Average and median days in each workflow state. Click to toggle.
            {loadingHistory && (
              <span className="history-badge" style={{ marginLeft: '0.5rem' }}>
                ⟳ {historyProgress.done}/{historyProgress.total} loaded
              </span>
            )}
          </div>
          <div className="status-toggle-bar">
            {allStatuses.map(s => (
              <button
                key={s}
                className={`status-chip ${selectedStatuses.includes(s) ? 'active' : ''}`}
                onClick={() => toggleStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
          {allStatuses.length === 0 && !loadingHistory && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem 0' }}>
              Status breakdown requires history data. It loads automatically after issues are fetched.
            </p>
          )}
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart layout="vertical" data={statusBreakdownData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis dataKey="status" type="category" width={100} stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="avg" name="Avg Days" fill="var(--chart-purple)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="median" name="Median Days" fill="var(--chart-green)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sprint Burndown */}
        {uniqueCycles.length > 0 && (
          <div className="glass-card">
            <div className="chart-title">Sprint Burndown</div>
            <div className="chart-description">Remaining points (purple) vs ideal burndown (dashed) for a selected sprint cycle.</div>
            <div className="filter-group" style={{ marginBottom: '1rem' }}>
              <label>Sprint / Cycle</label>
              <select
                className="filter-group-select"
                value={selectedCycle}
                onChange={e => setSelectedCycle(e.target.value)}
                style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">— Select a cycle —</option>
                {uniqueCycles.map(c => <option key={c} value={c}>Cycle {c}</option>)}
              </select>
            </div>
            {sprintBurndownData.length > 0 ? (
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={sprintBurndownData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={t => new Date(t).toLocaleDateString()} stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="remaining" name="Remaining" stroke="var(--chart-purple)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ideal" name="Ideal" stroke="var(--text-secondary)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem 0' }}>Select a cycle above to see its burndown.</p>
            )}
          </div>
        )}

        {/* Lead Time Distribution */}
        <div className="glass-card">
          <div className="chart-title">Lead Time Distribution</div>
          <div className="chart-description">How long issues take from creation to completion, bucketed by duration.</div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={leadTimeHistogram} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Issues" fill="var(--chart-blue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Prediction Chart */}
        {predictionResult && (
          <div className="glass-card">
            <div className="chart-title">Scope Prediction</div>
            <div className="chart-description">Historical remaining scope with forecast scenarios based on recent velocity.</div>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ color: 'var(--chart-green)', fontWeight: 600 }}>Optimistic: </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{predictionResult.completionDates.optimistic}</span>
              </div>
              <div>
                <span style={{ color: 'var(--chart-purple)', fontWeight: 600 }}>Avg: </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{predictionResult.completionDates.avg}</span>
              </div>
              <div>
                <span style={{ color: 'var(--chart-red)', fontWeight: 600 }}>Pessimistic: </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{predictionResult.completionDates.pessimistic}</span>
              </div>
            </div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={predictionResult.chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={t => new Date(t).toLocaleDateString()} stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="actual" name="Actual Remaining" stroke="var(--chart-blue)" strokeWidth={2} dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="avg" name="Avg Forecast" stroke="var(--chart-purple)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="optimistic" name="Optimistic" stroke="var(--chart-green)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="pessimistic" name="Pessimistic" stroke="var(--chart-red)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Cumulative Flow Diagram */}
        <div className="glass-card">
          <div className="chart-title">Cumulative Flow Diagram</div>
          <div className="chart-description">Weekly issue counts by phase — shows flow and identifies bottlenecks.</div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={cumulativeFlowData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={t => new Date(t).toLocaleDateString()} stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="Cancelled" name="Cancelled" stackId="1" stroke="var(--chart-red)" fill="var(--chart-red)" fillOpacity={0.4} />
                <Area type="monotone" dataKey="Done" name="Done" stackId="1" stroke="var(--chart-green)" fill="var(--chart-green)" fillOpacity={0.4} />
                <Area type="monotone" dataKey="In Progress" name="In Progress" stackId="1" stroke="var(--chart-purple)" fill="var(--chart-purple)" fillOpacity={0.4} />
                <Area type="monotone" dataKey="Backlog" name="Backlog" stackId="1" stroke="var(--text-secondary)" fill="#64748b" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Flow Efficiency */}
        <div className="glass-card">
          <div className="chart-title">Flow Efficiency</div>
          <div className="chart-description">Ratio of active work time (cycle time) to total lead time. Higher is better.</div>
          {flowEfficiency ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '12px', padding: '0.5rem 1.25rem', fontSize: '1.5rem', fontWeight: 700, color: '#a5b4fc' }}>
                  {flowEfficiency.avg}%
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>avg flow efficiency</span>
              </div>
              <div className="chart-wrapper" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={flowEfficiency.distribution} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Issues" fill="var(--chart-purple)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem 0' }}>
              Not enough data. Requires issues with both cycle time and lead time.
            </p>
          )}
        </div>

      </div>

      {/* Monthly Spend (full-width, outside charts-grid) */}
      {monthlySpendChartData.length > 0 && (
        <div className="glass-card" style={{ marginTop: '2rem' }}>
          <div className="chart-title">Monthly Hours by Project</div>
          <div className="chart-description">Everhour hours logged per project per month over the last 12 months.</div>
          <div className="chart-wrapper">
            {(() => {
              const CHART_COLORS = ['var(--chart-blue)', 'var(--chart-purple)', 'var(--chart-green)', 'var(--chart-red)', '#f59e0b', '#06b6d4'];
              const projectNames = activePreset?.everhourProjectNames || activePreset?.everhourProjectIds || [];
              return (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={monthlySpendChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {projectNames.map((name, idx) => (
                      <Bar key={name} dataKey={name} name={name} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      )}

      {/* Issues Table (full-width, outside charts-grid) */}
      <div className="glass-card" style={{ marginTop: '2rem' }}>
        <div className="chart-title">Issues</div>
        <IssuesTable issues={filteredIssues} />
      </div>

    </div>
    </>
  );
}

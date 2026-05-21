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
import { fetchEverhourBudgets } from './everhourApi';
import SettingsModal from './SettingsModal';
import { computeVelocityWithTrend, computeLeadTimeHistogram, computeSprintBurndown, computeCumulativeFlow, computeFlowEfficiency, computePrediction } from './computeCharts';
import IssuesTable from './IssuesTable';

function getHealthGrade(score) {
  if (score >= 85) return { grade: 'A', label: 'Excellent', color: '#4ade80' };
  if (score >= 70) return { grade: 'B', label: 'Good', color: '#60a5fa' };
  if (score >= 55) return { grade: 'C', label: 'Fair', color: '#f59e0b' };
  if (score >= 40) return { grade: 'D', label: 'Needs Attention', color: '#f97316' };
  return { grade: 'F', label: 'At Risk', color: '#f87171' };
}

function factorColor(score) {
  if (score >= 75) return '#4ade80';
  if (score >= 50) return '#f59e0b';
  return '#f87171';
}

function factorStatus(score) {
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

const DEFAULT_PRESETS = [
  { id: 'demo', name: 'Demo', teamId: '', projectIds: [], everhourProjectIds: [] },
];

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
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(
    () => localStorage.getItem('vmAutoRefresh') || 'off'
  );

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

  useEffect(() => {
    if (autoRefreshInterval === 'off') return;
    const ms = { '5m': 300000, '15m': 900000, '30m': 1800000 }[autoRefreshInterval];
    if (!ms) return;
    const id = setInterval(() => {
      if (activePreset) loadPresetData(activePreset, apiKey);
    }, ms);
    return () => clearInterval(id);
  }, [autoRefreshInterval]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const cycleMap = {};
    data.issues.forEach(i => {
      if (!i.cycleNumber) return;
      if (!cycleMap[i.cycleNumber]) {
        cycleMap[i.cycleNumber] = { number: i.cycleNumber, startsAt: i.cycleStartsAt || '', endsAt: i.cycleEndsAt || '' };
      }
    });
    return Object.values(cycleMap).sort((a, b) => b.number - a.number);
  }, [data]);

  const currentCycleNumber = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const active = uniqueCycles.find(c => c.startsAt && c.endsAt && c.startsAt <= today && today <= c.endsAt);
    return active?.number ?? uniqueCycles[0]?.number ?? null;
  }, [uniqueCycles]);

  useEffect(() => {
    if (currentCycleNumber != null) setSelectedCycle(String(currentCycleNumber));
  }, [currentCycleNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const sprintBurndownData = useMemo(
    () => computeSprintBurndown(data?.issues || [], selectedCycle),
    [data, selectedCycle]
  );

  const cumulativeFlowData = useMemo(() => computeCumulativeFlow(filteredIssues), [filteredIssues]);

  const flowEfficiency = useMemo(() => computeFlowEfficiency(filteredIssues), [filteredIssues]);

  const predictionResult = useMemo(() => computePrediction(filteredIssues, velocityData), [filteredIssues, velocityData]);

  const healthScore = useMemo(() => {
    const factors = [];

    // Velocity trend — last 4 weeks vs prior 4 weeks
    if (velocityData.length >= 2) {
      const last4 = velocityData.slice(-4).map(w => w.points);
      const prev4 = velocityData.slice(-8, -4).map(w => w.points);
      const lastAvg = last4.reduce((s, v) => s + v, 0) / last4.length;
      const prevAvg = prev4.length ? prev4.reduce((s, v) => s + v, 0) / prev4.length : lastAvg;
      const ratio = prevAvg > 0 ? lastAvg / prevAvg : 1;
      const score = ratio >= 1.1 ? 100 : ratio >= 0.9 ? 75 : ratio >= 0.7 ? 50 : 25;
      const value = ratio >= 1.1
        ? `+${Math.round((ratio - 1) * 100)}% vs prev`
        : ratio >= 0.9 ? 'Stable'
        : `-${Math.round((1 - ratio) * 100)}% vs prev`;
      factors.push({ key: 'velocity', label: 'Velocity', value, score });
    }

    // Flow efficiency
    if (flowEfficiency) {
      const fe = flowEfficiency.avg;
      const score = fe >= 50 ? 100 : fe >= 30 ? 75 : fe >= 15 ? 50 : 25;
      factors.push({ key: 'flow', label: 'Flow Efficiency', value: `${fe}% active time`, score });
    }

    // Lead time — % of completed issues finishing in ≤7 days
    const totalLt = leadTimeHistogram.reduce((s, b) => s + b.count, 0);
    if (totalLt > 0) {
      const fast = leadTimeHistogram.slice(0, 2).reduce((s, b) => s + b.count, 0); // ≤3d + 3–7d
      const pct = Math.round(fast / totalLt * 100);
      const score = pct >= 70 ? 100 : pct >= 50 ? 75 : pct >= 30 ? 50 : 25;
      factors.push({ key: 'leadtime', label: 'Lead Time', value: `${pct}% done in ≤7d`, score });
    }

    // Completion rate
    const total = filteredIssues.length;
    const done = filteredIssues.filter(i => i.completedAt).length;
    if (total > 0) {
      const pct = Math.round(done / total * 100);
      const score = pct >= 70 ? 100 : pct >= 50 ? 75 : pct >= 30 ? 50 : 25;
      factors.push({ key: 'completion', label: 'Completion Rate', value: `${pct}% of issues`, score });
    }

    if (!factors.length) return null;
    const overall = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length);
    return { overall, factors };
  }, [velocityData, flowEfficiency, leadTimeHistogram, filteredIssues]);

  const cycleComparison = useMemo(() => {
    if (!data?.issues || uniqueCycles.length < 2) return [];
    return uniqueCycles.slice(0, 8).map(c => {
      const issues = data.issues.filter(i => String(i.cycleNumber) === String(c.number));
      const completed = issues.filter(i => i.completedAt);
      const withCT = completed.filter(i => i.cycleTimeDays != null);
      const avgCT = withCT.length
        ? Math.round(withCT.reduce((s, i) => s + i.cycleTimeDays, 0) / withCT.length * 10) / 10
        : 0;
      return {
        label: `C${c.number}${c.number === currentCycleNumber ? ' ▶' : ''}`,
        points: completed.reduce((s, i) => s + (i.points || 0), 0),
        tickets: completed.length,
        avgCycleTime: avgCT,
        completionPct: issues.length ? Math.round(completed.length / issues.length * 100) : 0,
      };
    }).reverse();
  }, [data, uniqueCycles, currentCycleNumber]);

  const applyQuickRange = (range) => {
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    if (range === '30d') {
      const f = new Date(today); f.setDate(f.getDate() - 30);
      setDateFrom(fmt(f)); setDateTo(fmt(today));
    } else if (range === '90d') {
      const f = new Date(today); f.setDate(f.getDate() - 90);
      setDateFrom(fmt(f)); setDateTo(fmt(today));
    } else if (range === 'quarter') {
      const q = Math.floor(today.getMonth() / 3);
      setDateFrom(fmt(new Date(today.getFullYear(), q * 3, 1)));
      setDateTo(fmt(today));
    } else {
      setDateFrom(''); setDateTo('');
    }
  };

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

  const exportSnapshot = () => {
    if (!healthScore) return;
    const W = 1200, H = 380;
    const canvas = document.createElement('canvas');
    canvas.width = W * 2; canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    const grade = getHealthGrade(healthScore.overall);

    const rr = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
    };

    // Background
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H);

    // Header strip
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 0, W, 50);
    ctx.fillStyle = '#a5b4fc';
    ctx.font = 'bold 17px system-ui,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('VelocityMAX', 32, 31);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '13px system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText([activePreset?.name, data?.team].filter(Boolean).join(' · '), W / 2, 31);
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString(), W - 32, 31);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(W, 50); ctx.stroke();

    const TOP = 68;

    // Score circle
    const cx = 118, cy = TOP + 86;
    ctx.strokeStyle = grade.color; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, 58, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = grade.color;
    ctx.font = 'bold 42px system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(healthScore.overall), cx, cy + 15);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px system-ui,sans-serif';
    ctx.fillText('/ 100', cx, cy + 30);
    ctx.fillStyle = grade.color;
    ctx.font = 'bold 30px system-ui,sans-serif';
    ctx.fillText(grade.grade, cx, cy + 70);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '11px system-ui,sans-serif';
    ctx.fillText(grade.label.toUpperCase(), cx, cy + 86);

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(212, TOP); ctx.lineTo(212, H - 28); ctx.stroke();

    // KPI tiles (2×2)
    const kpis = [
      { label: 'Total Issues', value: String(totalIssues) },
      { label: 'Completed', value: String(completedIssues) },
      { label: 'Story Points', value: String(totalPoints) },
      { label: 'Avg Cycle Time', value: avgCycleTime !== '—' ? `${avgCycleTime}d` : '—' },
    ];
    const kW = 188, kH = 74, kGap = 10, kX = 228;
    kpis.forEach((kpi, i) => {
      const x = kX + (i % 2) * (kW + kGap), y = TOP + Math.floor(i / 2) * (kH + kGap);
      rr(x, y, kW, kH, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(kpi.value, x + kW / 2, y + 38);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px system-ui,sans-serif';
      ctx.fillText(kpi.label.toUpperCase(), x + kW / 2, y + 58);
    });

    // Divider 2
    const d2 = kX + 2 * (kW + kGap) + 14;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(d2, TOP); ctx.lineTo(d2, H - 28); ctx.stroke();

    // Health factors
    const fX = d2 + 22, fW = W - fX - 32;
    healthScore.factors.forEach((f, i) => {
      const y = TOP + i * 56;
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '10px system-ui,sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(f.label.toUpperCase(), fX, y + 12);
      ctx.fillStyle = factorColor(f.score); ctx.font = 'bold 15px system-ui,sans-serif';
      ctx.fillText(f.value, fX, y + 30);
      rr(fX, y + 36, fW, 3, 2); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
      rr(fX, y + 36, Math.max(4, fW * f.score / 100), 3, 2);
      ctx.fillStyle = factorColor(f.score); ctx.fill();
    });

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '10px system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Generated by VelocityMAX · ' + new Date().toLocaleString(), W / 2, H - 10);

    const a = document.createElement('a');
    a.download = `velocitymax-${new Date().toISOString().split('T')[0]}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

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
        {/* Preset bar + settings button on one row */}
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
            + Preset
          </button>
          <button
            className="btn-icon"
            style={{ marginLeft: 'auto' }}
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙
          </button>
        </div>

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
            <label>Date Range</label>
            <div className="quick-range-btns">
              <button className="quick-range-btn" onClick={() => applyQuickRange('30d')}>30d</button>
              <button className="quick-range-btn" onClick={() => applyQuickRange('90d')}>90d</button>
              <button className="quick-range-btn" onClick={() => applyQuickRange('quarter')}>Quarter</button>
              <button className="quick-range-btn" onClick={() => applyQuickRange('all')}>All</button>
            </div>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-from">From</label>
            <input id="filter-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-to">To</label>
            <input id="filter-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="filter-group">
            <label htmlFor="auto-refresh">Auto-refresh</label>
            <select id="auto-refresh" value={autoRefreshInterval} onChange={e => {
              setAutoRefreshInterval(e.target.value);
              localStorage.setItem('vmAutoRefresh', e.target.value);
            }}>
              <option value="off">Off</option>
              <option value="5m">5 min</option>
              <option value="15m">15 min</option>
              <option value="30m">30 min</option>
            </select>
          </div>
          <div className="filter-group">
            <button className="btn-secondary" onClick={resetFilters}>Reset</button>
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

      {/* ─── Health Score ─── */}
      {healthScore && (() => {
        const grade = getHealthGrade(healthScore.overall);
        return (
          <div className="glass-card health-card">
            <button
              className="health-export-btn"
              onClick={exportSnapshot}
              title="Export as PNG"
            >
              ↓ PNG
            </button>
            <div className="health-score-section">
              <div className="health-score-circle" style={{ borderColor: grade.color }}>
                <span className="health-score-number" style={{ color: grade.color }}>{healthScore.overall}</span>
                <span className="health-score-sub">/ 100</span>
              </div>
              <div>
                <div className="health-grade" style={{ color: grade.color }}>{grade.grade}</div>
                <div className="health-grade-label">{grade.label}</div>
              </div>
            </div>
            <div className="health-divider" />
            <div className="health-factors">
              {healthScore.factors.map(f => (
                <div key={f.key} className="health-factor">
                  <div className="health-factor-label">{f.label}</div>
                  <div className="health-factor-value" style={{ color: factorColor(f.score) }}>{f.value}</div>
                  <div className="health-factor-bar">
                    <div style={{ width: `${f.score}%`, background: factorColor(f.score) }} />
                  </div>
                  <div className="health-factor-status" style={{ color: factorColor(f.score) }}>{factorStatus(f.score)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ─── Charts ─── */}
      <div className="charts-grid">

        {/* Weekly Velocity */}
        <div className="glass-card">
          <div className="chart-title">Weekly Velocity</div>
          <div className="chart-description">
            Points delivered (purple bars) and ticket count (red line) per ISO week.
            The dashed green line is a 4-week rolling average — a rising trend means the team is accelerating.
            <em> e.g. a bar at 20 pts with 5 tickets = 5 issues completed worth 20 story points that week.</em>
          </div>
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

        {/* Cycle-over-cycle comparison */}
        {cycleComparison.length >= 2 && (
          <div className="glass-card">
            <div className="chart-title">Cycle Comparison</div>
            <div className="chart-description">
              Last {cycleComparison.length} cycles side by side — points delivered (bars, left axis) and completion rate % (line, right axis).
              <em> ▶ marks the current active cycle.</em>
            </div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={cycleComparison} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis yAxisId="left" stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="var(--text-secondary)" fontSize={12} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="points" name="Points" fill="var(--chart-purple)" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="tickets" name="Tickets" fill="var(--chart-blue)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="completionPct" name="Completion %" stroke="var(--chart-green)" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Issue Cycle Times */}
        <div className="glass-card">
          <div className="chart-title">Issue Cycle Times</div>
          <div className="chart-description">
            Each dot is one completed issue — horizontal axis is completion date, vertical axis is days in progress.
            Red dots spent more than 14 days in progress and may warrant a retro discussion.
            <em> e.g. a blue dot at 5d on Jan 10 = an issue completed Jan 10 that took 5 days to finish.</em>
          </div>
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
          <div className="chart-description">
            Tracks total scope (red) and cumulative completed work (green) over the project's life.
            When the green line meets the red line, all committed scope is done.
            <em> e.g. red at 100 pts and green at 70 pts = 30 pts still remaining.</em>
          </div>
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

        {/* Sprint Burndown */}
        {uniqueCycles.length > 0 && (
          <div className="glass-card">
            <div className="chart-title">Sprint Burndown</div>
            <div className="chart-description">
              Remaining story points (purple) vs the ideal straight-line burndown (dashed) for a given sprint.
              Dropping faster than ideal = ahead of schedule; a flat line = blocked work.
              <em> e.g. remaining at 15 pts on day 5 of a 10-day sprint with 30 pts total = behind the ideal pace of 15 pts remaining.</em>
            </div>
            <div className="filter-group" style={{ marginBottom: '1rem' }}>
              <label>Sprint / Cycle</label>
              <select
                value={selectedCycle}
                onChange={e => setSelectedCycle(e.target.value)}
                style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">— Select a cycle —</option>
                {uniqueCycles.map(c => {
                  const isCurrent = c.number === currentCycleNumber;
                  const dateRange = c.startsAt && c.endsAt
                    ? ` · ${new Date(c.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(c.endsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                    : '';
                  return (
                    <option key={c.number} value={c.number}>
                      {isCurrent ? '▶ ' : ''}Cycle {c.number}{isCurrent ? ' (current)' : ''}{dateRange}
                    </option>
                  );
                })}
              </select>
            </div>
            {sprintBurndownData.length > 0 ? (
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
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
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem 0' }}>No point data for this cycle.</p>
            )}
          </div>
        )}

        {/* Lead Time Distribution */}
        <div className="glass-card">
          <div className="chart-title">Lead Time Distribution</div>
          <div className="chart-description">
            Time from issue creation to completion, grouped into buckets.
            A tall bar on the left = most issues are delivered quickly; a tail on the right = some issues linger.
            <em> e.g. a tall "3–7d" bar means the majority of issues are shipped within a week of being opened.</em>
          </div>
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

        {/* Flow Efficiency */}
        <div className="glass-card">
          <div className="chart-title">Flow Efficiency</div>
          <div className="chart-description">
            Ratio of active work time (cycle time) to total elapsed time (lead time).
            Higher = less waiting. World-class teams typically reach 40–60%.
            <em> e.g. 30% means only 30% of an issue's lifetime was active development — 70% was idle/waiting.</em>
          </div>
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

        {/* Status Breakdown */}
        <div className="glass-card">
          <div className="chart-title">Time Spent in Each Status</div>
          <div className="chart-description">
            Average and median days issues spend in each workflow state. Click chips to show/hide states.
            Large gaps between avg and median suggest a few outliers are skewing the average.
            <em> e.g. "In Review" avg=4d, median=1d means most reviews are fast but a few linger and pull the average up.</em>
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

      </div>

      {/* Cumulative Flow Diagram (full-width) */}
      <div className="glass-card" style={{ marginTop: '2rem' }}>
        <div className="chart-title">Cumulative Flow Diagram</div>
        <div className="chart-description">
          Weekly snapshot of how many issues sit in each phase. A healthy team shows a steady rise in Done and a stable In Progress band.
          A widening "In Progress" band signals work piling up faster than it exits — a bottleneck.
          <em> e.g. In Progress growing from 5 to 20 over 4 weeks while Done barely moves = WIP overload.</em>
        </div>
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

      {/* Scope Prediction (full-width, conditional) */}
      {predictionResult && (
        <div className="glass-card" style={{ marginTop: '2rem' }}>
          <div className="chart-title">Scope Prediction</div>
          <div className="chart-description">
            The blue line shows actual remaining points to date. Dashed lines project when the backlog reaches zero based on the last 4 weeks of velocity.
            The three scenarios use the best week (optimistic), average, and worst week (pessimistic) from that window.
            <em> e.g. if pessimistic shows June and optimistic shows March, plan around April–May.</em>
          </div>
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
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{predictionResult.remaining} pts remaining</span>
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

      {/* Issues Table (full-width, outside charts-grid) */}
      <div className="glass-card" style={{ marginTop: '2rem' }}>
        <div className="chart-title">Issues</div>
        <IssuesTable issues={filteredIssues} />
      </div>

    </div>
    </>
  );
}

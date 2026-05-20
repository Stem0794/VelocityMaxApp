import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

function getISOWeekLabel(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getFullYear() + '-W' + (weekNo < 10 ? '0' : '') + weekNo;
}

export default function App() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── Filters ───
  const [selectedProject, setSelectedProject] = useState('All');
  const [selectedAssignee, setSelectedAssignee] = useState('All');
  const [selectedCurrentStatus, setSelectedCurrentStatus] = useState('All');
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'velocity') {
      setIsAuthenticated(true);
      fetchData();
    } else {
      setError('Incorrect password');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(import.meta.env.BASE_URL + 'data.json');
      if (!res.ok) throw new Error('Data not available');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError('Could not load dashboard data. Has the GitHub Action run?');
    } finally {
      setLoading(false);
    }
  };

  // ─── Derived unique values for filter dropdowns ───
  const uniqueProjects = useMemo(() => {
    if (!data?.issues) return [];
    return [...new Set(data.issues.map(i => i.project).filter(Boolean))].sort();
  }, [data]);

  const uniqueAssignees = useMemo(() => {
    if (!data?.issues) return [];
    return [...new Set(data.issues.map(i => i.assignee).filter(Boolean))].sort();
  }, [data]);

  const uniqueCurrentStatuses = useMemo(() => {
    if (!data?.issues) return [];
    return [...new Set(data.issues.map(i => i.currentStatus).filter(Boolean))].sort();
  }, [data]);

  const allStatuses = useMemo(() => {
    if (!data?.issues) return [];
    const set = new Set();
    data.issues.forEach(i => Object.keys(i.timeByStatus || {}).forEach(s => set.add(s)));
    return [...set].sort();
  }, [data]);

  // Initialize selectedStatuses when data loads
  useEffect(() => {
    if (allStatuses.length > 0 && selectedStatuses.length === 0) {
      setSelectedStatuses([...allStatuses]);
    }
  }, [allStatuses]);

  // ─── Filtered issues ───
  const filteredIssues = useMemo(() => {
    if (!data?.issues) return [];
    return data.issues.filter(issue => {
      if (selectedProject !== 'All' && issue.project !== selectedProject) return false;
      if (selectedAssignee !== 'All' && issue.assignee !== selectedAssignee) return false;
      if (selectedCurrentStatus !== 'All' && issue.currentStatus !== selectedCurrentStatus) return false;
      if (dateFrom) {
        const created = new Date(issue.createdAt);
        if (created < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const created = new Date(issue.createdAt);
        if (created > new Date(dateTo + 'T23:59:59Z')) return false;
      }
      return true;
    });
  }, [data, selectedProject, selectedAssignee, selectedCurrentStatus, dateFrom, dateTo]);

  // ─── Chart data from filtered issues ───
  const velocityData = useMemo(() => {
    const completed = filteredIssues.filter(i => i.completedAt);
    const weekMap = {};
    completed.forEach(p => {
      const week = getISOWeekLabel(p.completedAt);
      if (!weekMap[week]) weekMap[week] = { week, points: 0, count: 0 };
      weekMap[week].points += p.points || 0;
      weekMap[week].count += 1;
    });
    return Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week));
  }, [filteredIssues]);

  const cycleTimeData = useMemo(() => {
    return filteredIssues
      .filter(i => i.completedAt && i.cycleTimeDays != null)
      .map(i => ({
        completed: new Date(i.completedAt).getTime(),
        dateStr: new Date(i.completedAt).toLocaleDateString(),
        cycleTime: i.cycleTimeDays,
        title: i.title,
        points: i.points || 1
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
      const median = sorted.length ? (sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : 0;
      return {
        status,
        avg: Number(avg.toFixed(1)),
        median: Number(median.toFixed(1))
      };
    });
  }, [filteredIssues, selectedStatuses, allStatuses]);

  const burnupData = useMemo(() => {
    if (!data?.burnupData) return [];
    // For burnup, if we have project/assignee filters, recompute from filtered issues
    if (selectedProject !== 'All' || selectedAssignee !== 'All' || dateFrom || dateTo) {
      const sorted = [...filteredIssues].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      if (sorted.length === 0) return [];
      const dailyMap = {};
      sorted.forEach(issue => {
        const cDateStr = new Date(issue.createdAt).toISOString().split('T')[0];
        if (!dailyMap[cDateStr]) dailyMap[cDateStr] = { created: 0, completed: 0 };
        dailyMap[cDateStr].created += issue.points || 0;
        if (issue.completedAt) {
          const dDateStr = new Date(issue.completedAt).toISOString().split('T')[0];
          if (!dailyMap[dDateStr]) dailyMap[dDateStr] = { created: 0, completed: 0 };
          dailyMap[dDateStr].completed += issue.points || 0;
        }
      });
      const dates = Object.keys(dailyMap).sort();
      let cumCreated = 0, cumCompleted = 0;
      return dates.map(d => {
        cumCreated += dailyMap[d].created;
        cumCompleted += dailyMap[d].completed;
        return { date: d, totalScope: cumCreated, cumulativeCompleted: cumCompleted };
      });
    }
    return data.burnupData;
  }, [data, filteredIssues, selectedProject, selectedAssignee, dateFrom, dateTo]);

  const toggleStatus = (status) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  // ─── Login ───
  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="glass-card login-card">
          <h2>VelocityMAX Login</h2>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && <p style={{ color: 'var(--chart-red)', marginBottom: '1rem' }}>{error}</p>}
            <button type="submit">Access Dashboard</button>
          </form>
          <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Hint: password is "velocity"
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="login-screen">
        <div>
          <div className="loader"></div>
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading Linear Data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="login-screen">
        <div className="glass-card">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{label || payload[0].payload.dateStr || payload[0].payload.status}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ margin: '4px 0 0 0', color: p.color }}>
              {p.name}: {p.value}
            </p>
          ))}
          {payload[0].payload.title && <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>{payload[0].payload.title}</p>}
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
    <div className="app-container">
      <div className="header">
        <h1>VelocityMAX Dashboard</h1>
        <p>Team: {data.team} | Updated: {new Date(data.lastUpdated).toLocaleString()}</p>
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
          <div className="filter-group">
            <label htmlFor="filter-status">Status</label>
            <select id="filter-status" value={selectedCurrentStatus} onChange={e => setSelectedCurrentStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              {uniqueCurrentStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
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
            <button className="btn-secondary" onClick={() => { setSelectedProject('All'); setSelectedAssignee('All'); setSelectedCurrentStatus('All'); setDateFrom(''); setDateTo(''); setSelectedStatuses([...allStatuses]); }}>
              Reset Filters
            </button>
          </div>
        </div>
      </div>

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
          <div className="chart-description">Average and median days spent in workflow states. Click statuses to toggle.</div>
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
    </div>
  );
}

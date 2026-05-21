import React, { useState, useMemo } from 'react';

function escapeCSVCell(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function formatDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

const COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Title' },
  { key: 'project', label: 'Project' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'currentStatus', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'points', label: 'Points' },
  { key: 'cycleNumber', label: 'Cycle' },
  { key: 'createdAt', label: 'Created' },
  { key: 'completedAt', label: 'Completed' },
  { key: 'cycleTimeDays', label: 'Cycle Time (d)' },
  { key: 'leadTimeDays', label: 'Lead Time (d)' },
];

const DATE_KEYS = new Set(['createdAt', 'completedAt']);
const PAGE_SIZE = 50;

export default function IssuesTable({ issues }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter(i =>
      [i.id, i.title, i.project, i.assignee, i.currentStatus]
        .some(v => v && String(v).toLowerCase().includes(q))
    );
  }, [issues, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va = a[sortKey] ?? '';
      let vb = b[sortKey] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      va = String(va);
      vb = String(vb);
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(from, from + PAGE_SIZE);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleExportCSV = () => {
    const header = COLUMNS.map(c => escapeCSVCell(c.label)).join(',');
    const rows = sorted.map(issue =>
      COLUMNS.map(c => {
        const val = issue[c.key];
        if (DATE_KEYS.has(c.key)) return escapeCSVCell(formatDate(val));
        return escapeCSVCell(val ?? '');
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'issues.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortIndicator = (key) => {
    if (key !== sortKey) return null;
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="issues-table-wrap">
      <div className="issues-table-toolbar">
        <input
          className="issues-table-search"
          type="text"
          placeholder="Search by ID, title, project, assignee, status…"
          value={search}
          onChange={handleSearchChange}
        />
        <button className="btn-secondary" style={{ width: 'auto' }} onClick={handleExportCSV}>
          Export CSV
        </button>
      </div>

      <table className="issues-table">
        <thead>
          <tr>
            {COLUMNS.map(c => (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                title={`Sort by ${c.label}`}
              >
                {c.label}{sortIndicator(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageItems.map(issue => (
            <tr key={issue.id}>
              <td>{issue.id}</td>
              <td>{issue.title}</td>
              <td>{issue.project}</td>
              <td>{issue.assignee}</td>
              <td>{issue.currentStatus}</td>
              <td>{issue.priority}</td>
              <td>{issue.points}</td>
              <td>{issue.cycleNumber}</td>
              <td>{formatDate(issue.createdAt)}</td>
              <td>{formatDate(issue.completedAt)}</td>
              <td>{issue.cycleTimeDays ?? ''}</td>
              <td>{issue.leadTimeDays ?? ''}</td>
            </tr>
          ))}
          {pageItems.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem' }}>
                No issues match your search.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="issues-table-pagination">
        <button
          className="btn-secondary"
          style={{ width: 'auto', padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={safePage <= 1}
        >
          Previous
        </button>
        <span>
          {sorted.length === 0
            ? '0–0 of 0'
            : `${from + 1}–${Math.min(from + PAGE_SIZE, sorted.length)} of ${sorted.length}`}
        </span>
        <button
          className="btn-secondary"
          style={{ width: 'auto', padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={safePage >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

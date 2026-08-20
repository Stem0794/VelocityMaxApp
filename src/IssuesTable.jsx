import { ArrowDown, ArrowUp, Download, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { downloadCSV } from './utils/csv';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatISODate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

const COLUMNS = [
  { key: 'id', label: 'ID' }, { key: 'title', label: 'Title' }, { key: 'project', label: 'Project' },
  { key: 'assignee', label: 'Assignee' }, { key: 'currentStatus', label: 'Status' }, { key: 'priority', label: 'Priority' },
  { key: 'points', label: 'Points' }, { key: 'cycleNumber', label: 'Cycle' },
  { key: 'createdAt', label: 'Created', format: formatDate, exportFormat: formatISODate },
  { key: 'completedAt', label: 'Delivered', format: formatDate, exportFormat: formatISODate },
  { key: 'linearCompletedAt', label: 'Linear completed', format: formatDate, exportFormat: formatISODate },
  { key: 'cycleTimeDays', label: 'Cycle Time (d)' }, { key: 'leadTimeDays', label: 'Lead Time (d)' },
];
const PAGE_SIZE = 50;

export default function IssuesTable({ issues }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return issues;
    return issues.filter(issue => [issue.id, issue.title, issue.project, issue.assignee, issue.currentStatus]
      .some(value => value && String(value).toLowerCase().includes(query)));
  }, [issues, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    if (typeof left === 'number' && typeof right === 'number') return sortDir === 'asc' ? left - right : right - left;
    const result = String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true });
    return sortDir === 'asc' ? result : -result;
  }), [filtered, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(start, start + PAGE_SIZE);

  const sort = key => {
    if (key === sortKey) setSortDir(direction => direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  return (
    <div className="issues-table-shell">
      <div className="issues-toolbar-v2">
        <div className="issues-search-wrap">
          <Search size={15} aria-hidden="true" />
          <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search issues" aria-label="Search issues" />
        </div>
        <span className="result-count">{sorted.length} result{sorted.length === 1 ? '' : 's'}</span>
        <button className="subtle-btn" type="button" onClick={() => downloadCSV('issues.csv', COLUMNS, sorted)} disabled={!sorted.length}>
          <Download size={14} aria-hidden="true" /> Export CSV
        </button>
      </div>
      <div className="issues-table-scroll">
        <table className="issues-table-v2">
          <thead>
            <tr>
              {COLUMNS.map((column, index) => (
                <th key={column.key} className={index < 2 ? `sticky-col sticky-col-${index}` : ''} aria-sort={sortKey === column.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => sort(column.key)}>
                    {column.label}
                    {sortKey === column.key ? <span className="sort-icon" aria-hidden="true">{sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.map(issue => (
              <tr key={issue.id}>
                {COLUMNS.map((column, index) => (
                  <td key={column.key} className={index < 2 ? `sticky-col sticky-col-${index}` : ''} title={String(issue[column.key] ?? '')}>
                    {column.format ? column.format(issue[column.key], issue) : issue[column.key] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
            {!pageItems.length ? (
              <tr><td colSpan={COLUMNS.length} className="table-empty">{search ? 'No issues match this search.' : 'No issues in the current scope.'}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="issues-pagination-v2">
        <span>{sorted.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, sorted.length)} of ${sorted.length}` : '0 results'}</span>
        <div>
          <button className="subtle-btn" type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={safePage <= 1}>Previous</button>
          <button className="subtle-btn" type="button" onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages}>Next</button>
        </div>
      </div>
    </div>
  );
}

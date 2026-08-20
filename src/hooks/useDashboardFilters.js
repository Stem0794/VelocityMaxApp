import { useEffect, useMemo, useState } from 'react';
import { detectQuickRange, getQuickRangeDates, isValidDateRange } from '../utils/date';
import { reconcileStatuses } from '../dashboardState';

function loadArray(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || '[]'); } catch { return []; }
}

export default function useDashboardFilters(data, activePreset) {
  const [selectedProject, setSelectedProject] = useState('All');
  const [selectedAssignee, setSelectedAssignee] = useState('All');
  const [selectedCurrentStatuses, setSelectedCurrentStatuses] = useState(() => loadArray('vmStatusFilter'));
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [dateFrom, setDateFrom] = useState(() => sessionStorage.getItem('vmDateFrom') || '');
  const [dateTo, setDateTo] = useState(() => sessionStorage.getItem('vmDateTo') || '');

  const uniqueProjects = useMemo(() => [...new Set((data?.issues || []).map(issue => issue.project).filter(Boolean))].sort(), [data]);
  const uniqueAssignees = useMemo(() => [...new Set((data?.issues || []).map(issue => issue.assignee).filter(Boolean))].sort(), [data]);
  const uniqueCurrentStatuses = useMemo(() => {
    if (data?.workflowStates?.length) return [...data.workflowStates];
    return [...new Set((data?.issues || []).map(issue => issue.currentStatus).filter(Boolean))].sort();
  }, [data]);
  const allStatuses = useMemo(() => {
    if (data?.workflowStates?.length) return [...data.workflowStates];
    const statuses = new Set();
    (data?.issues || []).forEach(issue => Object.keys(issue.timeByStatus || {}).forEach(status => statuses.add(status)));
    return [...statuses].sort();
  }, [data]);

  useEffect(() => setSelectedStatuses(previous => reconcileStatuses(previous, allStatuses)), [allStatuses]);

  useEffect(() => {
    if (!activePreset) return;
    setSelectedProject('All');
    setSelectedAssignee('All');
    setSelectedCurrentStatuses(activePreset.defaultStatuses || []);
    setDateFrom(activePreset.defaultDateFrom || '');
    setDateTo(activePreset.defaultDateTo || '');
  }, [activePreset]);

  useEffect(() => sessionStorage.setItem('vmStatusFilter', JSON.stringify(selectedCurrentStatuses)), [selectedCurrentStatuses]);
  useEffect(() => {
    sessionStorage.setItem('vmDateFrom', dateFrom);
    sessionStorage.setItem('vmDateTo', dateTo);
  }, [dateFrom, dateTo]);

  const rangeError = isValidDateRange(dateFrom, dateTo) ? '' : 'Start date must be before or equal to end date.';
  const filteredIssues = useMemo(() => (data?.issues || []).filter(issue => {
    if (selectedProject !== 'All' && issue.project !== selectedProject) return false;
    if (selectedAssignee !== 'All' && issue.assignee !== selectedAssignee) return false;
    if (selectedCurrentStatuses.length && !selectedCurrentStatuses.includes(issue.currentStatus)) return false;
    if (!rangeError && dateFrom && new Date(issue.createdAt) < new Date(`${dateFrom}T00:00:00`)) return false;
    if (!rangeError && dateTo && new Date(issue.createdAt) > new Date(`${dateTo}T23:59:59.999`)) return false;
    return true;
  }), [data, dateFrom, dateTo, rangeError, selectedAssignee, selectedCurrentStatuses, selectedProject]);

  const activeFilterCount = [
    selectedProject !== 'All', selectedAssignee !== 'All', selectedCurrentStatuses.length > 0, Boolean(dateFrom || dateTo),
  ].filter(Boolean).length;
  const quickRange = detectQuickRange(dateFrom, dateTo);

  const applyQuickRange = range => {
    const dates = getQuickRangeDates(range);
    setDateFrom(dates.from);
    setDateTo(dates.to);
  };

  const reset = () => {
    setSelectedProject('All');
    setSelectedAssignee('All');
    setSelectedCurrentStatuses([]);
    setDateFrom('');
    setDateTo('');
    setSelectedStatuses([...allStatuses]);
  };

  return {
    selectedProject, setSelectedProject, selectedAssignee, setSelectedAssignee,
    selectedCurrentStatuses, setSelectedCurrentStatuses, selectedStatuses, setSelectedStatuses,
    dateFrom, setDateFrom, dateTo, setDateTo, uniqueProjects, uniqueAssignees,
    uniqueCurrentStatuses, allStatuses, filteredIssues, rangeError, activeFilterCount,
    quickRange, applyQuickRange, reset,
    savedDefaults: { defaultStatuses: selectedCurrentStatuses, defaultDateFrom: dateFrom, defaultDateTo: dateTo },
  };
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { detectQuickRange, getQuickRangeDates, isValidDateRange } from '../utils/date';
import { filterDeliveredWindow, filterInventoryScope, reconcileStatuses } from '../dashboardState';

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
  const previousPresetId = useRef(null);

  const loadedIssues = useMemo(() => data?.issues || [], [data?.issues]);
  const workflowStates = useMemo(() => data?.workflowStates || [], [data?.workflowStates]);
  const uniqueProjects = useMemo(() => [...new Set(loadedIssues.map(issue => issue.project).filter(Boolean))].sort(), [loadedIssues]);
  const uniqueAssignees = useMemo(() => [...new Set(loadedIssues.map(issue => issue.assignee).filter(Boolean))].sort(), [loadedIssues]);
  const uniqueCurrentStatuses = useMemo(() => {
    if (workflowStates.length) return [...workflowStates];
    return [...new Set(loadedIssues.map(issue => issue.currentStatus).filter(Boolean))].sort();
  }, [loadedIssues, workflowStates]);
  const allStatuses = useMemo(() => {
    if (workflowStates.length) return [...workflowStates];
    const statuses = new Set();
    loadedIssues.forEach(issue => Object.keys(issue.timeByStatus || {}).forEach(status => statuses.add(status)));
    return [...statuses].sort();
  }, [loadedIssues, workflowStates]);

  useEffect(() => setSelectedStatuses(previous => reconcileStatuses(previous, allStatuses)), [allStatuses]);

  useEffect(() => {
    if (!activePreset) return;
    const hadPreset = previousPresetId.current !== null;
    const switchedPreset = hadPreset && previousPresetId.current !== activePreset.id;
    previousPresetId.current = activePreset.id;

    setSelectedProject('All');
    setSelectedAssignee('All');
    if (switchedPreset || activePreset.defaultStatuses !== undefined) {
      setSelectedCurrentStatuses(activePreset.defaultStatuses || []);
    }
    if (switchedPreset || activePreset.defaultDateFrom !== undefined) {
      setDateFrom(activePreset.defaultDateFrom || '');
    }
    if (switchedPreset || activePreset.defaultDateTo !== undefined) {
      setDateTo(activePreset.defaultDateTo || '');
    }
  }, [activePreset]);

  useEffect(() => {
    if (!uniqueCurrentStatuses.length) return;
    setSelectedCurrentStatuses(previous => previous.filter(status => uniqueCurrentStatuses.includes(status)));
  }, [uniqueCurrentStatuses]);

  useEffect(() => sessionStorage.setItem('vmStatusFilter', JSON.stringify(selectedCurrentStatuses)), [selectedCurrentStatuses]);
  useEffect(() => {
    sessionStorage.setItem('vmDateFrom', dateFrom);
    sessionStorage.setItem('vmDateTo', dateTo);
  }, [dateFrom, dateTo]);

  const rangeError = isValidDateRange(dateFrom, dateTo) ? '' : 'Start date must be before or equal to end date.';
  const scopeIssues = useMemo(() => filterInventoryScope(loadedIssues, {
    selectedProject, selectedAssignee, selectedCurrentStatuses,
  }), [loadedIssues, selectedAssignee, selectedCurrentStatuses, selectedProject]);
  const deliveredIssues = useMemo(() => filterDeliveredWindow(scopeIssues, dateFrom, dateTo, !rangeError), [dateFrom, dateTo, rangeError, scopeIssues]);

  const activeFilterCount = [
    selectedProject !== 'All', selectedAssignee !== 'All', selectedCurrentStatuses.length > 0, Boolean(dateFrom || dateTo),
  ].filter(Boolean).length;
  const quickRange = detectQuickRange(dateFrom, dateTo);
  const deliveryWindowActive = Boolean(dateFrom || dateTo);
  const deliveryWindowLabel = quickRange === 'all' || !deliveryWindowActive
    ? 'All time'
    : quickRange === '30d' ? 'Last 30 days'
      : quickRange === '90d' ? 'Last 90 days'
        : quickRange === 'quarter' ? 'This quarter'
          : [dateFrom, dateTo].filter(Boolean).join(' → ');

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
    uniqueCurrentStatuses, allStatuses, scopeIssues, deliveredIssues, filteredIssues: scopeIssues,
    loadedIssueCount: loadedIssues.length, scopeIssueCount: scopeIssues.length, deliveredIssueCount: deliveredIssues.length,
    rangeError, activeFilterCount, deliveryWindowActive, deliveryWindowLabel,
    quickRange, applyQuickRange, reset,
    savedDefaults: { defaultStatuses: selectedCurrentStatuses, defaultDateFrom: dateFrom, defaultDateTo: dateTo },
  };
}

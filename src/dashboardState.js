export const DEFAULT_CHART_ORDER = [
  'velocity', 'cycle-compare', 'cycle-times', 'burnup', 'burndown', 'lead-time',
  'flow-efficiency', 'status-breakdown', 'cfd', 'prediction', 'issues',
];

export function resolveActivePreset(presets, activePresetId) {
  return presets.find(preset => preset.id === activePresetId) || presets[0] || null;
}

export function normalizeChartOrder(savedOrder) {
  const valid = Array.isArray(savedOrder)
    ? savedOrder.filter((id, index, list) => DEFAULT_CHART_ORDER.includes(id) && list.indexOf(id) === index)
    : [];
  return [...valid, ...DEFAULT_CHART_ORDER.filter(id => !valid.includes(id))];
}

export function reconcileStatuses(selected, available) {
  if (!available.length) return [];
  if (!selected.length) return [...available];
  const next = selected.filter(status => available.includes(status));
  return next.length ? next : [...available];
}

function timestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

export function filterInventoryScope(issues, {
  selectedProject = 'All', selectedAssignee = 'All', selectedCurrentStatuses = [],
} = {}) {
  return (issues || []).filter(issue => {
    if (selectedProject !== 'All' && issue.project !== selectedProject) return false;
    if (selectedAssignee !== 'All' && issue.assignee !== selectedAssignee) return false;
    if (selectedCurrentStatuses.length && !selectedCurrentStatuses.includes(issue.currentStatus)) return false;
    return true;
  });
}

export function filterDeliveredWindow(issues, dateFrom = '', dateTo = '', rangeValid = true) {
  if (!rangeValid) return (issues || []).filter(issue => timestamp(issue.deliveredAt || issue.completedAt) != null);
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
  return (issues || []).filter(issue => {
    const delivered = timestamp(issue.deliveredAt || issue.completedAt);
    if (delivered == null) return false;
    if (from != null && delivered < from) return false;
    if (to != null && delivered > to) return false;
    return true;
  });
}

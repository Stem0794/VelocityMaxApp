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

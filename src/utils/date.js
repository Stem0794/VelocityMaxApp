export function toLocalDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getQuickRangeDates(range, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'all') return { from: '', to: '' };
  const from = new Date(today);
  if (range === '30d') from.setDate(from.getDate() - 30);
  else if (range === '90d') from.setDate(from.getDate() - 90);
  else if (range === 'quarter') from.setTime(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1).getTime());
  else return { from: '', to: '' };
  return { from: toLocalDateInput(from), to: toLocalDateInput(today) };
}

export function detectQuickRange(dateFrom, dateTo, now = new Date()) {
  const ranges = ['30d', '90d', 'quarter', 'all'];
  return ranges.find(range => {
    const expected = getQuickRangeDates(range, now);
    return expected.from === dateFrom && expected.to === dateTo;
  }) || '';
}

export function isValidDateRange(dateFrom, dateTo) {
  return !dateFrom || !dateTo || dateFrom <= dateTo;
}

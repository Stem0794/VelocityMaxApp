export function neutralizeSpreadsheetFormula(value) {
  if (value == null) return '';
  if (typeof value !== 'string') return String(value);
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function escapeCSVCell(value) {
  const text = neutralizeSpreadsheetFormula(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function downloadCSV(filename, columns, rows) {
  const header = columns.map(column => escapeCSVCell(column.label)).join(',');
  const body = rows.map(row => columns.map(column => escapeCSVCell(
    column.exportFormat ? column.exportFormat(row[column.key], row)
      : column.format ? column.format(row[column.key], row)
        : row[column.key] ?? ''
  )).join(','));
  const csv = `\uFEFF${[header, ...body].join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

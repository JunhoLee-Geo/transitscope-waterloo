/** RFC 4180 escaping plus spreadsheet-formula protection for untrusted text. */
export function rowsToCSV(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const cell = value => {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [columns.map(cell).join(','), ...rows.map(row => columns.map(key => cell(row[key])).join(','))].join('\r\n') + '\r\n';
}
export function downloadCSV(rows, filename) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', rowsToCSV(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

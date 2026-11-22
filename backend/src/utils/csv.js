// Cells starting with = + - @ (or tab/CR) are prefixed with ' so spreadsheets never run them as formulas.
const cell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
exports.cell = cell;
exports.csv = (head, rows) => [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');

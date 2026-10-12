"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCsv = toCsv;
function toCsv(headers, rows) {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return '\uFEFF' + [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}
//# sourceMappingURL=csv.util.js.map
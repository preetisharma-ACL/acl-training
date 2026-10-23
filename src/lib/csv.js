import { downloadBlob } from "./storage";

const cell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// columns: [{ label, value: (row) => any }]
export function exportCsv(filename, columns, rows) {
  const lines = [columns.map((c) => cell(c.label)).join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(c.value(r))).join(","));
  // BOM so Excel opens UTF-8 correctly.
  downloadBlob(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), filename);
}

// src/components/logging/BulkGridLog.tsx
//
// End-of-day catch-up mode: a spreadsheet-style grid, one row per task,
// submit everything at once. For people who'd rather log everything in
// one sitting than fill a form per task through the day.

"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { MESSAGES } from "@/lib/messages";

type Row = { taskTitle: string; taskCategory: string; description: string; timeSpent: string };
const EMPTY_ROW: Row = { taskTitle: "", taskCategory: "", description: "", timeSpent: "1" };

export default function BulkGridLog({ onSubmitted }: { onSubmitted: () => void }) {
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  const cellInp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box",
  };

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((prev) => [...prev, { ...EMPTY_ROW }]); }
  function removeRow(i: number) { setRows((prev) => prev.filter((_, idx) => idx !== i)); }

  async function submitAll() {
    setError("");
    const valid = rows.filter((r) => r.taskTitle.trim() && r.taskCategory.trim());
    if (valid.length === 0) { setError(MESSAGES.bulk.empty); return; }
    setSubmitting(true);
    let ok = 0;
    for (const r of valid) {
      try {
        const res = await fetch("/api/daily-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskTitle: r.taskTitle,
            taskCategory: r.taskCategory,
            description: r.description || r.taskTitle,
            timeSpent: r.timeSpent || "1",
            priority: "MEDIUM",
            status: "SUBMITTED",
          }),
        });
        if (res.ok) ok++;
      } catch { /* keep going */ }
    }
    setSubmitting(false);
    if (ok === valid.length) {
      showToast(MESSAGES.bulk.allSaved(ok));
      setRows([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]);
      onSubmitted();
    } else {
      setError(MESSAGES.bulk.partial(ok, valid.length));
    }
  }

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Bulk entry</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        Log everything from today in one grid. Blank rows are ignored.
      </div>
      {error && <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", color: "#f87171", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.4fr 70px 32px", gap: 8, marginBottom: 8, padding: "0 4px" }}>
        {["Title", "Category", "Notes", "Hrs", ""].map((h) => (
          <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{h}</div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.4fr 70px 32px", gap: 8, alignItems: "center" }}>
            <input style={cellInp} placeholder="What did you do?" value={row.taskTitle} onChange={(e) => updateRow(i, { taskTitle: e.target.value })} />
            <input style={cellInp} placeholder="Category" value={row.taskCategory} onChange={(e) => updateRow(i, { taskCategory: e.target.value })} />
            <input style={cellInp} placeholder="Optional notes" value={row.description} onChange={(e) => updateRow(i, { description: e.target.value })} />
            <input type="number" step="0.5" min="0.5" max="12" style={cellInp} value={row.timeSpent} onChange={(e) => updateRow(i, { timeSpent: e.target.value })} />
            <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 15 }}>✕</button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={addRow} style={{ padding: "10px 18px", borderRadius: 9, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>
          + Add row
        </button>
        <button onClick={submitAll} disabled={submitting} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 700, cursor: "pointer" }}>
          {submitting ? "Submitting…" : "Submit all"}
        </button>
      </div>
    </div>
  );
}

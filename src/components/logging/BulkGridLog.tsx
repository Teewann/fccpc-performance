// src/components/logging/BulkGridLog.tsx
//
// End-of-day catch-up mode: a spreadsheet-style grid, one row per task,
// submit everything at once. For people who'd rather log everything in
// one sitting than fill a form per task through the day.

"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { MESSAGES } from "@/lib/messages";

type Row = {
  taskTitle: string;
  taskCategory: string;
  description: string;
  hours: number;
  minutes: number;
};

const EMPTY_ROW: Row = {
  taskTitle: "",
  taskCategory: "",
  description: "",
  hours: 1,
  minutes: 0,
};

export default function BulkGridLog({ onSubmitted }: { onSubmitted: () => void }) {
  const [rows, setRows] = useState<Row[]>([
    { ...EMPTY_ROW },
    { ...EMPTY_ROW },
    { ...EMPTY_ROW },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  const cellInp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box",
  };

  const miniSel: React.CSSProperties = {
    background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 6, padding: "6px 4px", fontSize: 12, color: "var(--text-primary)",
    outline: "none", cursor: "pointer",
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
      // Convert hours + minutes to decimal hours (e.g. 1h 20m → 1.33)
      const total = Math.round((r.hours + r.minutes / 60) * 100) / 100;
      try {
        const res = await fetch("/api/daily-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskTitle: r.taskTitle,
            taskCategory: r.taskCategory,
            description: r.description || r.taskTitle,
            timeSpent: String(total > 0 ? total : 0.01),
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

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.4fr 140px 32px", gap: 8, marginBottom: 8, padding: "0 4px" }}>
        {["Title", "Category", "Notes", "Time spent", ""].map((h) => (
          <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{h}</div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.4fr 140px 32px", gap: 8, alignItems: "center" }}>
            <input style={cellInp} placeholder="What did you do?" value={row.taskTitle} onChange={(e) => updateRow(i, { taskTitle: e.target.value })} />
            <input style={cellInp} placeholder="Category" value={row.taskCategory} onChange={(e) => updateRow(i, { taskCategory: e.target.value })} />
            <input style={cellInp} placeholder="Optional notes" value={row.description} onChange={(e) => updateRow(i, { description: e.target.value })} />
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <select style={miniSel} value={row.hours} onChange={(e) => updateRow(i, { hours: Number(e.target.value) })}>
                {Array.from({ length: 13 }, (_, h) => h).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>h</span>
              <select style={miniSel} value={row.minutes} onChange={(e) => updateRow(i, { minutes: Number(e.target.value) })}>
                {Array.from({ length: 60 }, (_, m) => m).map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>m</span>
            </div>
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
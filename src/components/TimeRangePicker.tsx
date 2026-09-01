// src/components/TimeRangePicker.tsx
//
// Replaces the plain "2.5 hours" number box with how people actually think
// about their day: "I started around 9, finished about 11:30." Computes
// decimal hours automatically for storage — the DailyLog.timeSpent field
// stays a Float, no schema change needed, this only changes the input UX.

"use client";

import { useState, useEffect } from "react";

type TimeValue = { hour: number; minute: number; period: "AM" | "PM" };

const DEFAULT_START: TimeValue = { hour: 9, minute: 0, period: "AM" };
const DEFAULT_END: TimeValue = { hour: 10, minute: 0, period: "AM" };

function to24Hour(t: TimeValue): number {
  let h = t.hour % 12;
  if (t.period === "PM") h += 12;
  return h + t.minute / 60;
}

function computeHours(start: TimeValue, end: TimeValue): number {
  let diff = to24Hour(end) - to24Hour(start);
  if (diff < 0) diff += 24; // crossed midnight, e.g. night shift
  return Math.round(diff * 100) / 100;
}

export default function TimeRangePicker({
  onChange,
  initialHours,
}: {
  onChange: (decimalHours: number) => void;
  initialHours?: number;
}) {
  const [start, setStart] = useState<TimeValue>(DEFAULT_START);
  const [end, setEnd] = useState<TimeValue>(DEFAULT_END);

  useEffect(() => {
    onChange(computeHours(start, end));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  const sel: React.CSSProperties = {
    background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 8, padding: "8px 10px", fontSize: 14, color: "var(--text-primary)",
    outline: "none", cursor: "pointer",
  };

  function TimeInputs({ value, setValue, label }: { value: TimeValue; setValue: (v: TimeValue) => void; label: string }) {
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select style={sel} value={value.hour} onChange={(e) => setValue({ ...value, hour: Number(e.target.value) })}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <span style={{ color: "var(--text-muted)" }}>:</span>
          <select style={sel} value={value.minute} onChange={(e) => setValue({ ...value, minute: Number(e.target.value) })}>
            {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
          </select>
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "0.5px solid var(--border)" }}>
            {(["AM", "PM"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setValue({ ...value, period: p })}
                style={{
                  padding: "8px 12px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                  background: value.period === p ? "#0c1a2e" : "var(--bg-input)",
                  color: value.period === p ? "#60a5fa" : "var(--text-muted)",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const total = computeHours(start, end);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 10 }}>
        <TimeInputs value={start} setValue={setStart} label="Started" />
        <TimeInputs value={end} setValue={setEnd} label="Finished" />
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Total: <span style={{ color: "#4ade80", fontWeight: 600 }}>{total} hours</span>
      </div>
    </div>
  );
}
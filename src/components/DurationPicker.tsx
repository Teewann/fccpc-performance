// src/components/DurationPicker.tsx
//
// Simple duration input: Hours + Minutes. Single value, no start/finish.
// Sends decimal hours to the API (e.g. 1h 20m → 1.33) so no schema change.

"use client";

import { useState, useEffect } from "react";

export default function DurationPicker({
  onChange,
  initialHours,
}: {
  onChange: (decimalHours: number) => void;
  initialHours?: number;
}) {
  // Convert initial decimal to hours + minutes
  const initialH = initialHours ? Math.floor(initialHours) : 1;
  const initialM = initialHours ? Math.round((initialHours % 1) * 60) : 0;

  const [hours,   setHours]   = useState(initialH);
  const [minutes, setMinutes] = useState(initialM);

  useEffect(() => {
    const decimal = Math.round((hours + minutes / 60) * 100) / 100;
    onChange(decimal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, minutes]);

  const total = hours + minutes / 60;
  const totalLabel =
    hours === 0 && minutes === 0
      ? "0 min"
      : hours === 0
      ? `${minutes} min`
      : minutes === 0
      ? `${hours} hr`
      : `${hours} hr ${minutes} min`;

  const sel: React.CSSProperties = {
    background: "var(--bg-input)",
    border: "0.5px solid var(--border)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 14,
    color: "var(--text-primary)",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
        Time spent
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select style={sel} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          {Array.from({ length: 13 }, (_, i) => i).map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>hrs</span>

        <select style={sel} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {Array.from({ length: 60 }, (_, i) => i).map((m) => (
            <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>min</span>

        <span style={{
          marginLeft: 8,
          fontSize: 13,
          fontWeight: 600,
          color: "#4ade80",
          background: "#052e16",
          border: "0.5px solid #14532d",
          borderRadius: 7,
          padding: "4px 10px",
        }}>
          = {totalLabel}
        </span>
      </div>
    </div>
  );
}
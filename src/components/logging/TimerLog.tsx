// src/components/logging/TimerLog.tsx
//
// For reactive work (IT fixing something now, an enforcement call-out).
// No upfront form — press start, do the work, press stop, add one line.

"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { MESSAGES } from "@/lib/messages";

export default function TimerLog({ onSubmitted }: { onSubmitted: () => void }) {
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showFinish, setShowFinish] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && startedAt) {
      intervalRef.current = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, startedAt]);

  function start() {
    if (!label.trim()) { setError(MESSAGES.timer.needLabel); return; }
    setError("");
    setStartedAt(Date.now());
    setRunning(true);
    setElapsed(0);
  }

  function stop() {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setShowFinish(true);
  }

  async function finish() {
    setSubmitting(true);
    setError("");
    const hours = Math.max(0.5, Math.round((elapsed / 3600000) * 2) / 2); // rounds to nearest 0.5h, min 0.5
    try {
      const res = await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: label,
          taskCategory: category || "Reactive / call-out",
          description: description || label,
          timeSpent: String(hours),
          priority: "MEDIUM",
          status: "SUBMITTED",
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || MESSAGES.timer.saveError); return; }
      setLabel(""); setDescription(""); setCategory(""); setElapsed(0); setShowFinish(false);
      showToast(MESSAGES.timer.saved);
      onSubmitted();
    } catch {
      setError(MESSAGES.generic.networkError);
    } finally {
      setSubmitting(false);
    }
  }

  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box",
  };

  if (showFinish) {
    return (
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
          Logged {mins}m {secs}s — add a quick note
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{label}</div>
        {error && <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", color: "#f87171", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <input style={{ ...inp, marginBottom: 10 }} placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <textarea style={{ ...inp, resize: "none", marginBottom: 12 }} rows={2} placeholder="What did you actually do? (optional, defaults to the label)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button onClick={finish} disabled={submitting}
          style={{ width: "100%", padding: 13, borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 700, cursor: "pointer" }}>
          {submitting ? "Saving…" : "Save log entry"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Timer</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        For work you're starting right now — no form until you're done.
      </div>
      {error && <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", color: "#f87171", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {!running ? (
        <>
          <input style={{ ...inp, marginBottom: 12 }} placeholder="What are you starting? e.g. 'Fixing Finance printer'"
            value={label} onChange={(e) => setLabel(e.target.value)} />
          <button onClick={start} style={{ width: "100%", padding: 13, borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 700, cursor: "pointer" }}>
            ▶ Start timer
          </button>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 42, fontWeight: 700, color: "#4ade80", fontVariantNumeric: "tabular-nums", marginBottom: 20 }}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
          <button onClick={stop} style={{ padding: "13px 40px", borderRadius: 10, border: "1.5px solid #f87171", background: "#1f0707", color: "#f87171", fontWeight: 700, cursor: "pointer" }}>
            ■ Stop
          </button>
        </div>
      )}
    </div>
  );
}

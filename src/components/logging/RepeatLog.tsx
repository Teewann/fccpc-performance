// src/components/logging/RepeatLog.tsx
//
// Lets staff clone a past entry (yesterday's or any recent one) with today's
// date, editing only what changed. Cuts repetitive daily filing to one tap
// + a quick edit.

"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { MESSAGES } from "@/lib/messages";
import DurationPicker from "@/components/DurationPicker";

type RecentLog = {
  id: string;
  taskTitle: string;
  taskCategory: string;
  taskType?: string;
  description: string;
  timeSpent: number;
  priority: string;
};

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0 && m === 0) return "0 min";
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export default function RepeatLog({ onSubmitted }: { onSubmitted: () => void }) {
  const [recent, setRecent] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RecentLog | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/daily-logs?mine=true&limit=15")
      .then((r) => r.json())
      .then((d) => setRecent(d.logs || []))
      .catch(() => setError(MESSAGES.repeat.loadError))
      .finally(() => setLoading(false));
  }, []);

  // De-duplicate by title+category so the picker shows distinct "kinds" of
  // work rather than 5 identical rows from the same recurring task.
  const distinct = recent.filter(
    (log, i, arr) => arr.findIndex((l) => l.taskTitle === log.taskTitle && l.taskCategory === log.taskCategory) === i
  ).slice(0, 8);

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box",
  };

  async function submit() {
    if (!editing) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: editing.taskTitle,
          taskCategory: editing.taskCategory,
          taskType: editing.taskType,
          description: editing.description,
          timeSpent: String(editing.timeSpent),
          priority: editing.priority,
          status: "SUBMITTED",
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || MESSAGES.generic.serverError); return; }
      setEditing(null);
      showToast(MESSAGES.repeat.submitted);
      onSubmitted();
    } catch {
      setError(MESSAGES.generic.networkError);
    } finally {
      setSubmitting(false);
    }
  }

  if (editing) {
    return (
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>
          Repeat: edit before submitting
        </div>
        {error && <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", color: "#f87171", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <input style={{ ...inp, marginBottom: 10, fontWeight: 600 }} value={editing.taskTitle}
          onChange={(e) => setEditing({ ...editing, taskTitle: e.target.value })} />
        <textarea style={{ ...inp, resize: "none", marginBottom: 10 }} rows={2} value={editing.description}
          onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
        <div style={{ marginBottom: 14 }}>
          <DurationPicker
            onChange={(hours) => setEditing({ ...editing, timeSpent: hours })}
            initialHours={editing.timeSpent}
          />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setEditing(null)} style={{ padding: "12px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", cursor: "pointer" }}>Back</button>
          <button onClick={submit} disabled={submitting} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 700, cursor: "pointer" }}>
            {submitting ? "Submitting…" : "Submit for today"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Repeat a recent entry</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        Pick something you've logged before, tweak it, done.
      </div>
      {error && <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", color: "#f87171", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {loading ? (
        <div style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: 30 }}>Loading your recent entries…</div>
      ) : distinct.length === 0 ? (
        <div style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: 30 }}>No recent entries yet. Log something once and it'll show up here to repeat.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {distinct.map((log) => (
            <div key={log.id} onClick={() => setEditing({ ...log })}
              className="card-bg"
              style={{ borderRadius: 10, padding: "12px 16px", cursor: "pointer", border: "0.5px solid var(--border)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{log.taskTitle}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{log.taskCategory} · {formatHours(log.timeSpent)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
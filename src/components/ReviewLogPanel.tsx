// src/components/ReviewLogPanel.tsx
//
// Drop this into the detail panel of staff-logs/page.tsx, shown only when
// the selected log's status is SUBMITTED. This is the actual action that
// was missing — everything before this only displayed a score once one
// existed, nothing let a supervisor set it.
//
// Usage inside your staff-logs detail panel (where you currently render
// the "Supervisor feedback" block conditionally):
//
//   {selected.status === "SUBMITTED" && (
//     <ReviewLogPanel logId={selected.id} onReviewed={() => { setSelected(null); fetchLogs(); }} />
//   )}

"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

export default function ReviewLogPanel({
  logId,
  onReviewed,
}: {
  logId: string;
  onReviewed: () => void;
}) {
  const { showToast } = useToast();
  const [score, setScore] = useState(7);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 10, padding: "10px 12px", fontSize: 14, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box",
  };

  async function submit(decision: "APPROVE" | "REJECT" | "QUERY") {
    setSubmitting(decision);
    try {
      const res = await fetch(`/api/daily-logs/${logId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, score: decision === "APPROVE" ? score : undefined, comment }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          decision === "APPROVE" ? "Approved." :
          decision === "REJECT" ? "Rejected." : "Sent back with a query."
        );
        onReviewed();
      } else {
        showToast(data.error || "Something went wrong on our end. Try again shortly.", false);
      }
    } catch {
      showToast("Connection issue ; try again in a moment.", false);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "0.5px solid var(--border-soft)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
        Review this log
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
          Score (1–10, required to approve): <span style={{ color: "#4ade80", fontWeight: 700 }}>{score}</span>
        </label>
        <input type="range" min={1} max={10} value={score} onChange={(e) => setScore(Number(e.target.value))} style={{ width: "100%" }} />
      </div>

      <textarea
        style={{ ...inp, resize: "none", marginBottom: 12 }}
        rows={2}
        placeholder="Comment (optional, but recommended for reject/query)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => submit("APPROVE")}
          disabled={!!submitting}
          style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          {submitting === "APPROVE" ? "…" : "✓ Approve"}
        </button>
        <button
          onClick={() => submit("QUERY")}
          disabled={!!submitting}
          style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "0.5px solid #78350f", background: "#1c1107", color: "#f59e0b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {submitting === "QUERY" ? "…" : "? Query"}
        </button>
        <button
          onClick={() => submit("REJECT")}
          disabled={!!submitting}
          style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "0.5px solid #7f1d1d", background: "#1f0707", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {submitting === "REJECT" ? "…" : "✕ Reject"}
        </button>
      </div>
    </div>
  );
}
"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type Log = {
  id: string;
  taskTitle: string;
  taskCategory: string;
  description: string;
  timeSpent: number;
  priority: string;
  status: string;
  caseReference: string | null;
  notes: string | null;
  supervisorComment: string | null;
  supervisorScore: number | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
    department: { name: string } | null;
    unit: { name: string } | null;
  };
};

const priorityColor: Record<string, string> = {
  LOW:      "bg-green-950 text-green-400 border-green-900",
  MEDIUM:   "bg-blue-950 text-blue-400 border-blue-900",
  HIGH:     "bg-amber-950 text-amber-400 border-amber-900",
  CRITICAL: "bg-red-950 text-red-400 border-red-900",
};

const statusColor: Record<string, string> = {
  SUBMITTED: "bg-blue-950 text-blue-400 border-blue-900",
  APPROVED:  "bg-green-950 text-green-400 border-green-900",
  REJECTED:  "bg-red-950 text-red-400 border-red-900",
  QUERIED:   "bg-amber-950 text-amber-400 border-amber-900",
};

export default function SupervisorPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "SUBMITTED" | "APPROVED" | "REJECTED">("SUBMITTED");
  const [selected, setSelected] = useState<Log | null>(null);
  const [comment, setComment] = useState("");
  const [score, setScore] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetchLogs(); }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/supervisor/logs");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: "approve" | "reject" | "query") {
    if (!selected) return;
    setSubmitting(true);
    setMsg("");
    try {
      const res = await fetch("/api/supervisor/logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: selected.id, action, comment, score }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`Log ${action}d successfully.`);
        setSelected(null);
        setComment("");
        setScore("");
        fetchLogs();
      } else {
        setMsg(data.error || "Something went wrong.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = filter === "ALL" ? logs : logs.filter((l) => l.status === filter);
  const counts = {
    ALL: logs.length,
    SUBMITTED: logs.filter((l) => l.status === "SUBMITTED").length,
    APPROVED:  logs.filter((l) => l.status === "APPROVED").length,
    REJECTED:  logs.filter((l) => l.status === "REJECTED").length,
  };

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-page-title">Supervisor Review Panel</h1>
            <p className="text-small mt-1">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium"
              style={{ background: "#052e16", border: "1.5px solid #22c55e", color: "#4ade80" }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} />
              {counts.SUBMITTED} pending
            </div>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total logs", value: counts.ALL, color: "var(--text-primary)" },
            { label: "Awaiting review", value: counts.SUBMITTED, color: "#60a5fa" },
            { label: "Approved", value: counts.APPROVED, color: "#4ade80" },
            { label: "Rejected", value: counts.REJECTED, color: "#f87171" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-4 card-bg text-center">
              <div className="text-kpi-value" style={{ color: s.color }}>{s.value}</div>
              <div className="text-label mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {(["ALL", "SUBMITTED", "APPROVED", "REJECTED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all border"
              style={{
                background: filter === f ? "var(--accent-bg)" : "var(--bg-card)",
                borderColor: filter === f ? "var(--accent)" : "var(--border)",
                color: filter === f ? "var(--accent-text)" : "var(--text-muted)",
              }}
            >
              {f === "ALL" ? "All logs" : f.charAt(0) + f.slice(1).toLowerCase()} ({counts[f]})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-4">

          {/* Logs list */}
          <div className="col-span-3 space-y-2">
            {loading ? (
              <div className="text-[14px] text-center py-10" style={{ color: "var(--text-muted)" }}>
                Loading logs...
              </div>
            ) : filtered.length === 0 ? (
              <div
                className="rounded-xl p-8 text-center card-bg"
              >
                <div className="text-[15px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                  No logs here
                </div>
                <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                  {filter === "SUBMITTED"
                    ? "All caught up - no logs waiting for review"
                    : `No ${filter.toLowerCase()} logs yet`}
                </div>
              </div>
            ) : (
              filtered.map((log) => (
                <div
                  key={log.id}
                  onClick={() => { setSelected(log); setComment(log.supervisorComment || ""); setScore(log.supervisorScore?.toString() || ""); setMsg(""); }}
                  className="rounded-xl p-4 cursor-pointer transition-all card-bg"
                  style={{
                    borderLeft: selected?.id === log.id ? "3px solid var(--accent)" : "3px solid transparent",
                    outline: selected?.id === log.id ? "0.5px solid var(--accent)" : "0.5px solid var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0"
                        style={{ background: "var(--accent-bg)", color: "var(--accent-text)" }}
                      >
                        {log.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
                          {log.user.name}
                        </div>
                        <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                          {log.user.department?.name || "No department"} · {log.user.unit?.name || ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${priorityColor[log.priority] || ""}`}>
                        {log.priority}
                      </span>
                      <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${statusColor[log.status] || ""}`}>
                        {log.status.charAt(0) + log.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <div className="text-[15px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                    {log.taskTitle}
                  </div>
                  <div className="text-[13px] mb-2 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                    {log.description}
                  </div>
                  <div className="flex items-center gap-4 text-[12px]" style={{ color: "var(--text-hint)" }}>
                    <span>{log.taskCategory}</span>
                    <span>{log.timeSpent}h spent</span>
                    {log.caseReference && <span>Ref: {log.caseReference}</span>}
                    <span className="ml-auto">
                      {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Review panel */}
          <div className="col-span-2">
            {!selected ? (
              <div
                className="rounded-xl p-6 text-center card-bg sticky top-6"
              >
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-xl"
                  style={{ background: "var(--accent-bg)" }}
                >
                  ✓
                </div>
                <div className="text-[15px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                  Select a log to review
                </div>
                <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                  Click any log on the left to open the review panel
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-5 card-bg sticky top-6">
                <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: "0.5px solid var(--border-soft)" }}>
                  <div className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
                    Review log
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-[13px] px-2 py-1 rounded"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Log summary */}
                <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)" }}>
                  <div className="text-[15px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                    {selected.taskTitle}
                  </div>
                  <div className="text-[13px] mb-2" style={{ color: "var(--text-muted)" }}>
                    {selected.description}
                  </div>
                  <div className="flex gap-3 text-[12px]" style={{ color: "var(--text-hint)" }}>
                    <span>{selected.taskCategory}</span>
                    <span>{selected.timeSpent}h</span>
                    {selected.caseReference && <span>{selected.caseReference}</span>}
                  </div>
                  {selected.notes && (
                    <div className="mt-2 text-[13px] italic" style={{ color: "var(--text-muted)" }}>
                      Note: {selected.notes}
                    </div>
                  )}
                </div>

                {/* Score */}
                <div className="mb-4">
                  <label className="text-label block mb-2">Quality score (1–10)</label>
                  <div className="flex gap-2 flex-wrap">
                    {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                      <button
                        key={n}
                        onClick={() => setScore(n.toString())}
                        className="w-9 h-9 rounded-lg text-[13px] font-medium border transition-all"
                        style={{
                          background: score === n.toString() ? "var(--accent-bg)" : "var(--bg-input)",
                          borderColor: score === n.toString() ? "var(--accent)" : "var(--border)",
                          color: score === n.toString() ? "var(--accent-text)" : "var(--text-muted)",
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div className="mb-5">
                  <label className="text-label block mb-2">Supervisor comment</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Leave feedback for the staff member..."
                    className="w-full rounded-lg px-3 py-2.5 text-[14px] resize-none focus:outline-none"
                    style={{
                      background: "var(--bg-input)",
                      border: "0.5px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                {msg && (
                  <div
                    className="mb-4 px-3 py-2.5 rounded-lg text-[13px] font-medium"
                    style={{
                      background: msg.includes("success") ? "var(--accent-bg)" : "#1f0707",
                      color: msg.includes("success") ? "var(--accent-text)" : "#f87171",
                      border: `0.5px solid ${msg.includes("success") ? "var(--accent-border)" : "#7f1d1d"}`,
                    }}
                  >
                    {msg}
                  </div>
                )}

                {/* Action buttons */}
                {selected.status === "SUBMITTED" && (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleAction("approve")}
                      disabled={submitting}
                      className="py-2.5 rounded-lg text-[13px] font-medium border transition-all"
                      style={{ background: "#052e16", borderColor: "#22c55e", color: "#4ade80" }}
                    >
                      {submitting ? "..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleAction("query")}
                      disabled={submitting}
                      className="py-2.5 rounded-lg text-[13px] font-medium border transition-all"
                      style={{ background: "#1c1107", borderColor: "#78350f", color: "#f59e0b" }}
                    >
                      {submitting ? "..." : "Query"}
                    </button>
                    <button
                      onClick={() => handleAction("reject")}
                      disabled={submitting}
                      className="py-2.5 rounded-lg text-[13px] font-medium border transition-all"
                      style={{ background: "#1f0707", borderColor: "#7f1d1d", color: "#f87171" }}
                    >
                      {submitting ? "..." : "Reject"}
                    </button>
                  </div>
                )}

                {selected.status !== "SUBMITTED" && (
                  <div
                    className="text-center py-2 rounded-lg text-[13px] font-medium"
                    style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "0.5px solid var(--border)" }}
                  >
                    Already {selected.status.toLowerCase()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
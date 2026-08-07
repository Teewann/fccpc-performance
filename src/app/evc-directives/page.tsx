"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type EVCTask = {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  isConfidential: boolean;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
  evcComment: string | null;
  createdAt: string;
  documentName: string | null;
  documentType: string | null;
  createdBy: { name: string; role: string };
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW:      "#4ade80",
  MEDIUM:   "#60a5fa",
  HIGH:     "#f59e0b",
  CRITICAL: "#f87171",
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING:     { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", label: "Pending"     },
  IN_PROGRESS: { bg: "#1c1107", color: "#f59e0b", border: "#78350f", label: "In Progress" },
  COMPLETED:   { bg: "#052e16", color: "#4ade80", border: "#14532d", label: "Completed"   },
  CANCELLED:   { bg: "#1a1d28", color: "#6b7280", border: "#374151", label: "Cancelled"   },
};

export default function EVCDirectivesPage() {
  const [tasks,      setTasks]      = useState<EVCTask[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<EVCTask | null>(null);
  const [filter,     setFilter]     = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [newStatus,  setNewStatus]  = useState("");
  const [comment,    setComment]    = useState("");
  const [msg,        setMsg]        = useState({ text: "", ok: true });

  useEffect(() => { fetchTasks(); }, []);

  async function fetchTasks() {
    setLoading(true);
    try {
      const res  = await fetch("/api/evc-tasks-mine");
      const data = await res.json();
      setTasks(data.tasks || []);
    } finally { setLoading(false); }
  }

  async function handleUpdate() {
    if (!selected || !newStatus) return;
    setSubmitting(true); setMsg({ text: "", ok: true });
    try {
      const res  = await fetch("/api/evc-tasks-mine", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          taskId:  selected.id,
          status:  newStatus,
          comment: comment || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "Progress updated. EVC has been notified.", ok: true });
        setNewStatus("");
        setComment("");
        setSelected(null);
        fetchTasks();
      } else {
        setMsg({ text: data.error || "Update failed.", ok: false });
      }
    } finally { setSubmitting(false); }
  }

  async function downloadDocument() {
    if (!selected) return;
    // FIXED: was /api/evc-tasks/document — now matches the actual folder name
    const res  = await fetch(`/api/evc-tasks-document?taskId=${selected.id}`);
    const data = await res.json();
    if (res.ok && data.fileData) {
      const link    = document.createElement("a");
      link.href     = data.fileData;
      link.download = data.fileName;
      link.click();
    }
  }

  const filtered = filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);

  const counts = {
    ALL:         tasks.length,
    PENDING:     tasks.filter((t) => t.status === "PENDING").length,
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    COMPLETED:   tasks.filter((t) => t.status === "COMPLETED").length,
  };

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)",
    border: "0.5px solid var(--border)", borderRadius: 10,
    padding: "12px 14px", fontSize: 15, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box", marginBottom: 14,
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              EVC Directives
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · Tasks assigned to you by the Executive Vice Chairman
            </p>
          </div>
          <ThemeToggleButton />
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
          {[
            { label: "Total",       value: counts.ALL,         color: "var(--text-primary)" },
            { label: "Pending",     value: counts.PENDING,     color: "#60a5fa" },
            { label: "In progress", value: counts.IN_PROGRESS, color: "#f59e0b" },
            { label: "Completed",   value: counts.COMPLETED,   color: "#4ade80" },
          ].map((s) => (
            <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* EVC badge */}
        <div style={{ background: "#1c1107", border: "0.5px solid #78350f", borderRadius: 12, padding: "14px 20px", marginBottom: 22, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>🏛</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#f59e0b", marginBottom: 3 }}>
              Executive Vice Chairman Directives
            </div>
            <div style={{ fontSize: 14, color: "#78350f", lineHeight: 1.5 }}>
              These tasks were assigned directly by the EVC. Treat them with highest priority.
              Update the status as you progress and the EVC will be notified automatically.
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {(["ALL", "PENDING", "IN_PROGRESS", "COMPLETED"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "9px 18px", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer",
              border: `0.5px solid ${filter === f ? "var(--accent)" : "var(--border)"}`,
              background: filter === f ? "var(--accent-bg)" : "var(--bg-card)",
              color: filter === f ? "var(--accent-text)" : "var(--text-muted)",
            }}>
              {f === "ALL" ? "All" : f === "IN_PROGRESS" ? "In Progress" : f.charAt(0) + f.slice(1).toLowerCase()} ({counts[f]})
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 16 }}>

          {/* Task list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>
                Loading EVC directives...
              </div>
            ) : filtered.length === 0 ? (
              <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>📋</div>
                <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  No directives found
                </div>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  The EVC has not assigned any tasks to you yet
                </div>
              </div>
            ) : (
              filtered.map((task) => {
                const ss  = STATUS_STYLE[task.status] || STATUS_STYLE.PENDING;
                const pc  = PRIORITY_COLOR[task.priority] || "#60a5fa";
                const sel = selected?.id === task.id;
                const od  = task.dueDate && !["COMPLETED", "CANCELLED"].includes(task.status) && new Date(task.dueDate) < new Date();

                return (
                  <div
                    key={task.id}
                    onClick={() => { setSelected(sel ? null : task); setNewStatus(""); setComment(""); setMsg({ text: "", ok: true }); }}
                    className="card-bg"
                    style={{
                      borderRadius: 14, padding: "20px 24px", cursor: "pointer",
                      borderLeft: `3px solid ${sel ? "var(--accent)" : od ? "#ef4444" : ss.color}`,
                      outline: `0.5px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{task.title}</div>
                          {task.isConfidential && (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "#1f0707", color: "#f87171", border: "0.5px solid #7f1d1d", flexShrink: 0 }}>
                              🔒 Confidential
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                          From: {task.createdBy.name} · {task.category}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, color: pc, background: `${pc}22`, border: `0.5px solid ${pc}44` }}>
                          {task.priority}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: ss.bg, color: ss.color, border: `0.5px solid ${ss.border}` }}>
                          {ss.label}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 12 }}>
                      {task.description.length > 140 ? task.description.slice(0, 138) + "…" : task.description}
                    </div>

                    <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text-hint)", flexWrap: "wrap" }}>
                      {task.dueDate && (
                        <span style={{ color: od ? "#f87171" : "var(--text-hint)", fontWeight: od ? 600 : 400 }}>
                          {od ? "⚠ Overdue: " : "📅 Due: "}
                          {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                      {task.documentName && <span style={{ color: "#60a5fa" }}>📎 {task.documentName}</span>}
                      <span>Assigned {new Date(task.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      {task.completedAt && <span style={{ color: "#4ade80" }}>✅ Completed {new Date(task.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="card-bg" style={{ borderRadius: 14, padding: 26, alignSelf: "start", position: "sticky", top: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>Directive detail</h3>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>

              {msg.text && (
                <div style={{ background: msg.ok ? "var(--accent-bg)" : "#1f0707", border: `0.5px solid ${msg.ok ? "var(--accent-border)" : "#7f1d1d"}`, color: msg.ok ? "var(--accent-text)" : "#f87171", borderRadius: 10, padding: "12px 14px", fontSize: 14, marginBottom: 16 }}>
                  {msg.text}
                </div>
              )}

              {/* Confidential badge */}
              {selected.isConfidential && (
                <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
                  <span>🔒</span>
                  <div style={{ fontSize: 13, color: "#f87171", fontWeight: 500 }}>
                    This task is marked confidential by the EVC. Do not share the contents.
                  </div>
                </div>
              )}

              {/* Task info */}
              <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12, lineHeight: 1.3 }}>
                {selected.title}
              </div>

              <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Full directive</div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {selected.description}
                </div>
              </div>

              {[
                { label: "Assigned by",    value: `${selected.createdBy.name} (${selected.createdBy.role.charAt(0) + selected.createdBy.role.slice(1).toLowerCase()})` },
                { label: "Category",       value: selected.category },
                { label: "Priority",       value: selected.priority },
                { label: "Current status", value: (STATUS_STYLE[selected.status] || STATUS_STYLE.PENDING).label },
                ...(selected.dueDate ? [{ label: "Due date", value: new Date(selected.dueDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) }] : []),
                { label: "Assigned on",    value: new Date(selected.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", gap: 12, paddingBottom: 10, marginBottom: 10, borderBottom: "0.5px solid var(--border-soft)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", width: 110, flexShrink: 0, paddingTop: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>{value}</div>
                </div>
              ))}

              {/* EVC comment */}
              {selected.evcComment && (
                <div style={{ background: "#1c1107", border: "0.5px solid #78350f", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>EVC comment</div>
                  <div style={{ fontSize: 14, color: "#f59e0b", opacity: 0.9, lineHeight: 1.5 }}>{selected.evcComment}</div>
                </div>
              )}

              {/* Document download */}
              {selected.documentName && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>Attached document</div>
                  <button
                    onClick={downloadDocument}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", borderRadius: 10, border: "0.5px solid #1e3a5f", background: "#0c1a2e", color: "#60a5fa", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                  >
                    <span>📎</span>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{selected.documentName}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Click to download</div>
                    </div>
                    <span>↓</span>
                  </button>
                </div>
              )}

              {/* Update status */}
              {!["COMPLETED", "CANCELLED"].includes(selected.status) && (
                <div style={{ paddingTop: 16, borderTop: "0.5px solid var(--border-soft)" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
                    Update this directive
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 7 }}>New status</div>
                  <select style={inp} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    <option value="">Select status...</option>
                    <option value="IN_PROGRESS">I am working on this</option>
                    <option value="COMPLETED">Mark as completed</option>
                  </select>

                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 7 }}>
                    Progress update / comment for EVC
                  </div>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Report your progress or completion details to the EVC..."
                    style={{ ...inp, resize: "none", marginBottom: 14 }}
                  />

                  <button
                    onClick={handleUpdate}
                    disabled={submitting || !newStatus}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: submitting || !newStatus ? "not-allowed" : "pointer", opacity: !newStatus ? 0.5 : 1 }}
                  >
                    {submitting ? "Updating..." : "Submit update to EVC"}
                  </button>
                </div>
              )}

              {selected.status === "COMPLETED" && (
                <div style={{ textAlign: "center", padding: "14px", background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", borderRadius: 10, color: "var(--accent-text)", fontSize: 14, fontWeight: 600 }}>
                  ✅ This directive has been completed
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
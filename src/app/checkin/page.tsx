"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

// ─── Types ────────────────────────────────────────────────────────────
type ActiveTask = {
  id: string;
  taskRef: string | null;
  title: string;
  priority: string;
  status: string;
  treatmentStatus: string | null;
  taskSource: string | null;
  dueDate: string | null;
  department: { name: string };
  createdBy: { name: string };
};

type TaskTimeEntry = {
  taskId: string;
  taskTitle: string;
  taskRef: string | null;
  hoursSpent: number;
};

type RecentLog = {
  id: string;
  date: string;
  taskTitle: string;
  taskCategory: string;
  timeSpent: number;
  status: string;
  supervisorScore: number | null;
  supervisorComment: string | null;
  description: string;
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#4ade80", MEDIUM: "#f59e0b", HIGH: "#fb923c", URGENT: "#f87171",
};

const TASK_CATEGORIES = [
  "Investigation", "Enforcement Action", "Consumer Complaint", "Market Monitoring",
  "Report Writing", "Case Analysis", "Field Inspection", "Legal Research",
  "Stakeholder Engagement", "Policy Review", "Administrative", "Training",
  "Other",
];

const LOG_STATUS_STYLE: Record<string, { color: string; label: string }> = {
  DRAFT:     { color: "#94a3b8", label: "Draft"     },
  SUBMITTED: { color: "#60a5fa", label: "Submitted" },
  APPROVED:  { color: "#4ade80", label: "Approved"  },
  REJECTED:  { color: "#f87171", label: "Rejected"  },
  QUERIED:   { color: "#f59e0b", label: "Queried"   },
};

export default function CheckInPage() {
  const router = useRouter();

  // ── Active tasks auto-fetched ─────────────────────────────────────
  const [activeTasks,    setActiveTasks]    = useState<ActiveTask[]>([]);
  const [recentLogs,     setRecentLogs]     = useState<RecentLog[]>([]);
  const [myName,         setMyName]         = useState("");
  const [todaySubmitted, setTodaySubmitted] = useState(false);
  const [loading,        setLoading]        = useState(true);

  // ── Form state ────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    date:            today,
    taskTitle:       "",
    taskCategory:    "Investigation",
    description:     "",
    priority:        "MEDIUM",
    caseReference:   "",
    amountInvolved:  "",
    notes:           "",
  });

  // Task time entries — one per selected active task
  const [taskEntries,  setTaskEntries]  = useState<TaskTimeEntry[]>([]);
  const [selectedTasks,setSelectedTasks]= useState<Set<string>>(new Set());
  const [freeHours,    setFreeHours]    = useState<number>(0); // hours NOT from tasks
  const [document,     setDocument]     = useState<File | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  }

  // ── Fetch active tasks + recent logs + me ─────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, logsRes, meRes] = await Promise.all([
        fetch("/api/tasks?view=assigned"),
        fetch("/api/staff-logs?limit=7"),
        fetch("/api/settings/account"),
      ]);

      if (tasksRes.ok) {
        const d = await tasksRes.json();
        const openTasks = (d.tasks || []).filter((t: ActiveTask) =>
          !["COMPLETED", "CANCELLED"].includes(t.status)
        );
        setActiveTasks(openTasks);
      }

      if (logsRes.ok) {
        const d = await logsRes.json();
        setRecentLogs(d.logs || []);
        // Check if already submitted today
        const todayLog = (d.logs || []).find((l: RecentLog) =>
          l.date.startsWith(today) && l.status !== "DRAFT"
        );
        setTodaySubmitted(!!todayLog);
      }

      if (meRes.ok) {
        const d = await meRes.json();
        setMyName(d.user?.name || "");
      }
    } finally { setLoading(false); }
  }, [today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Toggle a task as worked on today ─────────────────────────────
  function toggleTask(task: ActiveTask) {
    const next = new Set(selectedTasks);
    if (next.has(task.id)) {
      next.delete(task.id);
      setTaskEntries(prev => prev.filter(e => e.taskId !== task.id));
    } else {
      next.add(task.id);
      setTaskEntries(prev => [
        ...prev,
        { taskId: task.id, taskTitle: task.title, taskRef: task.taskRef, hoursSpent: 1 },
      ]);
    }
    setSelectedTasks(next);
  }

  function updateTaskHours(taskId: string, hours: number) {
    setTaskEntries(prev =>
      prev.map(e => e.taskId === taskId ? { ...e, hoursSpent: Math.max(0.5, Math.min(24, hours)) } : e)
    );
  }

  // Total hours = task entries + free hours
  const totalTaskHours   = taskEntries.reduce((sum, e) => sum + e.hoursSpent, 0);
  const totalHours       = totalTaskHours + freeHours;

  // ── Submit log ────────────────────────────────────────────────────
  async function handleSubmit(asDraft = false) {
    if (!form.description.trim()) {
      showToast("Description is required.", false); return;
    }
    if (!asDraft && totalHours === 0) {
      showToast("Enter at least some time worked (task hours or other hours).", false); return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("date",          form.date);
      fd.append("taskTitle",     form.taskTitle || (taskEntries[0]?.taskTitle || form.description.slice(0, 60)));
      fd.append("taskCategory",  form.taskCategory);
      fd.append("description",   form.description.trim());
      fd.append("timeSpent",     String(totalHours || 1));
      fd.append("priority",      form.priority);
      fd.append("status",        asDraft ? "DRAFT" : "SUBMITTED");
      if (form.caseReference)  fd.append("caseReference",  form.caseReference);
      if (form.amountInvolved) fd.append("amountInvolved", form.amountInvolved);
      if (form.notes)          fd.append("notes",          form.notes);
      if (document)            fd.append("evidence",       document);

      // Send task references as JSON
      if (taskEntries.length > 0) {
        fd.append("taskRefs", JSON.stringify(taskEntries));
      }

      const res  = await fetch("/api/check-in", { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok) {
        showToast(asDraft ? "Draft saved." : "✅ Daily log submitted successfully!");
        if (!asDraft) setTodaySubmitted(true);
        fetchData();
        // Reset form
        setForm({ date: today, taskTitle: "", taskCategory: "Investigation", description: "", priority: "MEDIUM", caseReference: "", amountInvolved: "", notes: "" });
        setTaskEntries([]);
        setSelectedTasks(new Set());
        setFreeHours(0);
        setDocument(null);
      } else {
        showToast(data.error || "Submission failed.", false);
      }
    } finally { setSubmitting(false); }
  }

  // ── Styles ────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 9, padding: "9px 13px", fontSize: 14,
    color: "var(--text-primary)", outline: "none", width: "100%", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block",
  };
  const card: React.CSSProperties = {
    background: "var(--bg-card)", border: "0.5px solid var(--border)",
    borderRadius: 14, padding: "20px 22px", marginBottom: 18,
  };

  const todayDisplay = new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
        <Sidebar />
        <main className="flex-1 p-6" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 16 }}>Loading your tasks…</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, minWidth: 300,
          background: toast.ok ? "#052e16" : "#1f0707",
          border: `1px solid ${toast.ok ? "#14532d" : "#7f1d1d"}`,
          color: toast.ok ? "#4ade80" : "#f87171",
          borderRadius: 12, padding: "14px 20px", fontSize: 14, fontWeight: 600,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{toast.ok ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}

      <main className="flex-1 p-6 min-w-0" style={{ maxWidth: 1100 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Daily Work Log
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 3 }}>
              {todayDisplay}{myName && ` · ${myName}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => router.push("/tasks")}
              style={{ padding: "9px 18px", borderRadius: 9, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
              📋 My Tasks
            </button>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Already submitted today banner */}
        {todaySubmitted && (
          <div style={{ background: "#052e16", border: "1px solid #14532d", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#4ade80" }}>You have already submitted your log for today.</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>You can still submit additional logs if needed, or save a draft.</div>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18 }}>

          {/* ── LEFT: Main form ────────────────────────────────── */}
          <div>

            {/* ── Step 1: Active tasks ──────────────────────────── */}
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                    Step 1 — Which tasks did you work on today?
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                    Tick each task and enter how many hours you spent on it.
                    {activeTasks.length === 0 && " No active tasks assigned to you."}
                  </div>
                </div>
                {selectedTasks.size > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", background: "#052e16", border: "0.5px solid #14532d", borderRadius: 20, padding: "3px 10px" }}>
                    {selectedTasks.size} selected · {totalTaskHours}h
                  </span>
                )}
              </div>

              {activeTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                  No active tasks assigned to you right now. Use Step 2 to describe your work.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeTasks.map(task => {
                    const selected  = selectedTasks.has(task.id);
                    const entry     = taskEntries.find(e => e.taskId === task.id);
                    const isEVC     = task.taskSource === "EVC";
                    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

                    return (
                      <div key={task.id}
                        style={{ borderRadius: 11, padding: "12px 16px",
                          background: selected ? (isEVC ? "#1c1400" : "#0c1a2e") : "var(--bg-input)",
                          border: `1.5px solid ${selected ? (isEVC ? "#92400e" : "#1e3a5f") : "var(--border)"}`,
                          transition: "all 0.12s", cursor: "pointer" }}
                        onClick={() => toggleTask(task)}>

                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          {/* Checkbox */}
                          <div style={{ width: 20, height: 20, borderRadius: 6, marginTop: 1, flexShrink: 0,
                            background: selected ? "#3b82f6" : "var(--bg-card)",
                            border: `2px solid ${selected ? "#3b82f6" : "var(--border)"}`,
                            display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {selected && <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>✓</span>}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                              {isEVC && (
                                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: "#1c1400", color: "#fbbf24", border: "0.5px solid #92400e" }}>
                                  ⚡ EVC
                                </span>
                              )}
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                                color: PRIORITY_COLOR[task.priority] || "#94a3b8",
                                background: `${PRIORITY_COLOR[task.priority] || "#94a3b8"}18` }}>
                                {task.priority}
                              </span>
                              {isOverdue && (
                                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: "#1f0707", color: "#f87171", border: "0.5px solid #7f1d1d" }}>
                                  ⚠ OVERDUE
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: selected ? 600 : 400, color: isEVC ? "#fcd34d" : "var(--text-primary)", lineHeight: 1.3 }}>
                              {task.title}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                              {task.department.name}
                              {task.taskRef && <span style={{ fontFamily: "monospace", color: "#f59e0b", marginLeft: 6 }}>#{task.taskRef}</span>}
                              {task.dueDate && (
                                <span style={{ marginLeft: 6, color: isOverdue ? "#f87171" : "var(--text-hint)" }}>
                                  · Due {new Date(task.dueDate).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Hours input — only shows when selected */}
                          {selected && entry && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                              onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => updateTaskHours(task.id, (entry.hoursSpent || 1) - 0.5)}
                                style={{ width: 26, height: 26, borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                −
                              </button>
                              <div style={{ textAlign: "center", minWidth: 48 }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#60a5fa" }}>{entry.hoursSpent}h</div>
                                <div style={{ fontSize: 9, color: "var(--text-muted)" }}>today</div>
                              </div>
                              <button
                                onClick={() => updateTaskHours(task.id, (entry.hoursSpent || 1) + 0.5)}
                                style={{ width: 26, height: 26, borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Other hours (not from tasks) */}
                  <div style={{ borderRadius: 11, padding: "12px 16px", background: "var(--bg-input)", border: "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Other work (not in task list above)</div>
                      <div style={{ fontSize: 11, color: "var(--text-hint)", marginTop: 2 }}>Meetings, admin, training, etc.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => setFreeHours(h => Math.max(0, h - 0.5))}
                        style={{ width: 26, height: 26, borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <div style={{ textAlign: "center", minWidth: 48 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-secondary)" }}>{freeHours}h</div>
                        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>other</div>
                      </div>
                      <button onClick={() => setFreeHours(h => h + 0.5)}
                        style={{ width: 26, height: 26, borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    </div>
                  </div>

                  {/* Total hours display */}
                  {totalHours > 0 && (
                    <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 4px" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: totalHours > 12 ? "#f87171" : "#4ade80" }}>
                        Total: {totalHours}h today
                        {totalHours > 12 && " ⚠ Exceeds 12h — please verify"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Step 2: Work narrative ────────────────────────── */}
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
                Step 2 — Describe your work today
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>

                {/* Date */}
                <div>
                  <label style={lbl}>Date</label>
                  <input type="date" style={inp} value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>

                {/* Category */}
                <div>
                  <label style={lbl}>Work category</label>
                  <select style={inp} value={form.taskCategory}
                    onChange={e => setForm({ ...form, taskCategory: e.target.value })}>
                    {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Title — pre-fill from selected tasks */}
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>
                    Log title
                    {taskEntries.length > 0 && (
                      <span style={{ fontWeight: 400, color: "#60a5fa", textTransform: "none", marginLeft: 8 }}>
                        (auto-filled from selected tasks — edit if needed)
                      </span>
                    )}
                  </label>
                  <input style={inp}
                    value={form.taskTitle || (taskEntries.length > 0 ? taskEntries.map(e => e.taskTitle).join(", ").slice(0, 120) : "")}
                    onChange={e => setForm({ ...form, taskTitle: e.target.value })}
                    placeholder="Summary of today's work…" />
                </div>

                {/* Description */}
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>What did you accomplish today? *</label>
                  <textarea rows={4} style={{ ...inp, resize: "none" }}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe what you worked on, progress made, decisions taken, and any challenges encountered…" />
                </div>

                {/* Priority */}
                <div>
                  <label style={lbl}>Work priority level</label>
                  <select style={inp} value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                {/* Case reference */}
                <div>
                  <label style={lbl}>Case reference (optional)</label>
                  <input style={inp} value={form.caseReference}
                    onChange={e => setForm({ ...form, caseReference: e.target.value })}
                    placeholder="e.g. FCCPC/ENF/2026/001" />
                </div>

                {/* Amount involved */}
                <div>
                  <label style={lbl}>Amount involved ₦ (optional)</label>
                  <input type="number" style={inp} value={form.amountInvolved}
                    onChange={e => setForm({ ...form, amountInvolved: e.target.value })}
                    placeholder="0.00" />
                </div>

                {/* Evidence */}
                <div>
                  <label style={lbl}>Evidence / attachment (optional)</label>
                  <input type="file" accept=".pdf,.doc,.docx,.jpg,.png,.xls,.xlsx"
                    onChange={e => setDocument(e.target.files?.[0] || null)}
                    style={{ ...inp, padding: "7px 10px" }} />
                </div>

                {/* Notes */}
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Additional notes (optional)</label>
                  <textarea rows={2} style={{ ...inp, resize: "none" }}
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Anything else your supervisor should know…" />
                </div>
              </div>

              {/* Summary box before submit */}
              {(taskEntries.length > 0 || totalHours > 0) && (
                <div style={{ marginTop: 16, padding: "12px 16px", background: "#0c1a2e", border: "0.5px solid #1e3a5f", borderRadius: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Today's summary
                  </div>
                  {taskEntries.map(e => (
                    <div key={e.taskId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                      <span>{e.taskRef ? `#${e.taskRef} ` : ""}{e.taskTitle.slice(0, 60)}{e.taskTitle.length > 60 ? "…" : ""}</span>
                      <span style={{ color: "#60a5fa", fontWeight: 700 }}>{e.hoursSpent}h</span>
                    </div>
                  ))}
                  {freeHours > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
                      <span>Other work / admin</span>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>{freeHours}h</span>
                    </div>
                  )}
                  <div style={{ borderTop: "0.5px solid #1e3a5f", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                    <span style={{ color: "var(--text-muted)" }}>Total hours</span>
                    <span style={{ color: totalHours > 12 ? "#f87171" : "#4ade80" }}>{totalHours}h</span>
                  </div>
                </div>
              )}

              {/* Submit buttons */}
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button onClick={() => handleSubmit(false)} disabled={submitting}
                  style={{ flex: 1, padding: 12, borderRadius: 10,
                    border: "1.5px solid var(--accent)", background: "var(--accent-bg)",
                    color: "var(--accent)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  {submitting ? "Submitting…" : "✓ Submit Daily Log"}
                </button>
                <button onClick={() => handleSubmit(true)} disabled={submitting}
                  style={{ padding: "12px 20px", borderRadius: 10,
                    border: "0.5px solid var(--border)", background: "var(--bg-input)",
                    color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>
                  Save draft
                </button>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Recent logs sidebar ────────────────────── */}
          <div>
            <div style={{ ...card, position: "sticky", top: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
                Recent submissions
              </div>

              {recentLogs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📝</div>
                  No previous logs yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {recentLogs.slice(0, 7).map(log => {
                    const ls = LOG_STATUS_STYLE[log.status] || LOG_STATUS_STYLE.SUBMITTED;
                    return (
                      <div key={log.id}
                        style={{ borderRadius: 10, padding: "12px 14px", background: "var(--bg-input)", border: "0.5px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "flex-start" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1, marginRight: 8 }}>
                            {log.taskTitle.length > 45 ? log.taskTitle.slice(0, 43) + "…" : log.taskTitle}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5, flexShrink: 0,
                            background: `${ls.color}18`, color: ls.color }}>
                            {ls.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {new Date(log.date).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" })}
                          {" · "}{log.timeSpent}h · {log.taskCategory}
                        </div>
                        {log.supervisorScore !== null && (
                          <div style={{ fontSize: 12, color: "#a78bfa", marginTop: 4, fontWeight: 700 }}>
                            Score: {log.supervisorScore}/100
                            {log.supervisorComment && (
                              <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>
                                — {log.supervisorComment.slice(0, 40)}{log.supervisorComment.length > 40 ? "…" : ""}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={() => router.push("/staff-logs")}
                style={{ width: "100%", marginTop: 14, padding: "9px", borderRadius: 9,
                  border: "0.5px solid var(--border)", background: "var(--bg-input)",
                  color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
                View all logs →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
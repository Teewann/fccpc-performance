"use client";

export const dynamic = "force-dynamic";


import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import { TASK_TYPE_GROUPS, getTaskTypeLabel, getTaskTypeIcon } from "@/config/taskTypes";

type TaskTemplate = {
  id: string;
  title: string;
  category: string;
  requiresEvidence: boolean;
  requiresCaseRef: boolean;
  requiresAmount: boolean;
};

type DailyLog = {
  id: string;
  taskTitle: string;
  taskCategory: string;
  timeSpent: number;
  status: string;
  createdAt: string;
  taskType?: string;
};

type FormData = {
  taskTitle: string;
  taskCategory: string;
  description: string;
  timeSpent: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  caseReference: string;
  amountInvolved: string;
  notes: string;
  taskType: string;
};

const PRIORITY = [
  { value: "LOW", label: "Low", style: { bg: "#052e16", color: "#4ade80", border: "#14532d" } },
  { value: "MEDIUM", label: "Medium", style: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" } },
  { value: "HIGH", label: "High", style: { bg: "#1c1107", color: "#f59e0b", border: "#78350f" } },
  { value: "CRITICAL", label: "Critical", style: { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" } },
];

const STATUS_S: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#1a1d28", color: "#9ca3af" },
  SUBMITTED: { bg: "#0c1a2e", color: "#60a5fa" },
  APPROVED: { bg: "#052e16", color: "#4ade80" },
  REJECTED: { bg: "#1f0707", color: "#f87171" },
};

const EMPTY: FormData = {
  taskTitle: "",
  taskCategory: "",
  description: "",
  timeSpent: "",
  priority: "MEDIUM",
  status: "SUBMITTED",
  caseReference: "",
  amountInvolved: "",
  notes: "",
  taskType: "",
};

export default function CheckInPage() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [todayLogs, setTodayLogs] = useState<DailyLog[]>([]);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState<FormData>(EMPTY);

  useEffect(() => {
    fetchTemplates();
    fetchTodayLogs();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/task-templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTodayLogs() {
    const res = await fetch("/api/daily-logs");
    const data = await res.json();
    setTodayLogs(data.logs || []);
    setMonthlyCount(data.monthlyCount || 0);
  }

  function handleTemplateChange(id: string) {
    const t = templates.find((t) => t.id === id);
    if (t) {
      setSelectedTemplate(t);
      setForm((p) => ({
        ...p,
        taskTitle: t.title,
        taskCategory: t.category,
      }));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(submitStatus: "SUBMITTED" | "DRAFT") {
    setErrorMsg("");
    setSuccessMsg("");
    if (!form.taskTitle || !form.description || !form.timeSpent || !form.taskCategory || !form.taskType) {
      setErrorMsg("Please fill in task type, title, description, time spent, and the type of task (Documents, Field, etc.).");
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status: submitStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong.");
      } else {
        setSuccessMsg(submitStatus === "SUBMITTED" ? "Log submitted successfully!" : "Saved as draft.");
        setForm(EMPTY);
        setSelectedTemplate(null);
        fetchTodayLogs();
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const grouped = templates.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, TaskTemplate[]>);

  const inp = {
    width: "100%",
    background: "var(--bg-input)",
    border: "0.5px solid var(--border)",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 15,
    color: "var(--text-primary)",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  const lbl = {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-muted)",
    display: "block",
    marginBottom: 7,
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">
        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Daily Work Log
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{today}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              Log open
            </div>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
          {[
            { label: "Logged today", value: todayLogs.length, color: "var(--text-primary)" },
            { label: "Pending review", value: todayLogs.filter((l) => l.status === "SUBMITTED").length, color: "#60a5fa" },
            { label: "Tasks this month", value: monthlyCount, color: "var(--text-primary)" },
            { label: "Approved today", value: todayLogs.filter((l) => l.status === "APPROVED").length, color: "#4ade80" },
          ].map((s) => (
            <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "16px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
          {/* Form */}
          <div className="card-bg" style={{ borderRadius: 14, padding: 26 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Submit new work log</span>
              <span style={{ fontSize: 12, background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", color: "var(--accent-text)", padding: "3px 10px", borderRadius: 8, fontWeight: 600 }}>
                {new Date().toLocaleDateString("en-GB")}
              </span>
            </div>

            {successMsg && <div style={{ background: "#052e16", border: "0.5px solid #14532d", color: "#4ade80", borderRadius: 10, padding: "12px 14px", fontSize: 14, marginBottom: 16 }}>{successMsg}</div>}
            {errorMsg && <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", color: "#f87171", borderRadius: 10, padding: "12px 14px", fontSize: 14, marginBottom: 16 }}>{errorMsg}</div>}

            {/* NEW: Generic Task Type dropdown */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Type of task <span style={{ color: "#f87171" }}>*</span></label>
              <select name="taskType" value={form.taskType} onChange={handleChange} style={inp} required>
                <option value="">: Select task type :</option>
                {Object.entries(TASK_TYPE_GROUPS).map(([group, types]) => (
                  <optgroup key={group} label={group}>
                    {types.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.icon} {t.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Existing template dropdown */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Task template (category) <span style={{ color: "#f87171" }}>*</span></label>
              {loading ? (
                <div style={{ fontSize: 14, color: "var(--text-muted)", padding: "10px 0" }}>Loading task types...</div>
              ) : (
                <select style={inp} onChange={(e) => handleTemplateChange(e.target.value)} defaultValue="">
                  <option value="" disabled>Select a task type...</option>
                  {Object.entries(grouped).map(([cat, items]) => (
                    <optgroup key={cat} label={cat}>
                      {items.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Task title <span style={{ color: "#f87171" }}>*</span></label>
              <input name="taskTitle" value={form.taskTitle} onChange={handleChange} placeholder="Brief title of what you did" style={inp} />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Full description <span style={{ color: "#f87171" }}>*</span></label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={4}
                placeholder="Describe in detail what you worked on, what was achieved, and any challenges..."
                style={{ ...inp, resize: "none" } as any} />
            </div>

            {/* Time + Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Time spent (hours) <span style={{ color: "#f87171" }}>*</span></label>
                <input name="timeSpent" value={form.timeSpent} onChange={handleChange} type="number" step="0.5" min="0.5" max="12" placeholder="e.g. 2.5" style={inp} />
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select name="status" value={form.status} onChange={handleChange} style={inp}>
                  <option value="SUBMITTED">Completed</option>
                  <option value="DRAFT">In progress</option>
                </select>
              </div>
            </div>

            {/* Priority */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Priority level</label>
              <div style={{ display: "flex", gap: 8 }}>
                {PRIORITY.map((p) => (
                  <button key={p.value} onClick={() => setForm((prev) => ({ ...prev, priority: p.value as any }))}
                    style={{
                      flex: 1, padding: "9px 8px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      background: p.style.bg, color: p.style.color, border: `0.5px solid ${p.style.border}`,
                      opacity: form.priority === p.value ? 1 : 0.5, transition: "opacity 0.15s",
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conditional: case ref */}
            {selectedTemplate?.requiresCaseRef && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ background: "#0c1a2e", border: "0.5px solid #1e3a5f", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "#60a5fa", marginBottom: 10 }}>
                  This task type requires a case or reference number
                </div>
                <label style={lbl}>Case / ticket reference</label>
                <input name="caseReference" value={form.caseReference} onChange={handleChange} placeholder="e.g. S&I-2026-0142" style={inp} />
              </div>
            )}

            {/* Conditional: amount */}
            {selectedTemplate?.requiresAmount && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Amount involved (₦)</label>
                <input name="amountInvolved" value={form.amountInvolved} onChange={handleChange} type="number" placeholder="e.g. 500000" style={inp} />
              </div>
            )}

            {/* Conditional: evidence */}
            {selectedTemplate?.requiresEvidence && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Evidence upload</label>
                <div style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: "18px", textAlign: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Click to upload evidence file</div>
                  <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 4 }}>PDF, Word, Excel, images : max 10MB</div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Additional notes (optional)</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                placeholder="Any notes or context for your supervisor..."
                style={{ ...inp, resize: "none" } as any} />
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 12, paddingTop: 16, borderTop: "0.5px solid var(--border-soft)" }}>
              <button onClick={() => handleSubmit("DRAFT")} disabled={submitLoading}
                style={{ padding: "11px 20px", borderRadius: 10, fontSize: 14, color: "var(--text-muted)", border: "0.5px solid var(--border)", background: "var(--bg-input)", cursor: "pointer" }}>
                Save as draft
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={() => handleSubmit("SUBMITTED")} disabled={submitLoading}
                style={{ padding: "11px 28px", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#4ade80", border: "1.5px solid #22c55e", background: "#052e16", cursor: "pointer" }}>
                {submitLoading ? "Submitting..." : "Submit daily log"}
              </button>
            </div>
          </div>

          {/* Right panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card-bg" style={{ borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14, paddingBottom: 10, borderBottom: "0.5px solid var(--border-soft)" }}>
                Today's submitted logs
              </div>
              {todayLogs.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                  No logs submitted today yet
                </div>
              ) : (
                todayLogs.map((log) => {
                  const ss = STATUS_S[log.status] || STATUS_S.SUBMITTED;
                  return (
                    <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 12, marginBottom: 12, borderBottom: "0.5px solid var(--border-soft)" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: ss.color, flexShrink: 0, marginTop: 5 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>
                          {log.taskTitle.length > 36 ? log.taskTitle.slice(0, 34) + "…" : log.taskTitle}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{log.taskCategory} · {log.timeSpent}h</div>
                        {log.taskType && (
                          <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-hint)" }}>
                            {getTaskTypeIcon(log.taskType)} {getTaskTypeLabel(log.taskType)}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 7, background: ss.bg, color: ss.color, fontWeight: 600, flexShrink: 0 }}>
                        {log.status.charAt(0) + log.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="card-bg" style={{ borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Submission guide</div>
              {[
                "Select the type of task (Documents, Field, etc.)",
                "Choose a task template (category) that matches your work",
                "Give a clear title and full description of what you did",
                "Enter honest time spent : this feeds your KPI score",
                "Attach evidence if required by your task type",
                "Submit before end of day : late submissions are flagged",
              ].map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", color: "var(--accent-text)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
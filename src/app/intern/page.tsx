"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type InternLog = {
  id: string; taskTitle: string; description: string;
  skillsLearned: string | null; supervisorName: string | null;
  hoursSpent: number; status: string; weekNumber: number | null;
  supervisorComment: string | null; createdAt: string;
  user: { name: string; department: { name: string } | null };
};

const STATUS_S: Record<string, { bg: string; color: string; border: string }> = {
  SUBMITTED: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
  APPROVED:  { bg: "#052e16", color: "#4ade80", border: "#14532d" },
  REJECTED:  { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" },
  DRAFT:     { bg: "#1a1d28", color: "#6b7280", border: "#374151" },
};

const EMPTY = { taskTitle: "", description: "", skillsLearned: "", supervisorName: "", hoursSpent: "", weekNumber: "" };

export default function InternPage() {
  const [logs,       setLogs]       = useState<InternLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg,        setMsg]        = useState({ text: "", ok: true });
  const [form,       setForm]       = useState(EMPTY);

  const currentWeek = Math.ceil(
    (new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  useEffect(() => { fetchLogs(); }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res  = await fetch("/api/intern-logs");
      const data = await res.json();
      setLogs(data.logs || []);
    } finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setMsg({ text: "", ok: true });
    try {
      const res  = await fetch("/api/intern-logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          hoursSpent:  parseFloat(form.hoursSpent),
          weekNumber:  parseInt(form.weekNumber) || currentWeek,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "Log submitted successfully.", ok: true });
        setForm(EMPTY); setShowForm(false); fetchLogs();
      } else { setMsg({ text: data.error || "Submission failed.", ok: false }); }
    } finally { setSubmitting(false); }
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const inp = {
    background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "var(--text-primary)",
    outline: "none", width: "100%", boxSizing: "border-box" as const, marginBottom: 14,
  };

  const totalHours = logs.reduce((s, l) => s + l.hoursSpent, 0);
  const approved   = logs.filter((l) => l.status === "APPROVED").length;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              NYSC / IT Intern Log
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · Week {currentWeek}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={() => { setShowForm(true); setMsg({ text: "", ok: true }); }}
              style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              + Submit log
            </button>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
          {[
            { label: "Total logs",    value: logs.length,                    color: "var(--text-primary)" },
            { label: "Approved",      value: approved,                        color: "#4ade80" },
            { label: "Total hours",   value: `${Math.round(totalHours * 10) / 10}h`, color: "#a78bfa" },
            { label: "Current week",  value: `Wk ${currentWeek}`,            color: "#60a5fa" },
          ].map((s) => (
            <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div style={{ background: "#0c1a2e", border: "0.5px solid #1e3a5f", borderRadius: 12, padding: "14px 18px", marginBottom: 22, display: "flex", gap: 12 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>📚</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#60a5fa", marginBottom: 4 }}>
              NYSC / IT Intern Work Log
            </div>
            <div style={{ fontSize: 14, color: "#4b6fa5", lineHeight: 1.6 }}>
              Submit a daily log of your activities, what you learned, your supervising officer, and hours worked.
              Your logs are reviewed by your department Director and contribute to your final FCCPC intern assessment.
            </div>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="card-bg" style={{ borderRadius: 14, padding: 28, marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Submit intern log</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {msg.text && (
              <div style={{ background: msg.ok ? "var(--accent-bg)" : "#1f0707", border: `0.5px solid ${msg.ok ? "var(--accent-border)" : "#7f1d1d"}`, color: msg.ok ? "var(--accent-text)" : "#f87171", borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16 }}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 7 }}>
                    Task / Activity title <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <input style={inp} value={form.taskTitle} onChange={(e) => setForm({ ...form, taskTitle: e.target.value })}
                    placeholder="What did you work on today?" required />
                </div>

                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 7 }}>
                    Full description <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <textarea style={{ ...inp, resize: "none", minHeight: 100 } as any}
                    value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe in detail what you did, how you did it, and what you produced..." required />
                </div>

                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 7 }}>
                    Skills learned today
                  </label>
                  <textarea style={{ ...inp, resize: "none", minHeight: 70 } as any}
                    value={form.skillsLearned} onChange={(e) => setForm({ ...form, skillsLearned: e.target.value })}
                    placeholder="What new skills, knowledge or experience did you gain?" />
                </div>

                <div>
                  <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 7 }}>
                    Supervising officer name
                  </label>
                  <input style={inp} value={form.supervisorName}
                    onChange={(e) => setForm({ ...form, supervisorName: e.target.value })}
                    placeholder="Name of staff who supervised you" />
                </div>

                <div>
                  <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 7 }}>
                    Hours spent <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <input style={inp} type="number" step="0.5" min="0.5" max="12"
                    value={form.hoursSpent} onChange={(e) => setForm({ ...form, hoursSpent: e.target.value })}
                    placeholder="e.g. 7.5" required />
                </div>

                <div>
                  <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 7 }}>
                    Week number
                  </label>
                  <input style={inp} type="number" value={form.weekNumber || currentWeek}
                    onChange={(e) => setForm({ ...form, weekNumber: e.target.value })}
                    placeholder={String(currentWeek)} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: "11px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  style={{ padding: "11px 28px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {submitting ? "Submitting..." : "Submit log"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Logs list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📓</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>No logs yet</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Submit your first daily log using the button above</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {logs.map((log) => {
              const ss = STATUS_S[log.status] || STATUS_S.SUBMITTED;
              return (
                <div key={log.id} className="card-bg" style={{ borderRadius: 14, padding: "20px 22px", borderLeft: `3px solid ${ss.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{log.taskTitle}</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0, marginLeft: 12 }}>
                      {log.weekNumber && (
                        <span style={{ fontSize: 12, color: "var(--text-hint)", fontWeight: 500 }}>Week {log.weekNumber}</span>
                      )}
                      <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 8, background: ss.bg, color: ss.color, border: `0.5px solid ${ss.border}` }}>
                        {log.status.charAt(0) + log.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 12 }}>
                    {log.description}
                  </div>

                  {log.skillsLearned && (
                    <div style={{ background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-text)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Skills learned</div>
                      <div style={{ fontSize: 14, color: "var(--accent-text)", opacity: 0.85, lineHeight: 1.5 }}>{log.skillsLearned}</div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text-hint)" }}>
                    <span style={{ fontWeight: 500 }}>{log.hoursSpent}h worked</span>
                    {log.supervisorName && <span>Supervised by: {log.supervisorName}</span>}
                    <span>{new Date(log.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>

                  {log.supervisorComment && (
                    <div style={{ marginTop: 12, padding: "10px 14px", background: "#0c1a2e", border: "0.5px solid #1e3a5f", borderRadius: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#60a5fa", marginBottom: 4 }}>Director / Supervisor feedback</div>
                      <div style={{ fontSize: 14, color: "#60a5fa", opacity: 0.85, lineHeight: 1.5 }}>{log.supervisorComment}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

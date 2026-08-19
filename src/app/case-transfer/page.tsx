"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type Transfer = {
  id: string;
  caseRef: string;
  caseTitle: string;
  caseType: string;
  description: string;
  fromOffice: string;
  toOffice: string;
  transferType: string;
  priority: string;
  status: string;
  transferNote: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  rejectedReason: string | null;
  completedNote: string | null;
  dueDate: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  initiatedBy: { id: string; name: string; role: string; jobTitle: string | null; department: { name: string } | null };
  acceptedBy:  { id: string; name: string; role: string } | null;
  targetUser:  { id: string; name: string; role: string; jobTitle: string | null } | null;
};

type Stats = { total: number; pendingAcceptance: number; inProgress: number; completed: number };

const OFFICES = [
  "HQ - Abuja",
  "Lagos Zone", "Kano Zone", "Port Harcourt Zone",
  "Enugu Zone", "Ibadan Zone", "Maiduguri Zone",
  "Ilorin", "Asaba", "Uyo", "Jos", "Sokoto",
  "Benin", "Owerri", "Abeokuta",
];

const CASE_TYPES = [
  "Consumer Complaint", "Merger Notification", "Investigation",
  "Anti-Competitive", "Enforcement Action", "Market Surveillance",
  "Inspection", "Compliance Review", "General",
];

const TRANSFER_TYPES = [
  { value: "ZONE_TO_ZONE",       label: "Zone → Zone"          },
  { value: "ZONE_TO_HQ",         label: "Zone → HQ"            },
  { value: "HQ_TO_ZONE",         label: "HQ → Zone"            },
  { value: "INTERSTATE",         label: "Interstate Transfer"   },
  { value: "INTER_DEPARTMENTAL", label: "Inter-Departmental"    },
];

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING_ACCEPTANCE: { bg: "#1c1107", color: "#f59e0b", border: "#78350f", label: "Pending Acceptance" },
  ACCEPTED:           { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", label: "Accepted"           },
  IN_PROGRESS:        { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95", label: "In Progress"        },
  COMPLETED:          { bg: "#052e16", color: "#4ade80", border: "#14532d", label: "Completed ✓"        },
  REJECTED:           { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", label: "Rejected ✗"         },
  RECALLED:           { bg: "#1a1d28", color: "#9ca3af", border: "#374151", label: "Recalled"           },
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#4ade80", MEDIUM: "#60a5fa", HIGH: "#f59e0b", CRITICAL: "#f87171",
};

type Toast = { id: number; text: string; ok: boolean };
let _tid = 0;

function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, minWidth: 300, maxWidth: 420, background: t.ok ? "#052e16" : "#1f0707", border: `1px solid ${t.ok ? "#14532d" : "#7f1d1d"}`, color: t.ok ? "#4ade80" : "#f87171", fontSize: 14, fontWeight: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", pointerEvents: "all" }}>
          <span>{t.ok ? "✓" : "✕"}</span>
          <span style={{ flex: 1 }}>{t.text}</span>
          <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-input)",
  border: "0.5px solid var(--border)",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 15,
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 14,
};

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 7,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CaseTransferPage() {
  const [transfers,    setTransfers]    = useState<Transfer[]>([]);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [offices,      setOffices]      = useState<string[]>(OFFICES);
  const [loading,      setLoading]      = useState(true);
  const [userId,       setUserId]       = useState("");
  const [userRole,     setUserRole]     = useState("");
  const [selected,     setSelected]     = useState<Transfer | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterView,   setFilterView]   = useState<"all"|"sent"|"received">("all");
  const [search,       setSearch]       = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [toasts,       setToasts]       = useState<Toast[]>([]);
  const [actionForm,   setActionForm]   = useState({ rejectedReason: "", completedNote: "" });

  // Staff picker for target user
  const [staffList, setStaffList] = useState<{ id: string; name: string; role: string; jobTitle: string | null }[]>([]);

  const emptyForm = {
    caseRef: "", caseTitle: "", caseType: CASE_TYPES[0],
    description: "", fromOffice: "HQ - Abuja", toOffice: "",
    transferType: "INTER_DEPARTMENTAL", priority: "MEDIUM",
    transferNote: "", targetUserId: "", dueDate: "",
  };
  const [form, setForm] = useState(emptyForm);

  function showToast(text: string, ok = true) {
    const id = ++_tid;
    setToasts((p) => [...p, { id, text, ok }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  }
  function removeToast(id: number) { setToasts((p) => p.filter((t) => t.id !== id)); }

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/case-transfer?view=${filterView}${filterStatus !== "ALL" ? `&status=${filterStatus}` : ""}`;
      const res  = await fetch(url);
      const data = await res.json();
      setTransfers(data.transfers || []);
      setStats(data.stats || null);
      if (data.offices) setOffices(data.offices);
    } finally { setLoading(false); }
  }, [filterView, filterStatus]);

  useEffect(() => {
    fetch("/api/settings/account").then((r) => r.json()).then((d) => {
      if (d.user) { setUserId(d.user.id); setUserRole(d.user.role); }
    });
    fetch("/api/users?limit=500").then((r) => r.json()).then((d) => setStaffList(d.users || []));
    fetchData();
  }, [fetchData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.caseRef || !form.caseTitle || !form.toOffice || !form.transferNote) {
      showToast("Case ref, title, destination office and transfer note are required.", false); return;
    }
    setSubmitting(true);
    try {
      const res  = await fetch("/api/case-transfer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { showToast("Case transfer initiated. Recipients notified."); setForm(emptyForm); setShowForm(false); fetchData(); }
      else          { showToast(data.error || "Failed.", false); }
    } finally { setSubmitting(false); }
  }

  async function handleAction(action: string) {
    if (!selected) return;
    if (action === "reject" && !actionForm.rejectedReason) {
      showToast("Please provide a rejection reason.", false); return;
    }
    setSubmitting(true);
    try {
      const res  = await fetch("/api/case-transfer", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId: selected.id, action, ...actionForm }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Case ${action === "accept" ? "accepted" : action === "complete" ? "marked as completed" : action === "in_progress" ? "marked in progress" : "actioned"}.`);
        setSelected(null); setActionForm({ rejectedReason: "", completedNote: "" }); fetchData();
      } else { showToast(data.error || "Failed.", false); }
    } finally { setSubmitting(false); }
  }

  // ✅ Fixed search: removed non-existent "companyName"
  const filtered = transfers.filter((t) => {
    const q = search.toLowerCase();
    if (q && !t.caseRef.toLowerCase().includes(q) && !t.caseTitle.toLowerCase().includes(q)) return false;
    return true;
  });

  const canSeeAll = ["DIRECTOR","ADMIN","EXECUTIVE"].includes(userRole);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <ToastContainer toasts={toasts} remove={removeToast} />

      <main className="flex-1 p-6 min-w-0">

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Case Transfer
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · Transfer cases between zones, offices and departments
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={() => { setShowForm(!showForm); setSelected(null); }}
              style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              {showForm ? "Cancel" : "+ Initiate transfer"}
            </button>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
            {[
              { label: "Total",           value: stats.total,             color: "var(--text-primary)" },
              { label: "Pending",         value: stats.pendingAcceptance, color: "#f59e0b" },
              { label: "In Progress",     value: stats.inProgress,        color: "#a78bfa" },
              { label: "Completed",       value: stats.completed,         color: "#4ade80" },
            ].map((s) => (
              <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "16px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Create form (modal style – appears inline) */}
        {showForm && (
          <div className="card-bg" style={{ borderRadius: 14, padding: 28, marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
              Initiate Case Transfer
            </h2>
            <form onSubmit={handleCreate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

                <div>
                  <label style={lbl}>Case reference *</label>
                  <input style={inp} value={form.caseRef} onChange={(e) => setForm({ ...form, caseRef: e.target.value })} placeholder="e.g. S&I/LAG/2026/001" required />
                </div>
                <div>
                  <label style={lbl}>Case type</label>
                  <select style={inp} value={form.caseType} onChange={(e) => setForm({ ...form, caseType: e.target.value })}>
                    {CASE_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Case title *</label>
                  <input style={inp} value={form.caseTitle} onChange={(e) => setForm({ ...form, caseTitle: e.target.value })} placeholder="Brief title of the case" required />
                </div>

                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Case description / background</label>
                  <textarea style={{ ...inp, resize: "none", minHeight: 80 } as any} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Provide background, what has been done so far, what needs to be done at the receiving office..." />
                </div>

                <div>
                  <label style={lbl}>From office *</label>
                  <select style={inp} value={form.fromOffice} onChange={(e) => setForm({ ...form, fromOffice: e.target.value })}>
                    {offices.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label style={lbl}>To office / destination *</label>
                  <select style={inp} value={form.toOffice} onChange={(e) => setForm({ ...form, toOffice: e.target.value })} required>
                    <option value="">- Select destination -</option>
                    {offices.filter((o) => o !== form.fromOffice).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label style={lbl}>Transfer type</label>
                  <select style={inp} value={form.transferType} onChange={(e) => setForm({ ...form, transferType: e.target.value })}>
                    {TRANSFER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label style={lbl}>Priority</label>
                  <select style={inp} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical - Urgent</option>
                  </select>
                </div>

                <div>
                  <label style={lbl}>Assign to specific person (optional)</label>
                  <select style={inp} value={form.targetUserId} onChange={(e) => setForm({ ...form, targetUserId: e.target.value })}>
                    <option value="">- No specific person -</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} - {s.jobTitle || s.role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={lbl}>Due date (optional)</label>
                  <input style={inp} type="date" value={form.dueDate} min={new Date().toISOString().split("T")[0]} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>

                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Transfer note / instructions *</label>
                  <textarea style={{ ...inp, resize: "none", minHeight: 100 } as any} value={form.transferNote} onChange={(e) => setForm({ ...form, transferNote: e.target.value })} placeholder="What the receiving office needs to know and do. Be specific about required actions, deadlines and contacts." required />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: "11px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "11px 28px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {submitting ? "Transferring..." : "Initiate transfer"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* View + Status filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          {canSeeAll && (
            <>
              {(["all","sent","received"] as const).map((v) => (
                <button key={v} onClick={() => setFilterView(v)} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer", border: `0.5px solid ${filterView === v ? "var(--accent)" : "var(--border)"}`, background: filterView === v ? "var(--accent-bg)" : "var(--bg-card)", color: filterView === v ? "var(--accent-text)" : "var(--text-muted)" }}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
              <div style={{ width: 1, height: 24, background: "var(--border)" }} />
            </>
          )}
          {["ALL","PENDING_ACCEPTANCE","ACCEPTED","IN_PROGRESS","COMPLETED","REJECTED"].map((s) => {
            const st = STATUS_STYLE[s] || { bg: "var(--bg-card)", color: "var(--text-muted)", border: "var(--border)", label: "All" };
            return (
              <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "8px 18px", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer", border: `0.5px solid ${filterStatus === s ? st.border : "var(--border)"}`, background: filterStatus === s ? st.bg : "var(--bg-card)", color: filterStatus === s ? st.color : "var(--text-muted)" }}>
                {s === "ALL" ? "All statuses" : st.label}
              </button>
            );
          })}
          <input style={{ ...inp, marginBottom: 0, minWidth: 200, flex: 1 }} placeholder="Search case ref or title..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{filtered.length} of {transfers.length}</span>
        </div>

        {/* Two column layout */}
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 16, alignItems: "start" }}>

          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>Loading transfers...</div>
            ) : filtered.length === 0 ? (
              <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 44, marginBottom: 16 }}>📦</div>
                <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>No case transfers found</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Use the button above to initiate a transfer to another zone, office or department.</div>
              </div>
            ) : (
              filtered.map((t) => {
                const ss         = STATUS_STYLE[t.status] || STATUS_STYLE.PENDING_ACCEPTANCE;
                const pc         = PRIORITY_COLOR[t.priority] || "#60a5fa";
                const isSelected = selected?.id === t.id;
                const isMine     = t.initiatedBy.id === userId;
                const isTarget   = t.targetUser?.id === userId;
                const isOverdue  = t.dueDate && !["COMPLETED","REJECTED","RECALLED"].includes(t.status) && new Date(t.dueDate) < new Date();

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelected(isSelected ? null : t)}
                    className="card-bg"
                    style={{
                      borderRadius: 14,
                      padding: "20px 24px",
                      cursor: "pointer",
                      borderLeft: `3px solid ${isSelected ? "var(--accent)" : isOverdue ? "#ef4444" : ss.color}`,
                      outline: `0.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{t.caseRef}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: ss.bg, color: ss.color, border: `0.5px solid ${ss.border}` }}>{ss.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: `${pc}22`, color: pc, border: `0.5px solid ${pc}44` }}>{t.priority}</span>
                          {isMine   && <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, background: "#1a0a2e", color: "#a78bfa", border: "0.5px solid #4c1d95" }}>Sent by you</span>}
                          {isTarget && <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, background: "#052e16", color: "#4ade80", border: "0.5px solid #14532d" }}>Assigned to you</span>}
                          {isOverdue && <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, background: "#1f0707", color: "#f87171", border: "0.5px solid #7f1d1d" }}>⚠ Overdue</span>}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{t.caseTitle}</div>
                        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                          {t.fromOffice} → {t.toOffice} · {t.caseType}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-hint)", marginLeft: 12, flexShrink: 0, textAlign: "right" }}>
                        <div>{fmtDate(t.createdAt).split(",")[0]}</div>
                        {t.dueDate && <div style={{ color: isOverdue ? "#f87171" : "var(--text-hint)" }}>Due: {fmtDate(t.dueDate).split(",")[0]}</div>}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-hint)" }}>
                      By {t.initiatedBy.name} ({t.initiatedBy.jobTitle || t.initiatedBy.role})
                      {t.targetUser && ` → Assigned to ${t.targetUser.name}`}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="card-bg" style={{ borderRadius: 14, padding: 26, position: "sticky", top: 24, maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{selected.caseRef}</div>
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{selected.caseTitle}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>

              {/* Status track */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {["PENDING_ACCEPTANCE","ACCEPTED","IN_PROGRESS","COMPLETED"].map((s, i) => {
                  const st    = STATUS_STYLE[s];
                  const steps = ["PENDING_ACCEPTANCE","ACCEPTED","IN_PROGRESS","COMPLETED"];
                  const curIdx = steps.indexOf(selected.status);
                  const thisIdx = steps.indexOf(s);
                  const done   = curIdx >= thisIdx && !["REJECTED","RECALLED"].includes(selected.status);
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, fontWeight: 600, background: done ? st.bg : "var(--bg-input)", color: done ? st.color : "var(--text-hint)", border: `0.5px solid ${done ? st.border : "var(--border)"}` }}>
                        {st.label.replace(" ✓","").replace(" ✗","")}
                      </div>
                      {i < 3 && <span style={{ color: "var(--text-hint)", fontSize: 14 }}>→</span>}
                    </div>
                  );
                })}
              </div>

              {/* Info grid */}
              <div style={{ marginBottom: 16 }}>
                {[
                  { label: "From",        value: selected.fromOffice },
                  { label: "To",          value: selected.toOffice   },
                  { label: "Type",        value: TRANSFER_TYPES.find((t) => t.value === selected.transferType)?.label || selected.transferType },
                  { label: "Case type",   value: selected.caseType   },
                  { label: "Priority",    value: selected.priority   },
                  { label: "Initiated",   value: `${selected.initiatedBy.name} (${selected.initiatedBy.jobTitle || selected.initiatedBy.role})` },
                  { label: "Date",        value: fmtDate(selected.createdAt) },
                  ...(selected.dueDate   ? [{ label: "Due date",  value: fmtDate(selected.dueDate) }] : []),
                  ...(selected.targetUser ? [{ label: "Assigned to", value: `${selected.targetUser.name} (${selected.targetUser.jobTitle || selected.targetUser.role})` }] : []),
                  ...(selected.acceptedBy ? [{ label: "Actioned by", value: selected.acceptedBy.name }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", width: 100, flexShrink: 0, paddingTop: 2 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Transfer note */}
              <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Transfer note</div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selected.transferNote}</div>
              </div>

              {selected.description && (
                <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Case background</div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selected.description}</div>
                </div>
              )}

              {selected.completedNote && (
                <div style={{ background: "#052e16", border: "0.5px solid #14532d", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#4ade80", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Completion note</div>
                  <div style={{ fontSize: 14, color: "#86efac", lineHeight: 1.7 }}>{selected.completedNote}</div>
                </div>
              )}

              {selected.rejectedReason && (
                <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#f87171", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rejection reason</div>
                  <div style={{ fontSize: 14, color: "#fca5a5", lineHeight: 1.7 }}>{selected.rejectedReason}</div>
                </div>
              )}

              {/* Action buttons */}
              {!["COMPLETED","REJECTED","RECALLED"].includes(selected.status) && (
                <div style={{ paddingTop: 16, borderTop: "0.5px solid var(--border-soft)" }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Update this transfer</div>

                  <label style={lbl}>Rejection reason (required to reject)</label>
                  <input style={inp} value={actionForm.rejectedReason} onChange={(e) => setActionForm({ ...actionForm, rejectedReason: e.target.value })} placeholder="Why are you rejecting this transfer?" />

                  <label style={lbl}>Completion note (required to mark complete)</label>
                  <textarea style={{ ...inp, resize: "none", minHeight: 80 } as any} value={actionForm.completedNote} onChange={(e) => setActionForm({ ...actionForm, completedNote: e.target.value })} placeholder="What was done, outcome, next steps..." />

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                    {selected.status === "PENDING_ACCEPTANCE" && (
                      <button onClick={() => handleAction("accept")} disabled={submitting} style={{ flex: 1, padding: "11px", borderRadius: 9, border: "1.5px solid #60a5fa", background: "#0c1a2e", color: "#60a5fa", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                        ✓ Accept
                      </button>
                    )}
                    {["ACCEPTED","PENDING_ACCEPTANCE"].includes(selected.status) && (
                      <button onClick={() => handleAction("in_progress")} disabled={submitting} style={{ flex: 1, padding: "11px", borderRadius: 9, border: "1.5px solid #a78bfa", background: "#1a0a2e", color: "#a78bfa", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                        🔄 In Progress
                      </button>
                    )}
                    {["ACCEPTED","IN_PROGRESS"].includes(selected.status) && (
                      <button onClick={() => handleAction("complete")} disabled={submitting} style={{ flex: 1, padding: "11px", borderRadius: 9, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                        ✅ Complete
                      </button>
                    )}
                    {selected.status === "PENDING_ACCEPTANCE" && (
                      <button onClick={() => handleAction("reject")} disabled={submitting} style={{ flex: 1, padding: "11px", borderRadius: 9, border: "1.5px solid #f87171", background: "#1f0707", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                        ✗ Reject
                      </button>
                    )}
                    {selected.initiatedBy.id === userId && selected.status === "PENDING_ACCEPTANCE" && (
                      <button onClick={() => handleAction("recall")} disabled={submitting} style={{ flex: 1, padding: "11px", borderRadius: 9, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>
                        ↩ Recall
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selected.status === "COMPLETED" && (
                <div style={{ textAlign: "center", padding: 14, background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", borderRadius: 10, color: "var(--accent-text)", fontSize: 15, fontWeight: 600 }}>
                  ✅ Case transfer completed
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
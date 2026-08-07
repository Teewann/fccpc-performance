"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type LeaveRequest = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  approverComment: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
    department: { name: string } | null;
  };
};

const LEAVE_TYPES = [
  { value: "ANNUAL",    label: "Annual leave"    },
  { value: "SICK",      label: "Sick leave"      },
  { value: "MATERNITY", label: "Maternity leave" },
  { value: "PATERNITY", label: "Paternity leave" },
  { value: "CASUAL",    label: "Casual leave"    },
  { value: "STUDY",     label: "Study leave"     },
];

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  PENDING:  { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
  APPROVED: { bg: "#052e16", color: "#4ade80", border: "#14532d" },
  REJECTED: { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" },
};

const EMPTY_FORM = { type: "ANNUAL", startDate: "", endDate: "", reason: "" };

export default function LeavePage() {
  const [requests,   setRequests]   = useState<LeaveRequest[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [userRole,   setUserRole]   = useState("");
  const [showForm,   setShowForm]   = useState(false);
  const [selected,   setSelected]   = useState<LeaveRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [comment,    setComment]    = useState("");
  const [filter,     setFilter]     = useState("ALL");
  const [msg,        setMsg]        = useState({ text: "", ok: true });
  const [form,       setForm]       = useState(EMPTY_FORM);

  useEffect(() => {
    fetchRequests();
    fetchRole();
  }, []);

  async function fetchRole() {
    const res  = await fetch("/api/settings/account");
    const data = await res.json();
    if (data.user) setUserRole(data.user.role);
  }

  async function fetchRequests() {
    setLoading(true);
    try {
      const res  = await fetch("/api/leave");
      const data = await res.json();
      setRequests(data.requests || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg({ text: "", ok: true });
    try {
      const res  = await fetch("/api/leave", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "Leave request submitted successfully. Your Director will be notified.", ok: true });
        setForm(EMPTY_FORM);
        setShowForm(false);
        fetchRequests();
      } else {
        setMsg({ text: data.error || "Failed to submit.", ok: false });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(requestId: string, status: "APPROVED" | "REJECTED") {
    setSubmitting(true);
    try {
      const res  = await fetch("/api/leave", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ requestId, status, approverComment: comment }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelected(null);
        setComment("");
        fetchRequests();
      } else {
        alert(data.error || "Action failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isPrivileged = ["DIRECTOR", "HR", "ADMIN", "EXECUTIVE"].includes(userRole);

  const filtered =
    filter === "ALL"
      ? requests
      : requests.filter((r) => r.status === filter);

  const counts = {
    ALL:      requests.length,
    PENDING:  requests.filter((r) => r.status === "PENDING").length,
    APPROVED: requests.filter((r) => r.status === "APPROVED").length,
    REJECTED: requests.filter((r) => r.status === "REJECTED").length,
  };

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

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

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Leave Management
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · {isPrivileged ? "Review your department leave requests" : "Apply for and track your leave"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {!isPrivileged && (
              <button
                onClick={() => { setShowForm(!showForm); setMsg({ text: "", ok: true }); }}
                style={{
                  padding: "10px 22px", borderRadius: 10,
                  border: "1.5px solid #22c55e", background: "#052e16",
                  color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                {showForm ? "Cancel" : "+ Apply for leave"}
              </button>
            )}
            <ThemeToggleButton />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
          {[
            { label: "Total",    value: counts.ALL,      color: "var(--text-primary)" },
            { label: "Pending",  value: counts.PENDING,  color: "#60a5fa" },
            { label: "Approved", value: counts.APPROVED, color: "#4ade80" },
            { label: "Rejected", value: counts.REJECTED, color: "#f87171" },
          ].map((s) => (
            <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Apply form */}
        {showForm && !isPrivileged && (
          <div className="card-bg" style={{ borderRadius: 14, padding: 28, marginBottom: 22 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
              Apply for leave
            </h2>

            {msg.text && (
              <div style={{
                background: msg.ok ? "var(--accent-bg)" : "#1f0707",
                border: `0.5px solid ${msg.ok ? "var(--accent-border)" : "#7f1d1d"}`,
                color: msg.ok ? "var(--accent-text)" : "#f87171",
                borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16,
              }}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label style={lbl}>Leave type <span style={{ color: "#f87171" }}>*</span></label>
              <select
                style={inp}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={lbl}>Start date <span style={{ color: "#f87171" }}>*</span></label>
                  <input
                    style={inp} type="date"
                    value={form.startDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={lbl}>End date <span style={{ color: "#f87171" }}>*</span></label>
                  <input
                    style={inp} type="date"
                    value={form.endDate}
                    min={form.startDate || new Date().toISOString().split("T")[0]}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <label style={lbl}>Reason <span style={{ color: "#f87171" }}>*</span></label>
              <textarea
                style={{ ...inp, resize: "none", minHeight: 90 } as any}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="State your reason for leave clearly..."
                required
              />

              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{ padding: "11px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={submitting}
                  style={{ padding: "11px 28px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Submitting..." : "Submit request"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "9px 18px", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer",
                border: `0.5px solid ${filter === f ? "var(--accent)" : "var(--border)"}`,
                background: filter === f ? "var(--accent-bg)" : "var(--bg-card)",
                color: filter === f ? "var(--accent-text)" : "var(--text-muted)",
              }}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()} ({counts[f]})
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 16 }}>

          {/* Request list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>
                Loading requests...
              </div>
            ) : filtered.length === 0 ? (
              <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>🌴</div>
                <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  No leave requests
                </div>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  {isPrivileged
                    ? "No leave requests from your department yet"
                    : "You have not applied for leave. Click the button above to apply."}
                </div>
              </div>
            ) : (
              filtered.map((req) => {
                const ss  = STATUS_STYLE[req.status] || STATUS_STYLE.PENDING;
                const sel = selected?.id === req.id;
                const lt  = LEAVE_TYPES.find((t) => t.value === req.type)?.label || req.type;

                return (
                  <div
                    key={req.id}
                    onClick={() => { setSelected(sel ? null : req); setComment(""); }}
                    className="card-bg"
                    style={{
                      borderRadius: 14, padding: "18px 22px", cursor: "pointer",
                      borderLeft: `3px solid ${sel ? "var(--accent)" : ss.color}`,
                      outline: `0.5px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>
                          {lt}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                          {isPrivileged ? `${req.user.name} · ${req.user.department?.name || "No dept"}` : "My request"}
                          {" · "}{req.days} working {req.days === 1 ? "day" : "days"}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 8,
                        background: ss.bg, color: ss.color, border: `0.5px solid ${ss.border}`,
                        flexShrink: 0, marginLeft: 12,
                      }}>
                        {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 24, fontSize: 13, color: "var(--text-hint)", marginBottom: 8 }}>
                      <span>
                        📅 {new Date(req.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {" → "}
                        {new Date(req.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span>
                        Applied {new Date(req.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    </div>

                    <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {req.reason.length > 100 ? req.reason.slice(0, 98) + "…" : req.reason}
                    </div>

                    {req.approverComment && (
                      <div style={{ marginTop: 10, padding: "8px 12px", background: req.status === "APPROVED" ? "var(--accent-bg)" : "#1f0707", border: `0.5px solid ${req.status === "APPROVED" ? "var(--accent-border)" : "#7f1d1d"}`, borderRadius: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: req.status === "APPROVED" ? "var(--accent-text)" : "#f87171", marginBottom: 3 }}>
                          Reviewer comment
                        </div>
                        <div style={{ fontSize: 13, color: req.status === "APPROVED" ? "var(--accent-text)" : "#f87171", opacity: 0.85 }}>
                          {req.approverComment}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Review panel — only for privileged users on PENDING requests */}
          {selected && (
            <div className="card-bg" style={{ borderRadius: 14, padding: 24, alignSelf: "start", position: "sticky", top: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
                  {isPrivileged ? "Review request" : "Request detail"}
                </h3>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>

              {/* Summary */}
              <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px", marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                  {LEAVE_TYPES.find((t) => t.value === selected.type)?.label || selected.type}
                </div>
                {isPrivileged && (
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 8 }}>
                    {selected.user.name} · {selected.user.department?.name}
                  </div>
                )}
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>
                  {new Date(selected.startDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                  {" → "}
                  {new Date(selected.endDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                  {selected.days} working {selected.days === 1 ? "day" : "days"}
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Reason
                </div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                  {selected.reason}
                </div>
              </div>

              {/* Review actions — only privileged + only PENDING */}
              {isPrivileged && selected.status === "PENDING" && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 7 }}>
                      Comment (optional)
                    </label>
                    <textarea
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment for the staff member..."
                      style={{
                        width: "100%", background: "var(--bg-input)",
                        border: "0.5px solid var(--border)", borderRadius: 10,
                        padding: "11px 14px", fontSize: 14,
                        color: "var(--text-primary)", outline: "none",
                        resize: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button
                      onClick={() => handleReview(selected.id, "APPROVED")}
                      disabled={submitting}
                      style={{
                        padding: "12px", borderRadius: 10,
                        border: "0.5px solid #14532d", background: "#052e16",
                        color: "#4ade80", fontSize: 14, fontWeight: 600,
                        cursor: submitting ? "not-allowed" : "pointer",
                      }}
                    >
                      {submitting ? "..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleReview(selected.id, "REJECTED")}
                      disabled={submitting}
                      style={{
                        padding: "12px", borderRadius: 10,
                        border: "0.5px solid #7f1d1d", background: "#1f0707",
                        color: "#f87171", fontSize: 14, fontWeight: 600,
                        cursor: submitting ? "not-allowed" : "pointer",
                      }}
                    >
                      {submitting ? "..." : "Reject"}
                    </button>
                  </div>
                </>
              )}

              {/* Already reviewed */}
              {selected.status !== "PENDING" && (
                <div style={{
                  textAlign: "center", padding: "12px",
                  borderRadius: 10, fontSize: 14, fontWeight: 500,
                  background: (STATUS_STYLE[selected.status] || STATUS_STYLE.PENDING).bg,
                  color: (STATUS_STYLE[selected.status] || STATUS_STYLE.PENDING).color,
                  border: `0.5px solid ${(STATUS_STYLE[selected.status] || STATUS_STYLE.PENDING).border}`,
                }}>
                  This request has been {selected.status.toLowerCase()}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


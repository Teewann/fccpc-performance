"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

// ─── Types ────────────────────────────────────────────────────────────
type PaymentItem = {
  id: string;
  caseReference: string;
  caseType: string;
  companyName: string;
  expectedAmount: number;
  actualAmount: number | null;
  currency: string;
  notes: string | null;
  status: "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED" | "PARTIALLY_PAID" | "OVERPAID";
  bankReference: string | null;
  paymentDate: string | null;
  financeNotes: string | null;
  rejectionReason: string | null;
  documentUrl: string | null;
  documentName: string | null;
  createdAt: string;
  raisedBy: { name: string; role: string; department: { name: string } | null };
  confirmedBy: { name: string; role: string } | null;
};

type Stats = {
  total: number;
  pendingConfirmation: number;
  confirmed: number;
  rejected: number;
  totalExpected: number;
  totalConfirmed: number;
};

// ─── Constants ────────────────────────────────────────────────────────
const CASE_TYPES = [
  "Merger Notification Fee",
  "Acquisition Filing Fee",
  "Administrative Fine",
  "Consent Order Payment",
  "Penalty - Competition",
  "Penalty - Consumer Protection",
  "Licence Fee",
  "Cost Recovery",
  "Forfeiture",
  "Other",
];

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING_CONFIRMATION: { bg: "#1c1107", color: "#f59e0b", border: "#78350f", label: "Awaiting Finance" },
  CONFIRMED:            { bg: "#052e16", color: "#4ade80", border: "#14532d", label: "Confirmed ✓"       },
  REJECTED:             { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", label: "Rejected ✗"        },
  PARTIALLY_PAID:       { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", label: "Partial Payment"   },
  OVERPAID:             { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95", label: "Overpaid"          },
};

// ─── Helpers ──────────────────────────────────────────────────────────
function formatNGN(n: number) {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n.toLocaleString()}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Toast
type Toast = { id: number; text: string; ok: boolean };
let _tid = 0;
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  function show(text: string, ok = true) {
    const id = ++_tid;
    setToasts((p) => [...p, { id, text, ok }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  }
  function remove(id: number) { setToasts((p) => p.filter((t) => t.id !== id)); }
  return { toasts, show, remove };
}

function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, minWidth: 300, maxWidth: 420, background: t.ok ? "#052e16" : "#1f0707", border: `1px solid ${t.ok ? "#14532d" : "#7f1d1d"}`, color: t.ok ? "#4ade80" : "#f87171", fontSize: 14, fontWeight: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", pointerEvents: "all" }}>
          <span style={{ fontSize: 18 }}>{t.ok ? "✓" : "✕"}</span>
          <span style={{ flex: 1 }}>{t.text}</span>
          <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
  borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "var(--text-primary)",
  outline: "none", boxSizing: "border-box", marginBottom: 12,
};
const lbl: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 5,
};

// ─── Main Page ────────────────────────────────────────────────────────
export default function PaymentWorkflowPage() {
  const { toasts, show, remove } = useToast();
  const [items,       setItems]       = useState<PaymentItem[]>([]);
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [userDept,    setUserDept]    = useState("");
  const [userRole,    setUserRole]    = useState("");
  const [loading,     setLoading]     = useState(true);
  const [filterStatus,setFilterStatus]= useState("ALL");
  const [search,      setSearch]      = useState("");
  const [showForm,    setShowForm]    = useState(false);
  const [selected,    setSelected]    = useState<PaymentItem | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  // Raise form state
  const emptyForm = { caseReference: "", caseType: CASE_TYPES[0], companyName: "", expectedAmount: "", notes: "", documentUrl: "", documentName: "" };
  const [form, setForm] = useState(emptyForm);

  // Confirm/reject form
  const [confirmForm, setConfirmForm] = useState({ action: "", actualAmount: "", bankReference: "", paymentDate: "", financeNotes: "", rejectionReason: "" });

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/payment-workflow");
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats || null);
      setUserDept(data.userDept || "");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // Get user role
    fetch("/api/settings/account").then((r) => r.json()).then((d) => {
      if (d.user) setUserRole(d.user.role);
    });
    fetchData();
  }, [fetchData]);

  const isFinance  = userDept.toLowerCase().includes("finance");
  const isEVCorAdmin = userRole === "EXECUTIVE" || userRole === "ADMIN";
  const canRaise   = ["DIRECTOR","SUPERVISOR","STAFF","HR","ADMIN","EXECUTIVE"].includes(userRole);
  const canConfirm = isFinance || isEVCorAdmin;

  const filtered = items.filter((item) => {
    if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
    const q = search.toLowerCase();
    if (q && !item.caseReference.toLowerCase().includes(q) && !item.companyName.toLowerCase().includes(q)) return false;
    return true;
  });

  async function handleRaise(e: React.FormEvent) {
    e.preventDefault();
    if (!form.caseReference || !form.companyName || !form.expectedAmount) {
      show("Case reference, company name and expected amount are required.", false); return;
    }
    setSubmitting(true);
    try {
      const res  = await fetch("/api/payment-workflow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, expectedAmount: Number(form.expectedAmount) }),
      });
      const data = await res.json();
      if (res.ok) {
        show("Payment confirmation request raised. Finance has been notified.");
        setForm(emptyForm); setShowForm(false); fetchData();
      } else { show(data.error || "Failed to raise request.", false); }
    } finally { setSubmitting(false); }
  }

  async function handleConfirm(action: string) {
    if (!selected) return;
    if (action === "reject" && !confirmForm.rejectionReason) {
      show("Please provide a rejection reason.", false); return;
    }
    if ((action === "confirm" || action === "partial") && !confirmForm.actualAmount) {
      show("Please enter the actual amount received.", false); return;
    }
    setSubmitting(true);
    try {
      const res  = await fetch("/api/payment-workflow", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selected.id, action,
          actualAmount:    confirmForm.actualAmount ? Number(confirmForm.actualAmount) : undefined,
          bankReference:   confirmForm.bankReference  || undefined,
          paymentDate:     confirmForm.paymentDate    || undefined,
          financeNotes:    confirmForm.financeNotes   || undefined,
          rejectionReason: confirmForm.rejectionReason || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        show(action === "confirm" ? "Payment confirmed. M&A has been notified." : action === "reject" ? "Payment rejected. M&A has been notified." : "Partial payment recorded.");
        setSelected(null);
        setConfirmForm({ action: "", actualAmount: "", bankReference: "", paymentDate: "", financeNotes: "", rejectionReason: "" });
        fetchData();
      } else { show(data.error || "Failed.", false); }
    } finally { setSubmitting(false); }
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <ToastContainer toasts={toasts} remove={remove} />

      <main className="flex-1 p-6 min-w-0">

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Payment Workflow</h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · M&A ↔ Finance payment confirmation chain
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {canRaise && (
              <button onClick={() => { setShowForm(!showForm); setSelected(null); }} style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                {showForm ? "Cancel" : "+ Raise payment request"}
              </button>
            )}
            <ThemeToggleButton />
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Total requests",    value: stats.total,               color: "var(--text-primary)" },
              { label: "Awaiting Finance",  value: stats.pendingConfirmation, color: "#f59e0b" },
              { label: "Confirmed",         value: stats.confirmed,           color: "#22c55e" },
              { label: "Rejected",          value: stats.rejected,            color: "#ef4444" },
              { label: "Total expected",    value: formatNGN(stats.totalExpected),  color: "#60a5fa" },
              { label: "Total confirmed",   value: formatNGN(stats.totalConfirmed), color: "#4ade80" },
            ].map((s) => (
              <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Finance alert banner */}
        {canConfirm && stats && stats.pendingConfirmation > 0 && (
          <div style={{ background: "#1c1107", border: "1.5px solid #f59e0b", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#f59e0b" }}>
                {stats.pendingConfirmation} payment{stats.pendingConfirmation !== 1 ? "s" : ""} awaiting your confirmation
              </div>
              <div style={{ fontSize: 13, color: "#78350f" }}>Review and confirm or reject below to unblock the affected cases</div>
            </div>
          </div>
        )}

        {/* Raise request form */}
        {showForm && canRaise && (
          <div className="card-bg" style={{ borderRadius: 14, padding: 28, marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
              Raise Payment Confirmation Request
            </h2>
            <form onSubmit={handleRaise}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={lbl}>Case reference *</label>
                  <input style={inp} value={form.caseReference} onChange={(e) => setForm({ ...form, caseReference: e.target.value })} placeholder="e.g. M&A/2026/001" required />
                </div>
                <div>
                  <label style={lbl}>Case type *</label>
                  <select style={inp} value={form.caseType} onChange={(e) => setForm({ ...form, caseType: e.target.value })}>
                    {CASE_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Company / party name *</label>
                  <input style={inp} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="e.g. XYZ Limited" required />
                </div>
                <div>
                  <label style={lbl}>Expected amount (₦) *</label>
                  <input style={inp} type="number" min="1" value={form.expectedAmount} onChange={(e) => setForm({ ...form, expectedAmount: e.target.value })} placeholder="e.g. 5000000" required />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Additional notes (case details, instructions for Finance)</label>
                  <textarea style={{ ...inp, resize: "none", minHeight: 80 } as any} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any extra context Finance needs to know..." />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: "10px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "10px 28px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {submitting ? "Raising..." : "Raise request - notify Finance"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...inp, marginBottom: 0, minWidth: 240, flex: 1 }} placeholder="Search case ref or company..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {(["ALL","PENDING_CONFIRMATION","CONFIRMED","REJECTED","PARTIALLY_PAID"] as const).map((s) => {
            const st = STATUS_STYLE[s] || { bg: "var(--bg-card)", color: "var(--text-muted)", border: "var(--border)", label: "All" };
            return (
              <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: "pointer", border: `0.5px solid ${filterStatus === s ? st.border : "var(--border)"}`, background: filterStatus === s ? st.bg : "var(--bg-card)", color: filterStatus === s ? st.color : "var(--text-muted)" }}>
                {s === "ALL" ? "All" : st.label}
              </button>
            );
          })}
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{filtered.length} of {items.length}</span>
        </div>

        {/* Two-column when item selected */}
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 16, alignItems: "start" }}>

          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>💳</div>
                <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>No payment requests found</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  {canRaise ? "Use the button above to raise a new payment confirmation request." : "No requests in the system yet."}
                </div>
              </div>
            ) : (
              filtered.map((item) => {
                const ss = STATUS_STYLE[item.status] || STATUS_STYLE.PENDING_CONFIRMATION;
                const isSelected = selected?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelected(isSelected ? null : item)}
                    className="card-bg"
                    style={{ borderRadius: 14, padding: "18px 22px", cursor: "pointer", borderLeft: `3px solid ${isSelected ? "var(--accent)" : ss.color}`, outline: `0.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`, transition: "all 0.15s" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{item.companyName}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: ss.bg, color: ss.color, border: `0.5px solid ${ss.border}` }}>{ss.label}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                          {item.caseReference} · {item.caseType}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 4 }}>
                          Raised by {item.raisedBy.name} · {item.raisedBy.department?.name || item.raisedBy.role} · {fmtDate(item.createdAt)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{formatNGN(item.expectedAmount)}</div>
                        {item.actualAmount && (
                          <div style={{ fontSize: 13, fontWeight: 600, color: item.actualAmount >= item.expectedAmount ? "#4ade80" : "#f59e0b", marginTop: 2 }}>
                            Actual: {formatNGN(item.actualAmount)}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "var(--text-hint)", marginTop: 2 }}>Expected</div>
                      </div>
                    </div>

                    {item.status === "CONFIRMED" && item.confirmedBy && (
                      <div style={{ fontSize: 12, color: "#4ade80", marginTop: 4 }}>
                        ✓ Confirmed by {item.confirmedBy.name}{item.bankReference ? ` · Ref: ${item.bankReference}` : ""}
                      </div>
                    )}
                    {item.status === "REJECTED" && item.rejectionReason && (
                      <div style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>
                        ✗ Rejected: {item.rejectionReason}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="card-bg" style={{ borderRadius: 14, padding: 24, position: "sticky", top: 24, maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{selected.companyName}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{selected.caseReference}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>

              {/* Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Case type",      value: selected.caseType },
                  { label: "Status",         value: STATUS_STYLE[selected.status]?.label || selected.status },
                  { label: "Expected",       value: formatNGN(selected.expectedAmount) },
                  { label: "Actual",         value: selected.actualAmount ? formatNGN(selected.actualAmount) : "-" },
                  { label: "Raised by",      value: `${selected.raisedBy.name} (${selected.raisedBy.department?.name || selected.raisedBy.role})` },
                  { label: "Date raised",    value: fmtDate(selected.createdAt) },
                  ...(selected.bankReference ? [{ label: "Bank reference", value: selected.bankReference }] : []),
                  ...(selected.paymentDate   ? [{ label: "Payment date",   value: fmtDate(selected.paymentDate) }] : []),
                  ...(selected.confirmedBy   ? [{ label: "Confirmed by",   value: selected.confirmedBy.name }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", width: 110, flexShrink: 0, paddingTop: 1 }}>{label}</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{value}</div>
                  </div>
                ))}
              </div>

              {selected.notes && (
                <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes from raiser</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{selected.notes}</div>
                </div>
              )}

              {selected.financeNotes && (
                <div style={{ background: "#052e16", border: "0.5px solid #14532d", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#4ade80", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Finance notes</div>
                  <div style={{ fontSize: 13, color: "#86efac", lineHeight: 1.6 }}>{selected.financeNotes}</div>
                </div>
              )}

              {selected.rejectionReason && (
                <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#f87171", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rejection reason</div>
                  <div style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.6 }}>{selected.rejectionReason}</div>
                </div>
              )}

              {/* Finance confirm/reject form */}
              {canConfirm && selected.status === "PENDING_CONFIRMATION" && (
                <div style={{ paddingTop: 16, borderTop: "0.5px solid var(--border-soft)" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Finance action</div>

                  <label style={lbl}>Actual amount received (₦)</label>
                  <input style={inp} type="number" min="0" value={confirmForm.actualAmount} onChange={(e) => setConfirmForm({ ...confirmForm, actualAmount: e.target.value })} placeholder="Enter actual amount received" />

                  <label style={lbl}>Bank payment reference</label>
                  <input style={inp} value={confirmForm.bankReference} onChange={(e) => setConfirmForm({ ...confirmForm, bankReference: e.target.value })} placeholder="e.g. FBN/2026/0001234" />

                  <label style={lbl}>Payment date</label>
                  <input style={inp} type="date" value={confirmForm.paymentDate} onChange={(e) => setConfirmForm({ ...confirmForm, paymentDate: e.target.value })} />

                  <label style={lbl}>Finance notes (optional)</label>
                  <textarea style={{ ...inp, resize: "none", minHeight: 60 } as any} value={confirmForm.financeNotes} onChange={(e) => setConfirmForm({ ...confirmForm, financeNotes: e.target.value })} placeholder="Any notes for M&A..." />

                  <label style={lbl}>Rejection reason (required if rejecting)</label>
                  <input style={inp} value={confirmForm.rejectionReason} onChange={(e) => setConfirmForm({ ...confirmForm, rejectionReason: e.target.value })} placeholder="Reason for rejection..." />

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => handleConfirm("confirm")} disabled={submitting} style={{ flex: 1, padding: "10px 16px", borderRadius: 9, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      ✓ Confirm payment
                    </button>
                    <button onClick={() => handleConfirm("partial")} disabled={submitting} style={{ flex: 1, padding: "10px 16px", borderRadius: 9, border: "1.5px solid #60a5fa", background: "#0c1a2e", color: "#60a5fa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      ⚠ Partial
                    </button>
                    <button onClick={() => handleConfirm("reject")} disabled={submitting} style={{ flex: 1, padding: "10px 16px", borderRadius: 9, border: "1.5px solid #f87171", background: "#1f0707", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      ✗ Reject
                    </button>
                  </div>
                </div>
              )}

              {selected.status === "CONFIRMED" && (
                <div style={{ textAlign: "center", padding: 14, background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", borderRadius: 10, color: "var(--accent-text)", fontSize: 14, fontWeight: 600 }}>
                  ✅ Payment confirmed - M&A may proceed with case treatment
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
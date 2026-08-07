"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type Dashboard = {
  totalBiz: number; activeBiz: number; pendingVerification: number;
  totalRevenue: number; pendingPayments: number;
  overdueReports: number; unpaidFines: number;
  recentRegistrations: any[]; recentPayments: any[];
};
type Business = {
  id: string; businessName: string; rcNumber: string; sector: string;
  email: string; phone: string; address: string; state: string;
  contactPerson: string; contactRole: string; status: string;
  registrationFee: number; feePaid: boolean;
  createdAt: string; verifiedAt: string | null;
  _count?: { complianceReports: number; fines: number; payments: number };
};
type Fine    = { id: string; reason: string; amount: number; status: string; dueDate: string; business: { businessName: string; sector: string } };
type Payment = { id: string; amount: number; type: string; reference: string; status: string; createdAt: string; business: { businessName: string } };

const SECTORS = ["TELECOMMUNICATIONS","BANKING_FINANCE","RETAIL_ECOMMERCE","MANUFACTURING","INSURANCE","ENERGY_UTILITIES","HEALTHCARE","TRANSPORTATION","HOSPITALITY","TECHNOLOGY","MEDIA","OTHER"];

const SS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING_VERIFICATION: { bg: "#1c1107", color: "#f59e0b", border: "#78350f", label: "Pending"   },
  ACTIVE:               { bg: "#052e16", color: "#4ade80", border: "#14532d", label: "Active"    },
  SUSPENDED:            { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", label: "Suspended" },
  REVOKED:              { bg: "#1a1d28", color: "#9ca3af", border: "#374151", label: "Revoked"   },
};
const FS: Record<string, { bg: string; color: string; border: string }> = {
  UNPAID:   { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" },
  PARTIAL:  { bg: "#1c1107", color: "#f59e0b", border: "#78350f" },
  PAID:     { bg: "#052e16", color: "#4ade80", border: "#14532d" },
  WAIVED:   { bg: "#1a1d28", color: "#9ca3af", border: "#374151" },
  DISPUTED: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
};
const PL: Record<string, string> = {
  REGISTRATION_FEE: "Registration fee", ANNUAL_RENEWAL: "Annual renewal",
  FINE_PAYMENT: "Fine payment",         PROCESSING_FEE: "Processing fee",
};

function fmt(n: number) { return `₦${n.toLocaleString("en-NG")}`; }
function fmtD(s: string) { return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }

const inp: React.CSSProperties = { width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "var(--text-primary)", outline: "none", boxSizing: "border-box" as const, marginBottom: 12 };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" };

const EMPTY = { businessName:"", rcNumber:"", tin:"", sector:"TELECOMMUNICATIONS", email:"", phone:"", address:"", state:"Abuja", contactPerson:"", contactRole:"", password:"", registrationFee:"50000" };
const EMPTY_FINE = { businessId:"", reason:"", amount:"", dueDate:"", notes:"" };

export default function CompliancePortalPage() {
  const [tab,          setTab]          = useState<"dashboard"|"businesses"|"fines"|"payments">("dashboard");
  const [dashboard,    setDashboard]    = useState<Dashboard | null>(null);
  const [businesses,   setBusinesses]   = useState<Business[]>([]);
  const [fines,        setFines]        = useState<Fine[]>([]);
  const [payments,     setPayments]     = useState<Payment[]>([]);
  const [selected,     setSelected]     = useState<Business | null>(null);
  const [detail,       setDetail]       = useState<any | null>(null);
  const [tabLoading,   setTabLoading]   = useState(false);
  const [showReg,      setShowReg]      = useState(false);
  const [showFine,     setShowFine]     = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [msg,          setMsg]          = useState({ text: "", ok: true });
  const [search,       setSearch]       = useState("");
  const [filterSt,     setFilterSt]     = useState("ALL");
  const [form,         setForm]         = useState(EMPTY);
  const [fineForm,     setFineForm]     = useState(EMPTY_FINE);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // ── Always load businesses on mount so dropdown is populated ─────────
  const loadBusinesses = useCallback(async (q?: string, st?: string) => {
    try {
      const p = new URLSearchParams({ view: "businesses" });
      if (q?.trim()) p.set("search", q.trim());
      if (st && st !== "ALL") p.set("status", st);
      const res  = await fetch(`/api/compliance-portal?${p}`);
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch { setBusinesses([]); }
  }, []);

  // Load businesses immediately on mount — critical for the dropdown
  useEffect(() => { loadBusinesses(); }, [loadBusinesses]);

  useEffect(() => {
    const run = async () => {
      setTabLoading(true);
      try {
        if (tab === "dashboard") {
          const res  = await fetch("/api/compliance-portal?view=dashboard");
          const data = await res.json();
          setDashboard(data.dashboard || null);
        }
        if (tab === "businesses") await loadBusinesses(search, filterSt);
        if (tab === "fines") {
          const res  = await fetch("/api/compliance-portal?view=fines");
          const data = await res.json();
          setFines(data.fines || []);
        }
        if (tab === "payments") {
          const res  = await fetch("/api/compliance-portal?view=payments");
          const data = await res.json();
          setPayments(data.payments || []);
        }
      } finally { setTabLoading(false); }
    };
    run();
  }, [tab]); // eslint-disable-line

  useEffect(() => {
    if (tab !== "businesses") return;
    const t = setTimeout(() => loadBusinesses(search, filterSt), 300);
    return () => clearTimeout(t);
  }, [search, filterSt, tab, loadBusinesses]);

  // ── Register business ─────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!form.businessName.trim() || !form.rcNumber.trim() || !form.email.trim() || !form.password.trim()) {
      setMsg({ text: "Please fill all required fields.", ok: false }); return;
    }
    setSubmitting(true); setMsg({ text: "", ok: true });
    try {
      const res  = await fetch("/api/compliance-portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register_business", ...form }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: `✓ ${form.businessName} registered. Invoice for ${fmt(parseInt(form.registrationFee))} generated.`, ok: true });
        setForm(EMPTY); setShowReg(false);
        loadBusinesses();
        // Refresh dashboard
        const dr = await fetch("/api/compliance-portal?view=dashboard");
        const dd = await dr.json();
        setDashboard(dd.dashboard || null);
      } else { setMsg({ text: data.error || "Registration failed.", ok: false }); }
    } catch { setMsg({ text: "Network error. Is the server running?", ok: false }); }
    finally { setSubmitting(false); }
  }

  // ── Issue fine ────────────────────────────────────────────────────
  async function handleIssueFine(e: React.FormEvent) {
    e.preventDefault();
    if (!fineForm.businessId || !fineForm.reason || !fineForm.amount || !fineForm.dueDate) {
      setMsg({ text: "All fine fields are required.", ok: false }); return;
    }
    setSubmitting(true); setMsg({ text: "", ok: true });
    try {
      const res  = await fetch("/api/compliance-portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issue_fine", ...fineForm }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: `✓ Fine of ${fmt(parseFloat(fineForm.amount))} issued.`, ok: true });
        setFineForm(EMPTY_FINE); setShowFine(false);
        const fr = await fetch("/api/compliance-portal?view=fines");
        const fd = await fr.json();
        setFines(fd.fines || []);
      } else { setMsg({ text: data.error || "Failed.", ok: false }); }
    } catch { setMsg({ text: "Network error.", ok: false }); }
    finally { setSubmitting(false); }
  }

  // ── Confirm payment ───────────────────────────────────────────────
  async function confirmPayment(paymentId: string) {
    if (!confirm("Confirm this payment? This cannot be undone.")) return;
    const res = await fetch("/api/compliance-portal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_payment", paymentId }),
    });
    if (res.ok) {
      const pr = await fetch("/api/compliance-portal?view=payments");
      const pd = await pr.json();
      setPayments(pd.payments || []);
      loadBusinesses();
    } else { alert("Failed to confirm payment."); }
  }

  async function updateStatus(businessId: string, status: string) {
    if (!confirm(`Change status to ${status}?`)) return;
    await fetch("/api/compliance-portal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", businessId, status }),
    });
    loadBusinesses();
    if (detail?.id === businessId) {
      const res = await fetch(`/api/compliance-portal?view=detail&bizId=${businessId}`);
      const d   = await res.json(); setDetail(d.business || null);
    }
  }

  function Msg() {
    if (!msg.text) return null;
    return <div style={{ background: msg.ok ? "#052e16" : "#1f0707", border: `0.5px solid ${msg.ok ? "#14532d" : "#7f1d1d"}`, color: msg.ok ? "#4ade80" : "#f87171", borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16 }}>{msg.text}</div>;
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0" style={{ overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Business Compliance Portal</h1>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: "#052e16", color: "#4ade80", border: "0.5px solid #14532d" }}>Revenue Centre</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{today}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setShowFine(true); setMsg({ text:"",ok:true }); }} style={{ padding: "9px 18px", borderRadius: 10, border: "0.5px solid #7f1d1d", background: "#1f0707", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}> + Issue fine</button>
            <button onClick={() => { setShowReg(true); setMsg({ text:"",ok:true }); }} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Register business</button>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 12, padding: 4, width: "fit-content" }}>
          {(["dashboard","businesses","fines","payments"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 500, background: tab === t ? "var(--accent-bg)" : "transparent", border: tab === t ? "0.5px solid var(--accent-border)" : "none", color: tab === t ? "var(--accent-text)" : "var(--text-muted)", cursor: "pointer" }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <Msg />

        {/* ══ DASHBOARD ══════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <div>
            {/* Fee schedule */}
            <div className="card-bg" style={{ borderRadius: 14, padding: 20, marginBottom: 20, borderLeft: "3px solid #22c55e" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>📋 FCCPC Fee Schedule</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                {[
                  { label: "Registration fee",   amount: 50000,  note: "One-time on registration" },
                  { label: "Annual renewal",      amount: 25000,  note: "Due every January"        },
                  { label: "Compliance report",   amount: 10000,  note: "Per submission"            },
                  { label: "Fine (minimum)",      amount: 100000, note: "Varies by violation"       },
                ].map((f) => (
                  <div key={f.label} style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e" }}>{fmt(f.amount)}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-hint)", marginTop: 3 }}>{f.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {tabLoading ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>Loading...</div>
            ) : dashboard ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                  {[
                    { label: "Total revenue",        value: fmt(dashboard.totalRevenue),    color: "#22c55e" },
                    { label: "Pending payments",      value: fmt(dashboard.pendingPayments), color: "#f59e0b" },
                    { label: "Outstanding fines",     value: fmt(dashboard.unpaidFines),     color: "#ef4444" },
                    { label: "Registered businesses", value: dashboard.totalBiz,             color: "#a78bfa" },
                  ].map((k) => (
                    <div key={k.label} className="card-bg" style={{ borderRadius: 14, padding: "18px 20px" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{k.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="card-bg" style={{ borderRadius: 14, padding: 22 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Recent registrations</h3>
                    {dashboard.recentRegistrations.length === 0 ? (
                      <div style={{ color: "var(--text-hint)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No registrations yet</div>
                    ) : dashboard.recentRegistrations.map((b: any) => {
                      const s = SS[b.status] || SS.PENDING_VERIFICATION;
                      return (
                        <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "0.5px solid var(--border-soft)" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.businessName}</div>
                            <div style={{ fontSize: 11, color: "var(--text-hint)" }}>{b.sector?.replace(/_/g," ")} · {fmtD(b.createdAt)}</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: s.bg, color: s.color, border: `0.5px solid ${s.border}`, flexShrink: 0 }}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="card-bg" style={{ borderRadius: 14, padding: 22 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Recent confirmed payments</h3>
                    {dashboard.recentPayments.length === 0 ? (
                      <div style={{ color: "var(--text-hint)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No payments yet</div>
                    ) : dashboard.recentPayments.map((p: any) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "0.5px solid var(--border-soft)" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.business.businessName}</div>
                          <div style={{ fontSize: 11, color: "var(--text-hint)" }}>{PL[p.type] || p.type} · {fmtD(p.createdAt)}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", flexShrink: 0 }}>{fmt(p.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>No dashboard data yet. Register a business to get started.</div>}
          </div>
        )}

        {/* ══ BUSINESSES ═════════════════════════════════════════════ */}
        {tab === "businesses" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input style={{ ...inp, flex: 1, marginBottom: 0 }} placeholder="Search name, RC, email..." value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
              <select style={{ ...inp, width: 160, marginBottom: 0 }} value={filterSt} onChange={(e) => setFilterSt(e.target.value)}>
                <option value="ALL">All statuses</option>
                {Object.entries(SS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tabLoading ? (
                  <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>Loading...</div>
                ) : businesses.length === 0 ? (
                  <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>🏢</div>
                    <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)" }}>No businesses registered yet</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Click "Register business" to add the first regulated entity</div>
                  </div>
                ) : businesses.map((biz) => {
                  const s = SS[biz.status] || SS.PENDING_VERIFICATION;
                  const isSel = selected?.id === biz.id;
                  return (
                    <div key={biz.id} className="card-bg" style={{ borderRadius: 14, padding: "18px 22px", borderLeft: `3px solid ${isSel ? "var(--accent)" : "transparent"}`, outline: `0.5px solid ${isSel ? "var(--accent)" : "var(--border)"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{biz.businessName}</div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>RC: {biz.rcNumber} · {biz.sector?.replace(/_/g," ")} · {biz.state}</div>
                          <div style={{ display: "flex", gap: 14, marginTop: 5, fontSize: 12, color: "var(--text-hint)" }}>
                            <span>📋 {biz._count?.complianceReports || 0} reports</span>
                            <span>⚠ {biz._count?.fines || 0} fines</span>
                            <span>Reg fee: {fmt(biz.registrationFee)}</span>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: biz.feePaid ? "#052e16" : "#1f0707", color: biz.feePaid ? "#4ade80" : "#f87171", border: `0.5px solid ${biz.feePaid ? "#14532d" : "#7f1d1d"}`, flexShrink: 0 }}>
                          {biz.feePaid ? "Fee paid" : "Fee unpaid"}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 8, background: s.bg, color: s.color, border: `0.5px solid ${s.border}`, flexShrink: 0 }}>{s.label}</span>
                        <button onClick={async () => { if (isSel) { setSelected(null); setDetail(null); } else { setSelected(biz); const r = await fetch(`/api/compliance-portal?view=detail&bizId=${biz.id}`); const d = await r.json(); setDetail(d.business || null); } }} style={{ padding: "7px 16px", borderRadius: 9, fontSize: 12, fontWeight: 600, flexShrink: 0, border: isSel ? "1.5px solid #22c55e" : "0.5px solid var(--border)", background: isSel ? "#052e16" : "var(--bg-input)", color: isSel ? "#4ade80" : "var(--text-muted)", cursor: "pointer" }}>
                          {isSel ? "Close" : "View"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detail panel */}
              {selected && detail && (
                <div className="card-bg" style={{ borderRadius: 14, padding: 22, position: "sticky", top: 24, maxHeight: "85vh", overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{detail.businessName}</h3>
                    <button onClick={() => { setSelected(null); setDetail(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
                  </div>
                  {[["RC Number",detail.rcNumber],["Sector",detail.sector?.replace(/_/g," ")],["Email",detail.email],["Phone",detail.phone],["Address",`${detail.address}, ${detail.state}`],["Contact",`${detail.contactPerson} — ${detail.contactRole}`],["Reg fee",`${fmt(detail.registrationFee)} ${detail.feePaid?"✓ Paid":"✗ Unpaid"}`],["Registered",fmtD(detail.createdAt)],["Verified",detail.verifiedAt?fmtD(detail.verifiedAt):"Not verified"]].map(([label,value]) => (
                    <div key={label} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--border-soft)" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", width: 80, flexShrink: 0 }}>{label}</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", wordBreak: "break-word" }}>{value}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                    {detail.status === "PENDING_VERIFICATION" && <button onClick={() => updateStatus(detail.id,"ACTIVE")} style={{ padding:"7px 14px",borderRadius:8,border:"1.5px solid #22c55e",background:"#052e16",color:"#4ade80",fontSize:12,fontWeight:600,cursor:"pointer" }}>✓ Verify & activate</button>}
                    {detail.status === "ACTIVE" && <button onClick={() => updateStatus(detail.id,"SUSPENDED")} style={{ padding:"7px 14px",borderRadius:8,border:"0.5px solid #7f1d1d",background:"#1f0707",color:"#f87171",fontSize:12,cursor:"pointer" }}>Suspend</button>}
                    {detail.status === "SUSPENDED" && <button onClick={() => updateStatus(detail.id,"ACTIVE")} style={{ padding:"7px 14px",borderRadius:8,border:"1.5px solid #22c55e",background:"#052e16",color:"#4ade80",fontSize:12,cursor:"pointer" }}>Reactivate</button>}
                    <button onClick={() => { setFineForm({ ...EMPTY_FINE, businessId: detail.id }); setShowFine(true); }} style={{ padding:"7px 14px",borderRadius:8,border:"0.5px solid #7f1d1d",background:"#1f0707",color:"#f87171",fontSize:12,cursor:"pointer" }}>Issue fine</button>
                  </div>
                  {detail.payments?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Payments</div>
                      {detail.payments.slice(0,6).map((p: any) => (
                        <div key={p.id} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"0.5px solid var(--border-soft)",fontSize:12 }}>
                          <div><div style={{ color:"var(--text-primary)",fontWeight:500 }}>{PL[p.type]||p.type}</div><div style={{ color:"var(--text-hint)" }}>{fmtD(p.createdAt)}</div></div>
                          <div style={{ textAlign:"right" }}><div style={{ fontWeight:700,color:p.status==="CONFIRMED"?"#22c55e":"#f59e0b" }}>{fmt(p.amount)}</div><div style={{ color:"var(--text-hint)",fontSize:11 }}>{p.status}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ FINES ══════════════════════════════════════════════════ */}
        {tab === "fines" && (
          <div className="card-bg" style={{ borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 0.8fr", padding: "12px 20px", background: "var(--bg-input)", borderBottom: "0.5px solid var(--border-soft)" }}>
              {["Business","Reason","Amount","Due date","Status"].map((h) => <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>)}
            </div>
            {fines.length === 0 ? <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>No fines issued yet</div> : fines.map((f, i) => {
              const fs = FS[f.status] || FS.UNPAID;
              return (
                <div key={f.id} style={{ display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 0.8fr",padding:"13px 20px",borderBottom:"0.5px solid var(--border-soft)",background:i%2===0?"transparent":"var(--bg-input)",alignItems:"center" }}>
                  <div><div style={{ fontSize:13,fontWeight:600,color:"var(--text-primary)" }}>{f.business.businessName}</div><div style={{ fontSize:11,color:"var(--text-hint)" }}>{f.business.sector?.replace(/_/g," ")}</div></div>
                  <div style={{ fontSize:13,color:"var(--text-muted)" }}>{f.reason}</div>
                  <div style={{ fontSize:14,fontWeight:700,color:"#ef4444" }}>{fmt(f.amount)}</div>
                  <div style={{ fontSize:13,color:"var(--text-muted)" }}>{fmtD(f.dueDate)}</div>
                  <span style={{ fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:6,background:fs.bg,color:fs.color,border:`0.5px solid ${fs.border}` }}>{f.status}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ PAYMENTS ═══════════════════════════════════════════════ */}
        {tab === "payments" && (
          <div className="card-bg" style={{ borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", padding: "12px 20px", background: "var(--bg-input)", borderBottom: "0.5px solid var(--border-soft)" }}>
              {["Business","Type","Amount","Date","Action"].map((h) => <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>)}
            </div>
            {payments.length === 0 ? <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>No payments yet</div> : payments.map((p, i) => (
              <div key={p.id} style={{ display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr",padding:"13px 20px",borderBottom:"0.5px solid var(--border-soft)",background:i%2===0?"transparent":"var(--bg-input)",alignItems:"center" }}>
                <div style={{ fontSize:13,fontWeight:600,color:"var(--text-primary)" }}>{p.business.businessName}</div>
                <div style={{ fontSize:13,color:"var(--text-muted)" }}>{PL[p.type]||p.type}</div>
                <div style={{ fontSize:14,fontWeight:700,color:p.status==="CONFIRMED"?"#22c55e":"#f59e0b" }}>{fmt(p.amount)}</div>
                <div style={{ fontSize:13,color:"var(--text-muted)" }}>{fmtD(p.createdAt)}</div>
                <div>{p.status==="PENDING"?<button onClick={()=>confirmPayment(p.id)} style={{ padding:"5px 12px",borderRadius:7,border:"1.5px solid #22c55e",background:"#052e16",color:"#4ade80",fontSize:11,fontWeight:600,cursor:"pointer" }}>✓ Confirm</button>:<span style={{ fontSize:11,color:"#4ade80",fontWeight:600 }}>✓ Confirmed</span>}</div>
              </div>
            ))}
          </div>
        )}

        {/* ══ REGISTER MODAL ═════════════════════════════════════════ */}
        {showReg && (
          <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
            <div style={{ background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:18,padding:32,width:"100%",maxWidth:680,maxHeight:"92vh",overflowY:"auto" }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:22,paddingBottom:14,borderBottom:"0.5px solid var(--border-soft)" }}>
                <div>
                  <h2 style={{ fontSize:19,fontWeight:700,color:"var(--text-primary)" }}>Register regulated business</h2>
                  <p style={{ fontSize:13,color:"var(--text-muted)",marginTop:3 }}>Registration fee: {fmt(parseInt(form.registrationFee))} · Invoice generated on submit</p>
                </div>
                <button onClick={() => { setShowReg(false); setMsg({ text:"",ok:true }); setForm(EMPTY); }} style={{ background:"none",border:"none",color:"var(--text-muted)",fontSize:22,cursor:"pointer" }}>✕</button>
              </div>
              <Msg />
              <form onSubmit={handleRegister} autoComplete="off">
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                  <div style={{ gridColumn:"1/-1" }}>
                    <label style={lbl}>Business name *</label>
                    <input style={inp} value={form.businessName} onChange={(e)=>setForm({...form,businessName:e.target.value})} placeholder="Full registered name" required />
                  </div>
                  <div><label style={lbl}>RC Number *</label><input style={inp} value={form.rcNumber} onChange={(e)=>setForm({...form,rcNumber:e.target.value})} placeholder="RC1234567" required /></div>
                  <div><label style={lbl}>TIN (optional)</label><input style={inp} value={form.tin} onChange={(e)=>setForm({...form,tin:e.target.value})} placeholder="Tax ID" /></div>
                  <div><label style={lbl}>Sector *</label><select style={inp} value={form.sector} onChange={(e)=>setForm({...form,sector:e.target.value})}>{SECTORS.map((s)=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}</select></div>
                  <div><label style={lbl}>Registration fee (₦)</label><input style={inp} type="number" value={form.registrationFee} onChange={(e)=>setForm({...form,registrationFee:e.target.value})} /></div>
                  <div><label style={lbl}>Business email *</label><input style={inp} type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="compliance@business.com" required /></div>
                  <div><label style={lbl}>Phone *</label><input style={inp} value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} placeholder="+2348..." required /></div>
                  <div style={{ gridColumn:"1/-1" }}><label style={lbl}>Address *</label><input style={inp} value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})} placeholder="Full address" required /></div>
                  <div><label style={lbl}>State *</label><input style={inp} value={form.state} onChange={(e)=>setForm({...form,state:e.target.value})} placeholder="e.g. Lagos" required /></div>
                  <div><label style={lbl}>Contact person *</label><input style={inp} value={form.contactPerson} onChange={(e)=>setForm({...form,contactPerson:e.target.value})} placeholder="Compliance officer name" required /></div>
                  <div><label style={lbl}>Contact role *</label><input style={inp} value={form.contactRole} onChange={(e)=>setForm({...form,contactRole:e.target.value})} placeholder="e.g. Compliance Manager" required /></div>
                  <div><label style={lbl}>Portal password *</label><input style={inp} type="password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} placeholder="Min 8 characters" autoComplete="new-password" required /></div>
                </div>
                <div style={{ display:"flex",gap:12,marginTop:20,paddingTop:16,borderTop:"0.5px solid var(--border-soft)" }}>
                  <button type="button" onClick={()=>{setShowReg(false);setForm(EMPTY);}} style={{ padding:"12px 22px",borderRadius:10,border:"0.5px solid var(--border)",background:"var(--bg-input)",color:"var(--text-muted)",fontSize:14,cursor:"pointer" }}>Cancel</button>
                  <button type="submit" disabled={submitting} style={{ flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #22c55e",background:"#052e16",color:"#4ade80",fontSize:14,fontWeight:700,cursor:submitting?"not-allowed":"pointer",opacity:submitting?0.6:1 }}>
                    {submitting?"Registering...":`Register & generate ${fmt(parseInt(form.registrationFee))} invoice`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══ FINE MODAL ══════════════════════════════════════════════ */}
        {showFine && (
          <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
            <div style={{ background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:16,padding:32,width:"100%",maxWidth:500 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:22,paddingBottom:14,borderBottom:"0.5px solid var(--border-soft)" }}>
                <h2 style={{ fontSize:17,fontWeight:600,color:"var(--text-primary)" }}>Issue compliance fine</h2>
                <button onClick={()=>{setShowFine(false);setFineForm(EMPTY_FINE);}} style={{ background:"none",border:"none",color:"var(--text-muted)",fontSize:20,cursor:"pointer" }}>✕</button>
              </div>
              <Msg />
              <form onSubmit={handleIssueFine} autoComplete="off">
                <label style={lbl}>Select business *</label>
                <select style={inp} value={fineForm.businessId} onChange={(e)=>setFineForm({...fineForm,businessId:e.target.value})} required>
                  <option value="">— Choose a registered business —</option>
                  {businesses.map((b)=><option key={b.id} value={b.id}>{b.businessName} ({b.rcNumber})</option>)}
                </select>
                {businesses.length === 0 && <div style={{ fontSize:12,color:"#f59e0b",marginTop:-8,marginBottom:12 }}>No businesses registered yet.</div>}

                <label style={lbl}>Violation / reason *</label>
                <textarea style={{ ...inp,resize:"none",minHeight:80 } as any} value={fineForm.reason} onChange={(e)=>setFineForm({...fineForm,reason:e.target.value})} placeholder="Describe the compliance violation..." required />

                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                  <div><label style={lbl}>Amount (₦) *</label><input style={inp} type="number" min="1000" value={fineForm.amount} onChange={(e)=>setFineForm({...fineForm,amount:e.target.value})} placeholder="e.g. 500000" required /></div>
                  <div><label style={lbl}>Due date *</label><input style={inp} type="date" value={fineForm.dueDate} onChange={(e)=>setFineForm({...fineForm,dueDate:e.target.value})} required /></div>
                </div>
                <label style={lbl}>Notes (optional)</label>
                <input style={inp} value={fineForm.notes} onChange={(e)=>setFineForm({...fineForm,notes:e.target.value})} placeholder="Case reference, investigation ID..." />

                <div style={{ display:"flex",gap:12,marginTop:8 }}>
                  <button type="button" onClick={()=>{setShowFine(false);setFineForm(EMPTY_FINE);}} style={{ padding:"11px 20px",borderRadius:10,border:"0.5px solid var(--border)",background:"var(--bg-input)",color:"var(--text-muted)",fontSize:14,cursor:"pointer" }}>Cancel</button>
                  <button type="submit" disabled={submitting} style={{ flex:1,padding:"11px",borderRadius:10,border:"1.5px solid #ef4444",background:"#1f0707",color:"#f87171",fontSize:14,fontWeight:700,cursor:submitting?"not-allowed":"pointer" }}>
                    {submitting?"Issuing...":fineForm.amount?`Issue ${fmt(parseFloat(fineForm.amount)||0)} fine`:"Issue fine"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}



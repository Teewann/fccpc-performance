"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

// ─── Types ────────────────────────────────────────────────────────────
type Department = {
  id: string; name: string; shortCode: string;
  category: string; description: string | null;
  unitCount: number;
  _count: { users: number };
  totalLogs: number; approvedLogs: number;
  approvalRate: number; totalHours: number;
  status: "ON_TRACK" | "AT_RISK" | "BEHIND" | "NO_DATA";
};
type StaffStat = {
  id: string; name: string; email: string; role: string;
  totalLogs: number; approved: number; hours: number;
  approvalRate: number; weekLogs: number;
};
type RecentLog = {
  id: string; taskTitle: string; status: string;
  createdAt: string; user: { name: string };
};
type KPI = {
  id: string; title: string; target: number;
  current: number; unit: string; period: string;
};
type Unit = { id: string; name: string; shortCode: string; _count: { users: number } };
type DeptDetail = {
  id: string; name: string; shortCode: string;
  category: string; description: string | null;
  units: Unit[]; kpis: KPI[];
  stats: { total: number; approved: number; rejected: number; pending: number; rate: number; hours: number; staff: number };
  staffStats: StaffStat[];
  recentLogs: RecentLog[];
};

// ─── Helpers ──────────────────────────────────────────────────────────
const scoreColor = (r: number, hasData: boolean) =>
  !hasData ? "#6b7280" : r >= 80 ? "#22c55e" : r >= 60 ? "#f59e0b" : "#ef4444";

const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    ON_TRACK: { bg: "#052e16", color: "#4ade80", border: "#14532d", label: "On track" },
    AT_RISK:  { bg: "#1c1107", color: "#f59e0b", border: "#78350f", label: "At risk"  },
    BEHIND:   { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", label: "Behind"   },
    NO_DATA:  { bg: "#1a1d28", color: "#9ca3af", border: "#374151", label: "No data"  },
  };
  return map[status] || map.NO_DATA;
};
const logStatusStyle: Record<string, { bg: string; color: string; border: string }> = {
  SUBMITTED: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
  APPROVED:  { bg: "#052e16", color: "#4ade80", border: "#14532d" },
  REJECTED:  { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" },
  DRAFT:     { bg: "#1a1d28", color: "#9ca3af", border: "#374151" },
  QUERIED:   { bg: "#1c1107", color: "#f59e0b", border: "#78350f" },
};
const roleLabel = (r: string) => r.charAt(0) + r.slice(1).toLowerCase();

// ═══════════════════════════════════════════════════════════════════════
// ORGANOGRAM — white background, very high contrast, readable by all
// ═══════════════════════════════════════════════════════════════════════

function OrgBox({
  label, variant = "dept", width = 160, minHeight = 40,
}: {
  label: string;
  variant?: "board" | "evc" | "commissioner" | "unit-head" | "direct" | "dept" | "section";
  width?: number;
  minHeight?: number;
}) {
  const v: Record<string, React.CSSProperties> = {
    board:       { background: "#14532d", color: "#ffffff", border: "3px solid #166534", fontSize: 13, fontWeight: 800, padding: "12px 20px" },
    evc:         { background: "#14532d", color: "#ffffff", border: "3px solid #166534", fontSize: 12, fontWeight: 800, padding: "13px 28px" },
    commissioner:{ background: "#7f1d1d", color: "#ffffff", border: "2.5px solid #991b1b", fontSize: 11, fontWeight: 700, padding: "10px 14px" },
    "unit-head": { background: "#7f1d1d", color: "#ffffff", border: "2px solid #991b1b", fontSize: 10, fontWeight: 800, padding: "5px 10px", letterSpacing: "0.07em" },
    direct:      { background: "#ffffff", color: "#14532d", border: "2.5px solid #14532d", fontSize: 11, fontWeight: 700, padding: "9px 12px" },
    dept:        { background: "#ffffff", color: "#14532d", border: "2px solid #14532d", fontSize: 10, fontWeight: 700, padding: "9px 10px" },
    section:     { background: "#7f1d1d", color: "#ffffff", border: "2px solid #991b1b", fontSize: 10, fontWeight: 800, padding: "5px 16px", letterSpacing: "0.09em" },
  };
  return (
    <div style={{
      width, minHeight,
      display: "flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.4,
      borderRadius: 8, flexShrink: 0,
      ...v[variant],
    }}>
      {label}
    </div>
  );
}

function VL({ h = 20 }: { h?: number }) {
  return <div style={{ width: 2, height: h, background: "#374151", margin: "0 auto", flexShrink: 0 }} />;
}

function HL() {
  return <div style={{ height: 2, background: "#374151", width: "100%" }} />;
}

// Unit block: red header + white item rows
function UnitBlock({ title = "UNITS", items, width = 145 }: { title?: string; items: string[]; width?: number }) {
  return (
    <div style={{ width, flexShrink: 0 }}>
      <div style={{ background: "#7f1d1d", color: "#ffffff", border: "2px solid #991b1b", borderRadius: "6px 6px 0 0", fontSize: 10, fontWeight: 800, padding: "4px 8px", textAlign: "center", letterSpacing: "0.07em" }}>
        {title}
      </div>
      {items.map((item, idx) => (
        <div key={idx} style={{
          background: "#ffffff", color: "#111827", border: "1.5px solid #9ca3af",
          borderTop: idx === 0 ? "none" : undefined,
          fontSize: 10, fontWeight: 600, padding: "5px 8px",
          textAlign: "center", lineHeight: 1.35,
        }}>
          {item}
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ flex: 1, height: 2, background: "#7f1d1d" }} />
      <OrgBox label={label} variant="section" width={label.length > 30 ? 310 : 250} />
      <div style={{ flex: 1, height: 2, background: "#7f1d1d" }} />
    </div>
  );
}

function OrganogramTab() {
  return (
    <div style={{ overflowX: "auto", background: "#f0fdf4", borderRadius: 14, padding: "32px 24px", border: "2px solid #bbf7d0" }}>
      <div style={{ minWidth: 1180 }}>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#14532d", letterSpacing: "0.06em", marginBottom: 6 }}>
            FEDERAL COMPETITION & CONSUMER PROTECTION COMMISSION
          </div>
          <div style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Official Organisational Structure</div>
        </div>

        {/* ─── GOVERNING BOARD ────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <OrgBox label="GOVERNING BOARD" variant="board" width={210} minHeight={46} />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}><VL h={24} /></div>

        {/* ─── EVC ────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <OrgBox label="EXECUTIVE VICE CHAIRMAN / CHIEF EXECUTIVE" variant="evc" width={460} minHeight={50} />
        </div>

        {/* ─── Horizontal backbone ─────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "center" }}><VL h={22} /></div>
        <div style={{ margin: "0 70px" }}><HL /></div>

        {/* ─── Level 2: ECOPs | Centre | ECS ──────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0 70px" }}>

          {/* ECOPs */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 200 }}>
            <VL h={22} />
            <OrgBox label={"EXECUTIVE COMMISSIONER\nOPERATIONS (ECOPs)"} variant="commissioner" width={198} minHeight={52} />
          </div>

          {/* Centre direct reports */}
          <div style={{ flex: 1, padding: "0 20px" }}>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "flex-start" }}>

              {[
                { label: "LEGAL",                      units: ["Litigation", "Board Secretariat"] },
                { label: "DIRECTOR,\nSPECIAL DUTIES",  units: ["Press & Protocol", "Stock Verification", "ACTU"] },
              ].map((d) => (
                <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <VL h={22} />
                  <OrgBox label={d.label} variant="direct" width={145} minHeight={44} />
                  <VL h={14} />
                  <UnitBlock items={d.units} width={145} />
                </div>
              ))}

              {["INTERNAL\nAUDIT", "PROCUREMENT", "ICT"].map((label) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <VL h={22} />
                  <OrgBox label={label} variant="direct" width={label === "ICT" ? 80 : 128} minHeight={44} />
                </div>
              ))}
            </div>
          </div>

          {/* ECS */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 208 }}>
            <VL h={22} />
            <OrgBox label={"EXECUTIVE COMMISSIONER\nCORPORATE SERVICES (ECS)"} variant="commissioner" width={206} minHeight={52} />
            <VL h={14} />
            <OrgBox label={"OUTSTATIONS &\nSTAKEHOLDERS COORDINATION"} variant="direct" width={206} minHeight={44} />
          </div>
        </div>

        {/* ─── Departments (two columns) ───────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 36 }}>

          {/* ── OPERATIONS ────────────────────────────────────── */}
          <div>
            <SectionLabel label="DEPARTMENTS — OPERATIONS" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>

              {[
                { label: "SURVEILLANCE &\nINVESTIGATION",     units: ["Enforcement", "Investigation", "Dispute Resolution"],                                            w: 155 },
                { label: "CONSUMER &\nBUSINESS EDUCATION",    units: ["Customer Education", "Business Education"],                                                      w: 155 },
                { label: "QUALITY\nASSURANCE",                 units: ["Product Listing", "Services", "Clinic Management", "Laboratory Services", "Goods"],             w: 145 },
                { label: "MERGERS &\nACQUISITIONS",           units: ["Product Sector", "Services Sector"],                                                             w: 145 },
                { label: "ANTI-COMPETITIVE\nPRACTICES",        units: ["Monopoly", "Cartel"],                                                                            w: 155 },
              ].map((d) => (
                <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <OrgBox label={d.label} variant="dept" width={d.w} minHeight={44} />
                  <VL h={12} />
                  <UnitBlock items={d.units} width={d.w} />
                </div>
              ))}
            </div>
          </div>

          {/* ── CORPORATE SERVICES ────────────────────────────── */}
          <div>
            <SectionLabel label="DEPARTMENTS — CORPORATE SERVICES" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>

              {/* Original 3 with units */}
              {[
                { label: "PLANNING, RESEARCH\n& STATISTICS",   units: ["Planning", "Research and Statistics", "Monitoring and Evaluation"],                              w: 170 },
                { label: "FINANCE &\nACCOUNTS",                 units: ["Revenue & External Assistance", "Expenditure", "Budget", "Final and Fiscal Reporting"],         w: 180 },
                { label: "HUMAN RESOURCE\nMANAGEMENT",          units: ["Appointment, Promotion & Discipline", "Staff Training & Welfare", "General Services"],          w: 175 },
              ].map((d) => (
                <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <OrgBox label={d.label} variant="dept" width={d.w} minHeight={44} />
                  <VL h={12} />
                  <UnitBlock items={d.units} width={d.w} />
                </div>
              ))}

              {/* ── NEW 8 departments (no units yet) ── */}
              {[
                { label: "ADMINISTRATION",      w: 148 },
                { label: "CORPORATE\nSERVICES", w: 138 },
                { label: "HUMAN\nRESOURCES",    w: 128 },
                { label: "REGISTRY",            w: 118 },
                { label: "MAIL OFFICE",         w: 118 },
                { label: "BRANCH",              w: 108 },
              ].map((d) => (
                <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <OrgBox label={d.label} variant="dept" width={d.w} minHeight={44} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Executive Offices section ───────────────────────── */}
        <div style={{ marginTop: 32 }}>
          <SectionLabel label="EXECUTIVE OFFICES (SEPARATE FROM DEPARTMENTS)" />
          <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
            <OrgBox label={"EXECUTIVE COMMISSIONER\nOPERATIONS (ECOPs)"} variant="commissioner" width={250} minHeight={52} />
            <OrgBox label={"EXECUTIVE COMMISSIONER\nCORPORATE SERVICES (ECS)"} variant="commissioner" width={260} minHeight={52} />
          </div>
        </div>

        {/* ── Legend ──────────────────────────────────────────── */}
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "2px solid #d1fae5", display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { label: "Executive Leadership",       bg: "#14532d", txt: "#ffffff", brd: "#166534" },
            { label: "Commissioners / Sections",   bg: "#7f1d1d", txt: "#ffffff", brd: "#991b1b" },
            { label: "Direct Report Units",        bg: "#ffffff", txt: "#14532d", brd: "#14532d" },
            { label: "Departments",                bg: "#ffffff", txt: "#14532d", brd: "#14532d" },
            { label: "Unit Items",                 bg: "#ffffff", txt: "#111827", brd: "#9ca3af" },
          ].map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#1f2937", fontWeight: 500 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: l.bg, border: `2.5px solid ${l.brd}`, flexShrink: 0 }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function DepartmentsPage() {
  const [departments,   setDepartments]   = useState<Department[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [detail,        setDetail]        = useState<DeptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search,        setSearch]        = useState("");
  const [activeTab,     setActiveTab]     = useState<"list" | "organogram">("list");

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => { setDepartments(d.departments || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function openDetail(id: string) {
    setDetailLoading(true); setDetail(null);
    try {
      const res  = await fetch(`/api/departments?id=${id}`);
      const data = await res.json();
      if (data.detail) setDetail(data.detail);
    } finally { setDetailLoading(false); }
  }

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.shortCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0" style={{ display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Departments</h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · {activeTab === "list" ? "Ranked by approval rate · Last 30 days" : "FCCPC Official Organogram"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              {departments.length} departments
            </div>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["list", "organogram"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); if (tab === "organogram") setDetail(null); }}
              style={{
                padding: "10px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                border:     activeTab === tab ? "1.5px solid #22c55e" : "0.5px solid var(--border)",
                background: activeTab === tab ? "#052e16" : "var(--bg-card)",
                color:      activeTab === tab ? "#4ade80" : "var(--text-muted)",
                transition: "all 0.15s",
              }}
            >
              {tab === "list" ? "🏢 Department List" : "📊 Organogram"}
            </button>
          ))}
        </div>

        {/* ORGANOGRAM */}
        {activeTab === "organogram" && <OrganogramTab />}

        {/* LIST */}
        {activeTab === "list" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search departments..." autoComplete="off"
                style={{ width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "11px 14px", fontSize: 15, color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: detail || detailLoading ? "1fr 420px" : "1fr", gap: 16, alignItems: "start" }}>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {loading ? (
                  <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>Loading departments...</div>
                ) : filtered.length === 0 ? (
                  <div className="card-bg" style={{ borderRadius: 14, padding: 48, textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🏢</div>
                    <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)" }}>No departments found</div>
                  </div>
                ) : (
                  filtered.map((dept, i) => {
                    const c  = scoreColor(dept.approvalRate, dept.status !== "NO_DATA");
                    const sb = statusBadge(dept.status);
                    const isSelected = detail?.id === dept.id;
                    return (
                      <div key={dept.id} className="card-bg" style={{ borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16, outline: `0.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`, borderLeft: `3px solid ${isSelected ? "var(--accent)" : "transparent"}` }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "var(--accent-text)" }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{dept.name}</div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                            {dept.shortCode} · {dept.category} · {dept._count.users} staff · {dept.unitCount} units{dept.description ? ` · ${dept.description}` : ""}
                          </div>
                          <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "var(--text-hint)" }}>
                            <span>{dept.totalLogs} logs submitted</span>
                            <span>{dept.approvedLogs} approved</span>
                            <span>{dept.totalHours}h total</span>
                          </div>
                        </div>
                        <div style={{ width: 150, flexShrink: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Approval rate</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{dept.status === "NO_DATA" ? "—" : `${dept.approvalRate}%`}</span>
                          </div>
                          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 3, width: dept.status === "NO_DATA" ? "0%" : `${dept.approvalRate}%`, background: c, transition: "width 0.5s ease" }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 8, flexShrink: 0, background: sb.bg, color: sb.color, border: `0.5px solid ${sb.border}` }}>{sb.label}</span>
                        <button
                          onClick={() => isSelected ? setDetail(null) : openDetail(dept.id)}
                          style={{ padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: isSelected ? "1.5px solid #22c55e" : "0.5px solid var(--border)", background: isSelected ? "#052e16" : "var(--bg-input)", color: isSelected ? "#4ade80" : "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}
                        >
                          {isSelected ? "Close" : "View"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {(detail || detailLoading) && (
                <div className="card-bg" style={{ borderRadius: 14, padding: 24, position: "sticky", top: 24, maxHeight: "90vh", overflowY: "auto" }}>
                  {detailLoading && !detail ? (
                    <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 14 }}>Loading...</div>
                  ) : detail ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{detail.name}</div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>{detail.shortCode} · {detail.category}</div>
                        </div>
                        <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                        {[
                          { label: "Staff",       value: detail.stats.staff,       color: "var(--text-primary)" },
                          { label: "Total logs",  value: detail.stats.total,       color: "#3b82f6" },
                          { label: "Approved",    value: detail.stats.approved,    color: "#22c55e" },
                          { label: "Rejected",    value: detail.stats.rejected,    color: "#ef4444" },
                          { label: "Pending",     value: detail.stats.pending,     color: "#f59e0b" },
                          { label: "Total hours", value: `${detail.stats.hours}h`, color: "#a78bfa" },
                        ].map((s) => (
                          <div key={s.label} style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Approval rate</span>
                          <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor(detail.stats.rate, detail.stats.total > 0) }}>
                            {detail.stats.total > 0 ? `${detail.stats.rate}%` : "No data"}
                          </span>
                        </div>
                        <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 4, width: `${detail.stats.rate}%`, background: scoreColor(detail.stats.rate, detail.stats.total > 0), transition: "width 0.5s" }} />
                        </div>
                      </div>
                      {detail.units.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Units ({detail.units.length})</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {detail.units.map((u) => (
                              <span key={u.id} style={{ fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 8, background: "var(--bg-input)", border: "0.5px solid var(--border)", color: "var(--text-muted)" }}>
                                {u.name} · {u.shortCode}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {detail.kpis.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>KPI targets</div>
                          {detail.kpis.map((kpi) => {
                            const pct = Math.min(100, Math.round((kpi.current / kpi.target) * 100));
                            return (
                              <div key={kpi.id} style={{ marginBottom: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{kpi.title}</span>
                                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{kpi.current} / {kpi.target} {kpi.unit}</span>
                                </div>
                                <div style={{ height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                                  <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444" }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {detail.staffStats.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Staff ({detail.staffStats.length})</div>
                          {detail.staffStats.map((s) => (
                            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--border-soft)" }}>
                              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent-bg)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--accent-text)", flexShrink: 0 }}>
                                {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                                <div style={{ fontSize: 11, color: "var(--text-hint)" }}>{roleLabel(s.role)} · {s.totalLogs} logs · {s.hours}h</div>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: scoreColor(s.approvalRate, s.totalLogs > 0), flexShrink: 0 }}>
                                {s.totalLogs > 0 ? `${s.approvalRate}%` : "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {detail.recentLogs.length > 0 && (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent logs</div>
                          {detail.recentLogs.map((log) => {
                            const st = logStatusStyle[log.status] || logStatusStyle.DRAFT;
                            return (
                              <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--border-soft)" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.taskTitle}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{log.user.name} · {new Date(log.createdAt).toLocaleDateString("en-GB")}</div>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: st.bg, color: st.color, border: `0.5px solid ${st.border}`, flexShrink: 0 }}>
                                  {log.status.charAt(0) + log.status.slice(1).toLowerCase()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {detail.staffStats.length === 0 && detail.recentLogs.length === 0 && (
                        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-hint)", fontSize: 14 }}>No staff activity in the last 30 days</div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

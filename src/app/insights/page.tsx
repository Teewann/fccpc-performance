"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import UserAvatar from "@/components/UserAvatar";

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */

type StaffInsight = {
  id: string; name: string; email: string; department: string;
  overallScore: number; totalLogs: number; approved: number;
  rejected: number; completedTasks: number; overdueTasks: number;
  totalHours: number; uniqueDays: number;
  weekLogs: number; avgScore: number | null;
  tag: string; tagColor: "green" | "amber" | "red" | "blue"; reason: string;
};

type Summary = {
  totalStaff: number; promotionCandidates: number;
  flagged: number; lowActivity: number; avgScore: number;
};

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

type Unit = {
  id: string; name: string; shortCode: string;
  _count: { users: number };
};

type DeptDetail = {
  id: string; name: string; shortCode: string;
  category: string; description: string | null;
  units: Unit[]; kpis: KPI[];
  stats: { total: number; approved: number; rejected: number; pending: number; rate: number; hours: number; staff: number };
  staffStats: StaffStat[];
  recentLogs: RecentLog[];
};

type Tab = "staff" | "departments" | "organogram";

/* ═══════════════════════════════════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════════════════════════════════ */

const tagStyles: Record<string, { bg: string; color: string; border: string }> = {
  green: { bg: "#052e16", color: "#4ade80", border: "#14532d" },
  blue:  { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
  amber: { bg: "#1c1107", color: "#f59e0b", border: "#78350f" },
  red:   { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" },
};

const scoreColor = (s: number) =>
  s >= 70 ? "#4ade80" : s >= 50 ? "#f59e0b" : "#f87171";

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

/* ═══════════════════════════════════════════════════════════════════════
   ORGANOGRAM SUB-COMPONENTS (unchanged from old page)
   ═══════════════════════════════════════════════════════════════════════ */

function OrgBox({
  label, variant = "dept", width = 160, minHeight = 40,
}: {
  label: string;
  variant?: "board" | "evc" | "commissioner" | "unit-head" | "direct" | "dept" | "section";
  width?: number;
  minHeight?: number;
}) {
  const v: Record<string, React.CSSProperties> = {
    board:        { background: "#14532d", color: "#ffffff", border: "3px solid #166534", fontSize: 13, fontWeight: 800, padding: "12px 20px" },
    evc:          { background: "#14532d", color: "#ffffff", border: "3px solid #166534", fontSize: 12, fontWeight: 800, padding: "13px 28px" },
    commissioner: { background: "#7f1d1d", color: "#ffffff", border: "2.5px solid #991b1b", fontSize: 11, fontWeight: 700, padding: "10px 14px" },
    "unit-head":  { background: "#7f1d1d", color: "#ffffff", border: "2px solid #991b1b", fontSize: 10, fontWeight: 800, padding: "5px 10px", letterSpacing: "0.07em" },
    direct:       { background: "#ffffff", color: "#14532d", border: "2.5px solid #14532d", fontSize: 11, fontWeight: 700, padding: "9px 12px" },
    dept:         { background: "#ffffff", color: "#14532d", border: "2px solid #14532d", fontSize: 10, fontWeight: 700, padding: "9px 10px" },
    section:      { background: "#7f1d1d", color: "#ffffff", border: "2px solid #991b1b", fontSize: 10, fontWeight: 800, padding: "5px 16px", letterSpacing: "0.09em" },
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

        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#14532d", letterSpacing: "0.06em", marginBottom: 6 }}>
            FEDERAL COMPETITION & CONSUMER PROTECTION COMMISSION
          </div>
          <div style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Official Organisational Structure</div>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <OrgBox label="GOVERNING BOARD" variant="board" width={210} minHeight={46} />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}><VL h={24} /></div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <OrgBox label="EXECUTIVE VICE CHAIRMAN / CHIEF EXECUTIVE" variant="evc" width={460} minHeight={50} />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}><VL h={22} /></div>
        <div style={{ margin: "0 70px" }}><HL /></div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0 70px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 200 }}>
            <VL h={22} />
            <OrgBox label={"EXECUTIVE COMMISSIONER\nOPERATIONS (ECOPs)"} variant="commissioner" width={198} minHeight={52} />
          </div>

          <div style={{ flex: 1, padding: "0 20px" }}>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "flex-start" }}>
              {[
                { label: "LEGAL",                     units: ["Litigation", "Board Secretariat"] },
                { label: "DIRECTOR,\nSPECIAL DUTIES", units: ["Press & Protocol", "Stock Verification", "ACTU"] },
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

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 208 }}>
            <VL h={22} />
            <OrgBox label={"EXECUTIVE COMMISSIONER\nCORPORATE SERVICES (ECS)"} variant="commissioner" width={206} minHeight={52} />
            <VL h={14} />
            <OrgBox label={"OUTSTATIONS &\nSTAKEHOLDERS COORDINATION"} variant="direct" width={206} minHeight={44} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 36 }}>
          <div>
            <SectionLabel label="DEPARTMENTS - OPERATIONS" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {[
                { label: "SURVEILLANCE &\nINVESTIGATION",  units: ["Enforcement", "Investigation", "Dispute Resolution"],                             w: 155 },
                { label: "CONSUMER &\nBUSINESS EDUCATION", units: ["Customer Education", "Business Education"],                                       w: 155 },
                { label: "QUALITY\nASSURANCE",              units: ["Product Listing", "Services", "Clinic Management", "Laboratory Services", "Goods"], w: 145 },
                { label: "MERGERS &\nACQUISITIONS",        units: ["Product Sector", "Services Sector"],                                              w: 145 },
                { label: "ANTI-COMPETITIVE\nPRACTICES",     units: ["Monopoly", "Cartel"],                                                             w: 155 },
              ].map((d) => (
                <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <OrgBox label={d.label} variant="dept" width={d.w} minHeight={44} />
                  <VL h={12} />
                  <UnitBlock items={d.units} width={d.w} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel label="DEPARTMENTS - CORPORATE SERVICES" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {[
                { label: "PLANNING, RESEARCH\n& STATISTICS",  units: ["Planning", "Research and Statistics", "Monitoring and Evaluation"],                              w: 170 },
                { label: "FINANCE &\nACCOUNTS",                units: ["Revenue & External Assistance", "Expenditure", "Budget", "Final and Fiscal Reporting"],         w: 180 },
                { label: "HUMAN RESOURCE\nMANAGEMENT",         units: ["Appointment, Promotion & Discipline", "Staff Training & Welfare", "General Services"],          w: 175 },
              ].map((d) => (
                <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <OrgBox label={d.label} variant="dept" width={d.w} minHeight={44} />
                  <VL h={12} />
                  <UnitBlock items={d.units} width={d.w} />
                </div>
              ))}
              {[
                { label: "ADMINISTRATION",     w: 148 },
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

        <div style={{ marginTop: 32 }}>
          <SectionLabel label="EXECUTIVE OFFICES (SEPARATE FROM DEPARTMENTS)" />
          <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
            <OrgBox label={"EXECUTIVE COMMISSIONER\nOPERATIONS (ECOPs)"} variant="commissioner" width={250} minHeight={52} />
            <OrgBox label={"EXECUTIVE COMMISSIONER\nCORPORATE SERVICES (ECS)"} variant="commissioner" width={260} minHeight={52} />
          </div>
        </div>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "2px solid #d1fae5", display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { label: "Executive Leadership",     bg: "#14532d", txt: "#ffffff", brd: "#166534" },
            { label: "Commissioners / Sections", bg: "#7f1d1d", txt: "#ffffff", brd: "#991b1b" },
            { label: "Direct Report Units",      bg: "#ffffff", txt: "#14532d", brd: "#14532d" },
            { label: "Departments",              bg: "#ffffff", txt: "#14532d", brd: "#14532d" },
            { label: "Unit Items",               bg: "#ffffff", txt: "#111827", brd: "#9ca3af" },
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

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function InsightsPage() {
  const [tab, setTab] = useState<Tab>("staff");

  // Staff tab
  const [insights, setInsights] = useState<StaffInsight[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<StaffInsight | null>(null);
  const [staffTagFilter, setStaffTagFilter] = useState("ALL");
  const [staffDeptFilter, setStaffDeptFilter] = useState("ALL");
  const [staffViewMode, setStaffViewMode] = useState<"active" | "all">("active");

  // Departments tab
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptSearch, setDeptSearch] = useState("");
  const [deptDetail, setDeptDetail] = useState<DeptDetail | null>(null);
  const [deptDetailLoading, setDeptDetailLoading] = useState(false);

  /* ─── Read tab from ?tab= query param on mount ─── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "departments" || t === "organogram" || t === "staff") {
      setTab(t as Tab);
    }
  }, []);

  /* ─── Update URL when tab changes (so it's shareable) ─── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }, [tab]);

  /* ─── Fetch staff insights on mount ─── */
  const fetchInsights = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res  = await fetch("/api/ai-insights");
      const data = await res.json();
      setInsights(data.insights || []);
      setSummary(data.summary || null);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  /* ─── Fetch departments on mount ─── */
  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => { setDepartments(d.departments || []); setDeptLoading(false); })
      .catch(() => setDeptLoading(false));
  }, []);

  async function openDeptDetail(id: string) {
    setDeptDetailLoading(true); setDeptDetail(null);
    try {
      const res  = await fetch(`/api/departments?id=${id}`);
      const data = await res.json();
      if (data.detail) setDeptDetail(data.detail);
    } finally {
      setDeptDetailLoading(false);
    }
  }

  /* ─── Derived: unique department names for the staff filter ─── */
  const uniqueDepts = Array.from(new Set(insights.map((s) => s.department))).sort();

  const filteredInsights = insights.filter((s) => {
  if (staffTagFilter !== "ALL" && s.tag !== staffTagFilter) return false;
  if (staffDeptFilter !== "ALL" && s.department !== staffDeptFilter) return false;
  if (staffViewMode === "active") {
    const hasWork = s.approved > 0 || s.completedTasks > 0;
    if (!hasWork) return false;
  }
  return true;
});

  const filteredDepartments = departments.filter((d) =>
    d.name.toLowerCase().includes(deptSearch.toLowerCase()) ||
    d.shortCode.toLowerCase().includes(deptSearch.toLowerCase())
  );

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
<main className="flex-1 p-6 min-w-0" style={{ fontSize: "1.05em", fontWeight: 500 }}>

        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Insights
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · Staff performance, departments &amp; organisational structure
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
              borderRadius: 10, border: "1.5px solid #22c55e",
              background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              Live
            </div>
            <ThemeToggleButton />
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {([
            { key: "staff",       label: "👥 Staff Insights" },
            { key: "departments", label: "🏢 Departments" },
            { key: "organogram",  label: "📊 Organogram" },
          ] as { key: Tab; label: string }[]).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  border: active ? "1.5px solid #22c55e" : "0.5px solid var(--border)",
                  background: active ? "#052e16" : "var(--bg-card)",
                  color: active ? "#4ade80" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB 1 — STAFF INSIGHTS
            ══════════════════════════════════════════════════════ */}
        {tab === "staff" && (
          <>
            {summary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Staff analysed",       value: summary.totalStaff,          color: "var(--text-primary)" },
                  { label: "Avg performance", value: summary.avgScore, color: scoreColor(summary.avgScore) },
                  { label: "Promotion candidates", value: summary.promotionCandidates, color: "#4ade80" },
                  { label: "Low activity",         value: summary.lowActivity,          color: "#f59e0b" },
                  { label: "Flagged",              value: summary.flagged,              color: "#f87171" },
                ].map((s) => (
                  <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ fontSize: 30, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={staffDeptFilter}
                onChange={(e) => setStaffDeptFilter(e.target.value)}
                style={{
                  padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 500,
                  background: "var(--bg-input)", border: "0.5px solid var(--border)",
                  color: "var(--text-primary)", cursor: "pointer", outline: "none", minWidth: 200,
                }}
              >
                <option value="ALL">All departments</option>
                {uniqueDepts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>

              {["ALL", "Promote", "On Track", "Watch", "Low Activity", "Quality Issues", "Flag"].map((f) => (
                <button
                  key={f}
                  onClick={() => setStaffTagFilter(f)}
                  style={{
                    padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
                    border: `0.5px solid ${staffTagFilter === f ? "var(--accent)" : "var(--border)"}`,
                    background: staffTagFilter === f ? "var(--accent-bg)" : "var(--bg-card)",
                    color: staffTagFilter === f ? "var(--accent-text)" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {f === "ALL" ? `All (${insights.length})` : f}
                </button>
              ))}

              <div style={{ marginLeft: "auto", display: "flex", gap: 4, padding: 3, background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
  <button
    onClick={() => setStaffViewMode("active")}
    style={{
      padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
      border: staffViewMode === "active" ? "1.5px solid #60a5fa" : "1.5px solid transparent",
      background: staffViewMode === "active" ? "#0c1a2e" : "transparent",
      color: staffViewMode === "active" ? "#60a5fa" : "var(--text-muted)",
    }}
  >
    Active only
  </button>
  <button
    onClick={() => setStaffViewMode("all")}
    style={{
      padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
      border: staffViewMode === "all" ? "1.5px solid #60a5fa" : "1.5px solid transparent",
      background: staffViewMode === "all" ? "#0c1a2e" : "transparent",
      color: staffViewMode === "all" ? "#60a5fa" : "var(--text-muted)",
    }}
  >
    All staff
  </button>
</div>
            </div>

            {/* Staff grid + detail panel */}
            <div style={{ display: "grid", gridTemplateColumns: selectedStaff ? "1fr 400px" : "1fr", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {staffLoading ? (
                  <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>
                    Running analysis...
                  </div>
                ) : filteredInsights.length === 0 ? (
                  <div className="card-bg" style={{ borderRadius: 14, padding: 48, textAlign: "center" }}>
                    <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
                      No staff match these filters
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                      Try clearing the department or tag filter
                    </div>
                  </div>
                ) : (
                  filteredInsights.map((s) => {
                    const ts = tagStyles[s.tagColor];
                    const isSelected = selectedStaff?.id === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedStaff(isSelected ? null : s)}
                        className="card-bg"
                        style={{
                          borderRadius: 14, padding: "18px 20px", cursor: "pointer",
                          borderLeft: `3px solid ${isSelected ? "var(--accent)" : "transparent"}`,
                          outline: `0.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <UserAvatar user={{ name: s.name }} userId={s.id} size={48} />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{s.name}</div>
                            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{s.department}</div>
                          </div>

                          <div style={{ textAlign: "center", flexShrink: 0 }}>
                            <div style={{ fontSize: 26, fontWeight: 700, color: scoreColor(s.overallScore), letterSpacing: "-0.02em" }}>
                              {s.overallScore}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-hint)", fontWeight: 500 }}>SCORE</div>
                          </div>

                          <span style={{
                            fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
                            background: ts.bg, color: ts.color, border: `0.5px solid ${ts.border}`,
                            flexShrink: 0,
                          }}>
                            {s.tag}
                          </span>
                        </div>

                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 13, color: "var(--text-muted)", flex: 1 }}>{s.reason}</div>
                          <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text-hint)", flexShrink: 0, marginLeft: 16 }}>
                            <span>{s.approved} approved</span>
<span>{s.completedTasks} tasks done</span>
{s.overdueTasks > 0 && <span style={{ color: "#f87171" }}>{s.overdueTasks} overdue</span>}
<span>{s.uniqueDays} active days</span>
                          </div>
                        </div>

                        <div style={{ marginTop: 10, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 2, width: `${s.overallScore}%`, background: scoreColor(s.overallScore) }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedStaff && (
                <div className="card-bg" style={{ borderRadius: 14, padding: 24, alignSelf: "start", position: "sticky", top: 24, maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                    <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>Staff profile</h3>
                    <button onClick={() => setSelectedStaff(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
                  </div>

                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                      <UserAvatar user={{ name: selectedStaff.name }} userId={selectedStaff.id} size={72} />
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{selectedStaff.name}</div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{selectedStaff.department}</div>
                    <div style={{ fontSize: 13, color: "var(--text-hint)", marginTop: 2 }}>{selectedStaff.email}</div>
                  </div>

                  <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 20, textAlign: "center" }}>
                    <div style={{ fontSize: 48, fontWeight: 700, color: scoreColor(selectedStaff.overallScore), letterSpacing: "-0.03em" }}>
                      {selectedStaff.overallScore}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Overall performance score</div>
                    <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden", marginTop: 12 }}>
                      <div style={{ height: "100%", borderRadius: 4, width: `${selectedStaff.overallScore}%`, background: scoreColor(selectedStaff.overallScore) }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                    {[
  { label: "Total logs",       value: selectedStaff.totalLogs },
  { label: "Approved logs",    value: selectedStaff.approved },
  { label: "Rejected logs",    value: selectedStaff.rejected },
  { label: "Tasks completed",  value: selectedStaff.completedTasks },
  { label: "Overdue tasks",    value: selectedStaff.overdueTasks },
  { label: "Active days",      value: selectedStaff.uniqueDays },
  { label: "Total hours",      value: `${selectedStaff.totalHours}h` },
  { label: "This week",        value: `${selectedStaff.weekLogs} logs` },
].map((stat) => (
                      <div key={stat.label} style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>{stat.value}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    background: tagStyles[selectedStaff.tagColor].bg,
                    border: `0.5px solid ${tagStyles[selectedStaff.tagColor].border}`,
                    borderRadius: 12, padding: 14,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: tagStyles[selectedStaff.tagColor].color, marginBottom: 6 }}>
                      Recommendation: {selectedStaff.tag}
                    </div>
                    <div style={{ fontSize: 13, color: tagStyles[selectedStaff.tagColor].color, opacity: 0.8, lineHeight: 1.5 }}>
                      {selectedStaff.reason}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 2 — DEPARTMENTS
            ══════════════════════════════════════════════════════ */}
        {tab === "departments" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <input
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                placeholder="Search departments..."
                autoComplete="off"
                style={{ width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "11px 14px", fontSize: 15, color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: deptDetail || deptDetailLoading ? "1fr 420px" : "1fr", gap: 16, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {deptLoading ? (
                  <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>Loading departments...</div>
                ) : filteredDepartments.length === 0 ? (
                  <div className="card-bg" style={{ borderRadius: 14, padding: 48, textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🏢</div>
                    <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)" }}>No departments found</div>
                  </div>
                ) : (
                  filteredDepartments.map((dept, i) => {
                    const c  = scoreColor(dept.approvalRate);
                    const sb = statusBadge(dept.status);
                    const isSelected = deptDetail?.id === dept.id;
                    return (
                      <div key={dept.id} className="card-bg" style={{ borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16, outline: `0.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`, borderLeft: `3px solid ${isSelected ? "var(--accent)" : "transparent"}` }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "var(--accent-text)" }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{dept.name}</div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                            {dept.shortCode} · {dept.category} · {dept._count.users} staff · {dept.unitCount} units
                          </div>
                          <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "var(--text-hint)" }}>
                            <span>{dept.totalLogs} logs</span>
                            <span>{dept.approvedLogs} approved</span>
                            <span>{dept.totalHours}h</span>
                          </div>
                        </div>
                        <div style={{ width: 150, flexShrink: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Approval rate</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{dept.status === "NO_DATA" ? "-" : `${dept.approvalRate}%`}</span>
                          </div>
                          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 3, width: dept.status === "NO_DATA" ? "0%" : `${dept.approvalRate}%`, background: c }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 8, flexShrink: 0, background: sb.bg, color: sb.color, border: `0.5px solid ${sb.border}` }}>{sb.label}</span>
                        <button
                          onClick={() => isSelected ? setDeptDetail(null) : openDeptDetail(dept.id)}
                          style={{ padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: isSelected ? "1.5px solid #22c55e" : "0.5px solid var(--border)", background: isSelected ? "#052e16" : "var(--bg-input)", color: isSelected ? "#4ade80" : "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}
                        >
                          {isSelected ? "Close" : "View"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {(deptDetail || deptDetailLoading) && (
                <div className="card-bg" style={{ borderRadius: 14, padding: 24, position: "sticky", top: 24, maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
                  {deptDetailLoading && !deptDetail ? (
                    <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 14 }}>Loading...</div>
                  ) : deptDetail ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{deptDetail.name}</div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>{deptDetail.shortCode} · {deptDetail.category}</div>
                        </div>
                        <button onClick={() => setDeptDetail(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                        {[
                          { label: "Staff",       value: deptDetail.stats.staff,       color: "var(--text-primary)" },
                          { label: "Total logs",  value: deptDetail.stats.total,       color: "#3b82f6" },
                          { label: "Approved",    value: deptDetail.stats.approved,    color: "#22c55e" },
                          { label: "Rejected",    value: deptDetail.stats.rejected,    color: "#ef4444" },
                          { label: "Pending",     value: deptDetail.stats.pending,     color: "#f59e0b" },
                          { label: "Total hours", value: `${deptDetail.stats.hours}h`, color: "#a78bfa" },
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
                          <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor(deptDetail.stats.rate) }}>
                            {deptDetail.stats.total > 0 ? `${deptDetail.stats.rate}%` : "No data"}
                          </span>
                        </div>
                        <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 4, width: `${deptDetail.stats.rate}%`, background: scoreColor(deptDetail.stats.rate) }} />
                        </div>
                      </div>

                      {deptDetail.units.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Units ({deptDetail.units.length})</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {deptDetail.units.map((u) => (
                              <span key={u.id} style={{ fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 8, background: "var(--bg-input)", border: "0.5px solid var(--border)", color: "var(--text-muted)" }}>
                                {u.name} · {u.shortCode}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {deptDetail.kpis.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>KPI targets</div>
                          {deptDetail.kpis.map((kpi) => {
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

                      {deptDetail.staffStats.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Staff ({deptDetail.staffStats.length})</div>
                          {deptDetail.staffStats.map((s) => (
                            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--border-soft)" }}>
                              <UserAvatar user={{ name: s.name }} userId={s.id} size={32} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                                <div style={{ fontSize: 11, color: "var(--text-hint)" }}>{roleLabel(s.role)} · {s.totalLogs} logs · {s.hours}h</div>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: scoreColor(s.approvalRate), flexShrink: 0 }}>
                                {s.totalLogs > 0 ? `${s.approvalRate}%` : "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {deptDetail.recentLogs.length > 0 && (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent logs</div>
                          {deptDetail.recentLogs.map((log) => {
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
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 3 — ORGANOGRAM
            ══════════════════════════════════════════════════════ */}
        {tab === "organogram" && <OrganogramTab />}

      </main>
    </div>
  );
}
"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type Appraisal = {
  id: string; name: string; email: string; staffId: string | null;
  department: string; unit: string | null; role: string;
  period: string; dateFrom: string; dateTo: string;
  totalLogs: number; approved: number; rejected: number;
  totalHours: number; uniqueDays: number; highPriority: number;
  avgScore: number | null;
  topCategories: { cat: string; count: number }[];
  overallScore: number; rating: string; ratingColor: string;
  approvalRate: number; freqScore: number; qualScore: number; volScore: number;
};

type Summary = {
  total: number; outstanding: number; exceeds: number;
  meets: number; below: number; unsatisfactory: number; avgScore: number;
};

type Department = { id: string; name: string };

const RATING_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  "Outstanding":          { bg: "#052e16", color: "#4ade80", border: "#14532d" },
  "Exceeds Expectation":  { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
  "Meets Expectation":    { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95" },
  "Below Expectation":    { bg: "#1c1107", color: "#f59e0b", border: "#78350f" },
  "Unsatisfactory":       { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" },
};

const PERIODS = [
  { value: "monthly",   label: "Monthly"   },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual",    label: "Annual"    },
];

export default function AppraisalsPage() {
  const [appraisals,  setAppraisals]  = useState<Appraisal[]>([]);
  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<Appraisal | null>(null);
  const [period,      setPeriod]      = useState("monthly");
  const [filterDept,  setFilterDept]  = useState("ALL");
  const [filterRating, setFilterRating] = useState("ALL");
  const [exporting,   setExporting]   = useState(false);

  useEffect(() => { fetchAppraisals(); }, [period, filterDept]);

  async function fetchAppraisals() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period,
        ...(filterDept !== "ALL" ? { deptId: filterDept } : {}),
      });
      const res  = await fetch(`/api/appraisals?${params}`);
      const data = await res.json();
      setAppraisals(data.appraisals  || []);
      setSummary(data.summary        || null);
      setDepartments(data.departments || []);
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = appraisals.map((a) => ({
        "Name":             a.name,
        "Staff ID":         a.staffId || "",
        "Department":       a.department,
        "Unit":             a.unit    || "",
        "Period":           a.period,
        "Total Logs":       a.totalLogs,
        "Approved":         a.approved,
        "Rejected":         a.rejected,
        "Total Hours":      a.totalHours,
        "Active Days":      a.uniqueDays,
        "Approval Rate %":  a.approvalRate,
        "Avg Supervisor Score": a.avgScore ?? "N/A",
        "Overall Score":    a.overallScore,
        "Performance Rating": a.rating,
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 22 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Appraisals");
      XLSX.writeFile(wb, `FCCPC_Appraisals_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  async function exportPDF() {
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc  = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const m = 14;

      // Header
      doc.setFillColor(5, 46, 22);
      doc.rect(0, 0, pageW, 24, "F");
      doc.setTextColor(74, 222, 128);
      doc.setFontSize(15); doc.setFont("helvetica", "bold");
      doc.text("FCCPC — HR Appraisal Report", m, 11);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Period: ${period.charAt(0).toUpperCase() + period.slice(1)}  |  Generated: ${new Date().toLocaleDateString("en-GB")}  |  ${appraisals.length} staff`,
        m, 19
      );

      // Summary row
      doc.setFillColor(19, 21, 30);
      doc.rect(m, 28, pageW - m * 2, 14, "F");
      doc.setTextColor(200, 200, 200); doc.setFontSize(10);
      const sumItems = [
        `Total: ${summary?.total}`,
        `Outstanding: ${summary?.outstanding}`,
        `Exceeds: ${summary?.exceeds}`,
        `Meets: ${summary?.meets}`,
        `Below: ${summary?.below}`,
        `Avg Score: ${summary?.avgScore}%`,
      ];
      sumItems.forEach((t, i) => doc.text(t, m + i * 45, 37));

      // Table
      const headers = ["Name","Department","Logs","Hours","Approval%","Score","Rating"];
      const colWs   = [50, 55, 20, 20, 26, 20, 46];
      let y = 48;

      doc.setFillColor(10, 12, 18);
      doc.rect(m, y, pageW - m * 2, 8, "F");
      doc.setTextColor(120, 120, 120); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      let x = m;
      headers.forEach((h, i) => { doc.text(h.toUpperCase(), x + 2, y + 5.5); x += colWs[i]; });
      y += 8;

      doc.setFont("helvetica", "normal");
      appraisals.forEach((a, ri) => {
        if (y > pageH - 16) { doc.addPage(); y = 14; }
        if (ri % 2 === 0) {
          doc.setFillColor(15, 17, 23);
          doc.rect(m, y, pageW - m * 2, 7, "F");
        }
        doc.setTextColor(190, 190, 190); doc.setFontSize(8);
        const vals = [
          a.name.length > 22 ? a.name.slice(0, 20) + "…" : a.name,
          a.department.length > 24 ? a.department.slice(0, 22) + "…" : a.department,
          String(a.totalLogs),
          String(a.totalHours),
          `${a.approvalRate}%`,
          String(a.overallScore),
          a.rating,
        ];
        x = m;
        vals.forEach((v, i) => { doc.text(v, x + 2, y + 5); x += colWs[i]; });
        y += 7;
      });

      doc.setFillColor(5, 46, 22);
      doc.rect(0, pageH - 10, pageW, 10, "F");
      doc.setTextColor(74, 222, 128); doc.setFontSize(7);
      doc.text(`FCCPC Performance Intelligence System  |  Confidential HR Document  |  ${new Date().toLocaleDateString("en-GB")}`, m, pageH - 3);

      doc.save(`FCCPC_Appraisals_${period}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  const filtered = appraisals.filter((a) =>
    filterRating === "ALL" || a.rating === filterRating
  );

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const periodLabel = new Date().toLocaleDateString("en-GB", {
    month: "long", year: "numeric",
    ...(period === "annual" ? {} : {}),
  });

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              HR Appraisals
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · {period.charAt(0).toUpperCase() + period.slice(1)} review · {periodLabel}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={exportExcel} disabled={exporting} style={{ padding: "10px 20px", borderRadius: 10, border: "0.5px solid #14532d", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              {exporting ? "..." : "📊 Excel"}
            </button>
            <button onClick={exportPDF} disabled={exporting} style={{ padding: "10px 20px", borderRadius: 10, border: "0.5px solid #1e3a5f", background: "#0c1a2e", color: "#60a5fa", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              {exporting ? "..." : "📄 PDF"}
            </button>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Summary stats */}
        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 10, marginBottom: 22 }}>
            {[
              { label: "Total staff",    value: summary.total,         color: "var(--text-primary)" },
              { label: "Outstanding",    value: summary.outstanding,   color: "#4ade80" },
              { label: "Exceeds",        value: summary.exceeds,       color: "#60a5fa" },
              { label: "Meets",          value: summary.meets,         color: "#a78bfa" },
              { label: "Below",          value: summary.below,         color: "#f59e0b" },
              { label: "Unsatisfactory", value: summary.unsatisfactory, color: "#f87171" },
              { label: "Avg score",      value: `${summary.avgScore}%`, color: summary.avgScore >= 75 ? "#4ade80" : summary.avgScore >= 55 ? "#f59e0b" : "#f87171" },
            ].map((s) => (
              <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Controls row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          {/* Period */}
          <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 12, padding: 4 }}>
            {PERIODS.map((p) => (
              <button key={p.value} onClick={() => setPeriod(p.value)} style={{
                padding: "8px 20px", borderRadius: 9, fontSize: 14, fontWeight: 500,
                background: period === p.value ? "var(--accent-bg)" : "transparent",
                border: period === p.value ? "0.5px solid var(--accent-border)" : "none",
                color: period === p.value ? "var(--accent-text)" : "var(--text-muted)",
                cursor: "pointer",
              }}>{p.label}</button>
            ))}
          </div>

          {/* Department filter */}
          <select
            style={{ padding: "10px 14px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", cursor: "pointer" }}
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="ALL">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          {/* Rating filter */}
          <select
            style={{ padding: "10px 14px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", cursor: "pointer" }}
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
          >
            <option value="ALL">All ratings</option>
            {["Outstanding","Exceeds Expectation","Meets Expectation","Below Expectation","Unsatisfactory"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 16 }}>

          {/* Appraisal list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>Calculating appraisals...</div>
            ) : filtered.length === 0 ? (
              <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>📊</div>
                <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>No appraisal data yet</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Appraisals generate automatically once staff submit and supervisors approve daily logs</div>
              </div>
            ) : (
              filtered.map((a) => {
                const rs = RATING_STYLE[a.rating] || RATING_STYLE["Meets Expectation"];
                const isSelected = selected?.id === a.id;
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelected(isSelected ? null : a)}
                    className="card-bg"
                    style={{
                      borderRadius: 14, padding: "18px 22px", cursor: "pointer",
                      borderLeft: `3px solid ${isSelected ? "var(--accent)" : rs.color}`,
                      outline: `0.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {/* Avatar */}
                      <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: rs.bg, border: `1.5px solid ${rs.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: rs.color }}>
                        {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{a.name}</div>
                          {a.staffId && <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{a.staffId}</div>}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                          {a.department}{a.unit ? ` · ${a.unit}` : ""}
                        </div>
                      </div>

                      {/* Score */}
                      <div style={{ textAlign: "center", width: 70, flexShrink: 0 }}>
                        <div style={{ fontSize: 30, fontWeight: 700, color: a.ratingColor, letterSpacing: "-0.02em" }}>
                          {a.overallScore}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-hint)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Score</div>
                      </div>

                      {/* Rating badge */}
                      <span style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 10, background: rs.bg, color: rs.color, border: `0.5px solid ${rs.border}`, flexShrink: 0 }}>
                        {a.rating}
                      </span>
                    </div>

                    {/* Score breakdown bar */}
                    <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                      {[
                        { label: "Consistency", value: a.freqScore,    desc: `${a.uniqueDays} active days` },
                        { label: "Approval",    value: a.approvalRate, desc: `${a.approved}/${a.totalLogs} approved` },
                        { label: "Quality",     value: a.qualScore,    desc: a.avgScore ? `Avg ${a.avgScore}/10` : "No scores yet" },
                        { label: "Volume",      value: a.volScore,     desc: `${a.totalHours}h logged` },
                      ].map((metric) => (
                        <div key={metric.label}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{metric.label}</span>
                            <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600 }}>{metric.value}%</span>
                          </div>
                          <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 2, width: `${metric.value}%`, background: metric.value >= 75 ? "#22c55e" : metric.value >= 55 ? "#f59e0b" : "#ef4444" }} />
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-hint)", marginTop: 3 }}>{metric.desc}</div>
                        </div>
                      ))}
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
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>Appraisal detail</h3>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>

              {/* Staff header */}
              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", margin: "0 auto 12px",
                  background: RATING_STYLE[selected.rating]?.bg || "#1a1d28",
                  border: `2px solid ${RATING_STYLE[selected.rating]?.color || "#9ca3af"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 700,
                  color: RATING_STYLE[selected.rating]?.color || "#9ca3af",
                }}>
                  {selected.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{selected.department}</div>
                {selected.unit && <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 2 }}>{selected.unit}</div>}
                {selected.staffId && <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 2 }}>{selected.staffId}</div>}
              </div>

              {/* Overall score */}
              <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 20, textAlign: "center" }}>
                <div style={{ fontSize: 52, fontWeight: 700, color: selected.ratingColor, letterSpacing: "-0.03em" }}>{selected.overallScore}</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>Overall performance score</div>
                <span style={{ display: "inline-block", marginTop: 10, fontSize: 13, fontWeight: 600, padding: "6px 18px", borderRadius: 10, background: RATING_STYLE[selected.rating]?.bg, color: RATING_STYLE[selected.rating]?.color, border: `0.5px solid ${RATING_STYLE[selected.rating]?.border}` }}>
                  {selected.rating}
                </span>
                <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", marginTop: 14 }}>
                  <div style={{ height: "100%", borderRadius: 3, width: `${selected.overallScore}%`, background: selected.ratingColor }} />
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "Total logs",    value: selected.totalLogs },
                  { label: "Active days",   value: selected.uniqueDays },
                  { label: "Approved",      value: selected.approved },
                  { label: "Rejected",      value: selected.rejected },
                  { label: "Hours logged",  value: `${selected.totalHours}h` },
                  { label: "High priority", value: selected.highPriority },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{stat.value}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Top task categories */}
              {selected.topCategories.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Top task categories</div>
                  {selected.topCategories.map((c) => (
                    <div key={c.cat} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid var(--border-soft)" }}>
                      <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{c.cat}</span>
                      <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>{c.count} tasks</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendation */}
              <div style={{ background: RATING_STYLE[selected.rating]?.bg || "#1a1d28", border: `0.5px solid ${RATING_STYLE[selected.rating]?.border || "#374151"}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: RATING_STYLE[selected.rating]?.color || "#9ca3af", marginBottom: 6 }}>
                  HR Recommendation
                </div>
                <div style={{ fontSize: 13, color: RATING_STYLE[selected.rating]?.color || "#9ca3af", opacity: 0.85, lineHeight: 1.6 }}>
                  {selected.rating === "Outstanding" && "Exceptional performance. Recommend for promotion review, salary increment, and recognition award."}
                  {selected.rating === "Exceeds Expectation" && "Performance exceeds requirements. Eligible for performance bonus and fast-track consideration."}
                  {selected.rating === "Meets Expectation" && "Satisfactory performance. Continue with regular duties. Schedule routine check-in with supervisor."}
                  {selected.rating === "Below Expectation" && "Performance improvement required. Recommend 30-day Performance Improvement Plan (PIP) and increased supervisor engagement."}
                  {selected.rating === "Unsatisfactory" && "Critical performance issues. Mandatory HR interview required. Disciplinary procedure may apply."}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type StaffInsight = {
  id: string; name: string; email: string; department: string;
  overallScore: number; totalLogs: number; approved: number;
  rejected: number; totalHours: number; uniqueDays: number;
  weekLogs: number; avgScore: number | null;
  tag: string; tagColor: "green" | "amber" | "red" | "blue"; reason: string;
};

type DeptInsight = {
  id: string; name: string; shortCode: string;
  totalLogs: number; approvedLogs: number; approvalRate: number;
  staffCount: number; status: string;
};

type Summary = {
  totalStaff: number; promotionCandidates: number;
  flagged: number; lowActivity: number; avgScore: number;
};

const tagStyles: Record<string, { bg: string; color: string; border: string }> = {
  green: { bg: "#052e16", color: "#4ade80", border: "#14532d" },
  blue:  { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
  amber: { bg: "#1c1107", color: "#f59e0b", border: "#78350f" },
  red:   { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" },
};

const scoreColor = (s: number) =>
  s >= 80 ? "#4ade80" : s >= 60 ? "#f59e0b" : "#f87171";

export default function AIInsightsPage() {
  const [insights,     setInsights]     = useState<StaffInsight[]>([]);
  const [deptInsights, setDeptInsights] = useState<DeptInsight[]>([]);
  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState<"staff" | "dept">("staff");
  const [filter,       setFilter]       = useState("ALL");
  const [selected,     setSelected]     = useState<StaffInsight | null>(null);

  useEffect(() => { fetchInsights(); }, []);

  async function fetchInsights() {
    setLoading(true);
    try {
      const res  = await fetch("/api/ai-insights");
      const data = await res.json();
      setInsights(data.insights || []);
      setDeptInsights(data.deptInsights || []);
      setSummary(data.summary || null);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "ALL"
    ? insights
    : insights.filter((i) => i.tag === filter);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              AI Insights Engine
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · Auto-scored from daily log data · Last 30 days
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={fetchInsights}
              style={{
                padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                border: "0.5px solid var(--border)", background: "var(--bg-card)",
                color: "var(--text-muted)", cursor: "pointer",
              }}
            >
              Refresh
            </button>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
              borderRadius: 10, border: "1.5px solid #22c55e",
              background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              AI Active
            </div>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Summary cards */}
        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Staff analysed",      value: summary.totalStaff,          color: "var(--text-primary)" },
              { label: "Avg performance",     value: `${summary.avgScore}%`,       color: scoreColor(summary.avgScore) },
              { label: "Promotion candidates", value: summary.promotionCandidates, color: "#4ade80" },
              { label: "Low activity",        value: summary.lowActivity,          color: "#f59e0b" },
              { label: "Flagged",             value: summary.flagged,              color: "#f87171" },
            ].map((s) => (
              <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 12, padding: 4, width: "fit-content" }}>
          {(["staff", "dept"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "9px 24px", borderRadius: 9, fontSize: 14, fontWeight: 500,
                background: tab === t ? "var(--accent-bg)" : "transparent",
                border: tab === t ? "0.5px solid var(--accent-border)" : "none",
                color: tab === t ? "var(--accent-text)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {t === "staff" ? "Staff insights" : "Department insights"}
            </button>
          ))}
        </div>

        {tab === "staff" && (
          <>
            {/* Filter chips */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["ALL", "Promote", "On Track", "Watch", "Low Activity", "Quality Issues", "Flag"].map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
                  border: `0.5px solid ${filter === f ? "var(--accent)" : "var(--border)"}`,
                  background: filter === f ? "var(--accent-bg)" : "var(--bg-card)",
                  color: filter === f ? "var(--accent-text)" : "var(--text-muted)",
                  cursor: "pointer",
                }}>
                  {f === "ALL" ? `All staff (${insights.length})` : f}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 16 }}>
              {/* Staff list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {loading ? (
                  <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>
                    Running analysis...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="card-bg" style={{ borderRadius: 14, padding: 48, textAlign: "center" }}>
                    <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
                      No staff logs yet
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                      AI insights appear once staff submit daily work logs
                    </div>
                  </div>
                ) : (
                  filtered.map((s) => {
                    const ts = tagStyles[s.tagColor];
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelected(selected?.id === s.id ? null : s)}
                        className="card-bg"
                        style={{
                          borderRadius: 14, padding: "18px 20px", cursor: "pointer",
                          borderLeft: `3px solid ${selected?.id === s.id ? "var(--accent)" : "transparent"}`,
                          outline: `0.5px solid ${selected?.id === s.id ? "var(--accent)" : "var(--border)"}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          {/* Avatar */}
                          <div style={{
                            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                            background: "var(--accent-bg)", border: "1.5px solid var(--accent-border)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 600, color: "var(--accent-text)",
                          }}>
                            {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{s.name}</div>
                            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{s.department}</div>
                          </div>

                          {/* Score */}
                          <div style={{ textAlign: "center", flexShrink: 0 }}>
                            <div style={{ fontSize: 26, fontWeight: 700, color: scoreColor(s.overallScore), letterSpacing: "-0.02em" }}>
                              {s.overallScore}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-hint)", fontWeight: 500 }}>SCORE</div>
                          </div>

                          {/* Tag */}
                          <span style={{
                            fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
                            background: ts.bg, color: ts.color, border: `0.5px solid ${ts.border}`,
                            flexShrink: 0,
                          }}>
                            {s.tag}
                          </span>
                        </div>

                        {/* Reason + stats */}
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 13, color: "var(--text-muted)", flex: 1 }}>{s.reason}</div>
                          <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text-hint)", flexShrink: 0, marginLeft: 16 }}>
                            <span>{s.totalLogs} logs</span>
                            <span>{s.uniqueDays} active days</span>
                            <span>{s.totalHours}h total</span>
                          </div>
                        </div>

                        {/* Score bar */}
                        <div style={{ marginTop: 10, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 2,
                            width: `${s.overallScore}%`,
                            background: scoreColor(s.overallScore),
                          }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Staff detail panel */}
              {selected && (
                <div className="card-bg" style={{ borderRadius: 14, padding: 24, alignSelf: "start", position: "sticky", top: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                    <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>Staff profile</h3>
                    <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
                  </div>

                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <div style={{
                      width: 60, height: 60, borderRadius: "50%", margin: "0 auto 12px",
                      background: "var(--accent-bg)", border: "2px solid var(--accent)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, fontWeight: 700, color: "var(--accent-text)",
                    }}>
                      {selected.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{selected.name}</div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{selected.department}</div>
                    <div style={{ fontSize: 13, color: "var(--text-hint)", marginTop: 2 }}>{selected.email}</div>
                  </div>

                  {/* Overall score */}
                  <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 20, textAlign: "center" }}>
                    <div style={{ fontSize: 48, fontWeight: 700, color: scoreColor(selected.overallScore), letterSpacing: "-0.03em" }}>
                      {selected.overallScore}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Overall performance score</div>
                    <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden", marginTop: 12 }}>
                      <div style={{ height: "100%", borderRadius: 4, width: `${selected.overallScore}%`, background: scoreColor(selected.overallScore) }} />
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                    {[
                      { label: "Total logs",      value: selected.totalLogs },
                      { label: "Active days",     value: selected.uniqueDays },
                      { label: "Approved",        value: selected.approved },
                      { label: "Rejected",        value: selected.rejected },
                      { label: "Total hours",     value: `${selected.totalHours}h` },
                      { label: "This week",       value: `${selected.weekLogs} logs` },
                    ].map((stat) => (
                      <div key={stat.label} style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>{stat.value}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recommendation */}
                  <div style={{
                    background: tagStyles[selected.tagColor].bg,
                    border: `0.5px solid ${tagStyles[selected.tagColor].border}`,
                    borderRadius: 12, padding: 14,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: tagStyles[selected.tagColor].color, marginBottom: 6 }}>
                      AI Recommendation: {selected.tag}
                    </div>
                    <div style={{ fontSize: 13, color: tagStyles[selected.tagColor].color, opacity: 0.8, lineHeight: 1.5 }}>
                      {selected.reason}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "dept" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {deptInsights.map((dept, i) => {
              const statusC =
                dept.status === "ON_TRACK" ? { bg: "#052e16", color: "#4ade80", border: "#14532d" } :
                dept.status === "AT_RISK"  ? { bg: "#1c1107", color: "#f59e0b", border: "#78350f" } :
                                             { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" };
              return (
                <div key={dept.id} className="card-bg" style={{ borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--accent-text)", flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{dept.name}</div>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, width: `${dept.approvalRate}%`, background: scoreColor(dept.approvalRate) }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "center", width: 80 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(dept.approvalRate) }}>{dept.approvalRate}%</div>
                    <div style={{ fontSize: 12, color: "var(--text-hint)" }}>approval rate</div>
                  </div>
                  <div style={{ textAlign: "center", width: 60 }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{dept.staffCount}</div>
                    <div style={{ fontSize: 12, color: "var(--text-hint)" }}>staff</div>
                  </div>
                  <div style={{ textAlign: "center", width: 60 }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{dept.totalLogs}</div>
                    <div style={{ fontSize: 12, color: "var(--text-hint)" }}>logs</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, background: statusC.bg, color: statusC.color, border: `0.5px solid ${statusC.border}`, flexShrink: 0 }}>
                    {dept.status === "ON_TRACK" ? "On track" : dept.status === "AT_RISK" ? "At risk" : "Behind"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

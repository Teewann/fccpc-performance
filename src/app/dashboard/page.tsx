"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import { AGENCY } from "@/config/agency.config";
import UserAvatar from "@/components/UserAvatar";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────
type Filter = "today" | "week" | "month" | "year" | "custom";

type Kpi = {
  totalStaff: number;
  activeDepartments: number;
  logsInRange: number;
  approvedLogs: number;
  rejectedLogs: number;
  pendingLogs: number;
  queriedLogs: number;
  submittedInRange: number;
  tasksInRange: number;
  tasksPending: number;
  tasksCompleted: number;
  leaveInRange: number;
  leavePending: number;
};

type TrendPoint = { label: string; submitted: number; approved: number; rejected: number };
type DeptBar    = { name: string; logs: number; approved: number };
type PieSlice   = { name: string; value: number; fill: string };
type Performer  = { name: string; department: string; staffId: string | null; count: number };
type RecentLog  = { id: string; taskTitle: string; status: string; date: string; user: { name: string; department: { name: string } | null } };
type LowDept    = { name: string; staff: number };

type DashData = {
  kpi: Kpi;
  trendData: TrendPoint[];
  departmentChart: DeptBar[];
  pieData: PieSlice[];
  taskBreakdown: PieSlice[];
  performers: Performer[];
  recentLogs: RecentLog[];
  lowActivity: LowDept[];
};

// ─── Constants ────────────────────────────────────────────────────────
const FILTER_LABELS: Record<Filter, string> = {
  today: "Today", week: "This Week", month: "This Month",
  year: "This Year", custom: "Custom",
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  SUBMITTED: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
  APPROVED:  { bg: "#052e16", color: "#4ade80", border: "#14532d" },
  REJECTED:  { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" },
  DRAFT:     { bg: "#1a1d28", color: "#9ca3af", border: "#374151" },
  QUERIED:   { bg: "#1c1107", color: "#f59e0b", border: "#78350f" },
};

// ─── Sub-components ───────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color, pct, loading,
}: {
  label: string; value: string | number; sub: string;
  color: string; pct: number; loading: boolean;
}) {
  return (
    <div className="card-bg" style={{ borderRadius: 14, padding: "20px 22px" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>
        {loading ? <span style={{ color: "var(--text-hint)" }}>—</span> : value}
      </div>
      <div style={{ fontSize: 13, color, marginTop: 6, fontWeight: 500 }}>{sub}</div>
      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginTop: 12 }}>
        <div style={{
          height: "100%",
          width: loading ? "0%" : `${Math.min(100, Math.max(0, pct))}%`,
          background: color, borderRadius: 2,
          transition: "width 0.7s ease",
        }} />
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)", border: "0.5px solid var(--border)",
      borderRadius: 10, padding: "12px 16px", fontSize: 14,
    }}>
      <div style={{ color: "var(--text-muted)", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2, fontSize: 14 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ height = 200 }: { height?: number }) {
  return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-hint)", fontSize: 16 }}>
      No data for this period
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
      {children}
    </h2>
  );
}

// ─── Main page ────────────────────────────────────────────────────────
export default function DashboardPage() {
  useAutoLogout();

  const [filter,     setFilter]     = useState<Filter>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [data,       setData]       = useState<DashData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [userInfo,   setUserInfo]   = useState({
    name: "Admin",
    role: "ADMIN",
    initials: "AD",
    photo: null as string | null,
    userIdRef: null as string | null,
  });

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Fetch user profile (including photo and userIdRef) from the database
  useEffect(() => {
    fetch("/api/settings/account")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          const parts    = (d.user.name || "Admin").split(" ");
          const initials = parts.map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();
          setUserInfo({
            name: d.user.name,
            role: d.user.role,
            initials,
            photo: d.user.photo || null,
            userIdRef: d.user.userIdRef || null,
          });
        }
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (f: Filter, from?: string, to?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter: f });
      if (f === "custom" && from && to) {
        params.set("from", from);
        params.set("to", to);
      }
      const res  = await fetch(`/api/dashboard?${params}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filter !== "custom") fetchData(filter);
  }, [filter, fetchData]);

  function applyCustom() {
    if (!customFrom || !customTo) return;
    setFilter("custom");
    setShowPicker(false);
    fetchData("custom", customFrom, customTo);
  }

  const kpi = data?.kpi;
  const pct = (n: number, total: number) =>
    total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />

      <main className="flex-1 p-6 min-w-0" style={{ overflowY: "auto" }}>

        {/* ── Header ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {AGENCY.shortName}:  Executive Dashboard
            </h1>
            <p style={{ fontSize: 16, color: "var(--text-muted)", marginTop: 3 }}>{today} · Q2 Performance Cycle</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 10, background: "#052e16", border: "1.5px solid #22c55e", color: "#4ade80", fontSize: 15, fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", flexShrink: 0 }} />
              Live
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", borderRadius: 10, background: "var(--bg-card)", border: "0.5px solid var(--border)" }}>
              <UserAvatar
                user={{ photo: userInfo.photo, name: userInfo.name }}
                size={36}
              />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{userInfo.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{userInfo.role.charAt(0) + userInfo.role.slice(1).toLowerCase()}</div>
                {/* ✅ User ID in red */}
                <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif", color: "#ef4444", marginTop: 2 }}>
                  USER ID: {userInfo.userIdRef || "—"}
                  
                  </div>
              </div>
            </div>

            <ThemeToggleButton />
          </div>
        </div>

        {/* ── Filter tabs ───────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          {(["today", "week", "month", "year"] as Filter[]).map((f) => (
            <button key={f} onClick={() => { setFilter(f); setShowPicker(false); }} style={{
              padding: "10px 22px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer",
              border:      filter === f && f !== "custom" ? "1.5px solid #22c55e" : "0.5px solid var(--border)",
              background:  filter === f && f !== "custom" ? "#052e16"             : "var(--bg-card)",
              color:       filter === f && f !== "custom" ? "#4ade80"             : "var(--text-muted)",
              transition: "all 0.15s",
            }}>
              {FILTER_LABELS[f]}
            </button>
          ))}

          <button onClick={() => setShowPicker((p) => !p)} style={{
            padding: "10px 22px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer",
            border:     filter === "custom" ? "1.5px solid #22c55e" : "0.5px solid var(--border)",
            background: filter === "custom" ? "#052e16"             : "var(--bg-card)",
            color:      filter === "custom" ? "#4ade80"             : "var(--text-muted)",
            transition: "all 0.15s",
          }}>
            Custom range
          </button>

          {showPicker && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 10, background: "var(--bg-card)", border: "0.5px solid var(--border)" }}>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 14, color: "var(--text-primary)", outline: "none" }} />
              <span style={{ color: "var(--text-hint)", fontSize: 14 }}>to</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 14, color: "var(--text-primary)", outline: "none" }} />
              <button onClick={applyCustom} style={{ padding: "6px 16px", borderRadius: 8, background: "#052e16", border: "1.5px solid #22c55e", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Apply
              </button>
            </div>
          )}

          {loading && (
            <span style={{ fontSize: 14, color: "var(--text-hint)", marginLeft: 4 }}>Updating...</span>
          )}
        </div>

        {/* ── KPI row 1 ──────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
          <KpiCard label="Total staff"     value={kpi?.totalStaff ?? 0}      sub="active accounts"                                              color="#a78bfa" pct={100}                                               loading={loading} />
          <KpiCard label="Logs submitted"  value={kpi?.logsInRange ?? 0}     sub={`in ${FILTER_LABELS[filter].toLowerCase()}`}                 color="#3b82f6" pct={pct(kpi?.logsInRange ?? 0, (kpi?.totalStaff ?? 1) * 3)} loading={loading} />
          <KpiCard label="Approved logs"   value={kpi?.approvedLogs ?? 0}    sub={`${pct(kpi?.approvedLogs ?? 0, kpi?.logsInRange ?? 1)}% approval rate`}  color="#22c55e" pct={pct(kpi?.approvedLogs ?? 0, kpi?.logsInRange ?? 1)}    loading={loading} />
          <KpiCard label="Pending reviews" value={kpi?.pendingLogs ?? 0}     sub="need attention (all-time)"                                    color="#f59e0b" pct={pct(kpi?.pendingLogs ?? 0, kpi?.logsInRange ?? 1)}    loading={loading} />
        </div>

        {/* ── KPI row 2 ──────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          <KpiCard label="Rejected logs"    value={kpi?.rejectedLogs ?? 0}    sub={`${pct(kpi?.rejectedLogs ?? 0, kpi?.logsInRange ?? 1)}% rejection rate`} color="#ef4444" pct={pct(kpi?.rejectedLogs ?? 0, kpi?.logsInRange ?? 1)}   loading={loading} />
          <KpiCard label="Tasks created"    value={kpi?.tasksInRange ?? 0}    sub={`in ${FILTER_LABELS[filter].toLowerCase()}`}                 color="#06b6d4" pct={pct(kpi?.tasksInRange ?? 0, (kpi?.totalStaff ?? 1) * 2)} loading={loading} />
          <KpiCard label="Tasks pending"    value={kpi?.tasksPending ?? 0}    sub="unresolved (all-time)"                                        color="#f97316" pct={pct(kpi?.tasksPending ?? 0, kpi?.tasksInRange ?? 1)}    loading={loading} />
          <KpiCard label="Departments"      value={kpi?.activeDepartments ?? 0} sub="registered"                                                 color="#22c55e" pct={100}                                                  loading={loading} />
        </div>

        {/* ── Row: Line chart + Log status pie ─────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* Line chart */}
          <div className="card-bg" style={{ borderRadius: 14, padding: 24 }}>
            <SectionTitle>Submission trend — {FILTER_LABELS[filter]}</SectionTitle>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
              Log submissions by status over time
            </p>
            {!data || data.trendData.length === 0 ? <EmptyChart height={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.trendData} margin={{ top: 4, right: 12, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 13, fill: "var(--text-hint)" }} />
                  <YAxis tick={{ fontSize: 13, fill: "var(--text-hint)" }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 14, color: "var(--text-muted)", paddingTop: 8 }} />
                  <Line type="monotone" dataKey="submitted" stroke="#3b82f6" strokeWidth={2} dot={false} name="Submitted" />
                  <Line type="monotone" dataKey="approved"  stroke="#22c55e" strokeWidth={2} dot={false} name="Approved" />
                  <Line type="monotone" dataKey="rejected"  stroke="#ef4444" strokeWidth={2} dot={false} name="Rejected" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Log status doughnut */}
          <div className="card-bg" style={{ borderRadius: 14, padding: 24 }}>
            <SectionTitle>Log status breakdown</SectionTitle>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>
              For selected period
            </p>
            {!data || data.pieData.every((p) => p.value === 0) ? <EmptyChart height={160} /> : (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={data.pieData} dataKey="value" innerRadius={44} outerRadius={68} paddingAngle={3}>
                    {data.pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, n: any) => [v, n]}
                    contentStyle={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 8, fontSize: 14 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
              {data?.pieData.map((p) => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.fill, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{p.name}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Department bar chart ──────────────────────────────────── */}
        <div className="card-bg" style={{ borderRadius: 14, padding: 24, marginBottom: 16 }}>
          <SectionTitle>Department activity</SectionTitle>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
            Log submissions per department in selected period
          </p>
          {!data || data.departmentChart.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={data.departmentChart} margin={{ top: 4, right: 12, left: -24, bottom: 44 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 13, fill: "var(--text-hint)" }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 13, fill: "var(--text-hint)" }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 14, color: "var(--text-muted)", paddingTop: 4 }} />
                <Bar dataKey="logs"     name="Total logs" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="approved" name="Approved"   fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Row: Task breakdown pie + Top performers + Recent logs ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* Task breakdown pie */}
          <div className="card-bg" style={{ borderRadius: 14, padding: 24 }}>
            <SectionTitle>Task breakdown</SectionTitle>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>All-time task status</p>
            {!data || data.taskBreakdown.every((p) => p.value === 0) ? <EmptyChart height={150} /> : (
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={data.taskBreakdown} dataKey="value" innerRadius={40} outerRadius={62} paddingAngle={3}>
                    {data.taskBreakdown.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, n: any) => [v, n]}
                    contentStyle={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 8, fontSize: 14 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {data?.taskBreakdown.map((p) => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.fill, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{p.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top performers */}
          <div className="card-bg" style={{ borderRadius: 14, padding: 24 }}>
            <SectionTitle>Top performers</SectionTitle>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>Most approved logs in period</p>
            {!data || data.performers.length === 0 ? (
              <div style={{ color: "var(--text-hint)", fontSize: 15, textAlign: "center", padding: "24px 0" }}>
                No approved logs yet
              </div>
            ) : (
              data.performers.map((p, i) => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "0.5px solid var(--border-soft)" }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: i === 0 ? "#052e16" : "var(--bg-input)",
                    border: `1.5px solid ${i === 0 ? "#22c55e" : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: i === 0 ? "#4ade80" : "var(--text-muted)",
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.department}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", flexShrink: 0 }}>
                    {p.count}✓
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent logs */}
          <div className="card-bg" style={{ borderRadius: 14, padding: 24 }}>
            <SectionTitle>Recent submissions</SectionTitle>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>Latest staff activity</p>
            {!data || data.recentLogs.length === 0 ? (
              <div style={{ color: "var(--text-hint)", fontSize: 15, textAlign: "center", padding: "24px 0" }}>
                No logs submitted yet
              </div>
            ) : (
              data.recentLogs.map((log) => {
                const st       = STATUS_STYLE[log.status] || STATUS_STYLE.DRAFT;
                const initials = log.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 0", borderBottom: "0.5px solid var(--border-soft)" }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: "var(--accent-bg)", color: "var(--accent-text)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {log.user.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {log.taskTitle}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: st.bg, color: st.color, border: `0.5px solid ${st.border}`, flexShrink: 0 }}>
                      {log.status.charAt(0) + log.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Low activity departments ──────────────────────────────── */}
        <div className="card-bg" style={{ borderRadius: 14, padding: 24 }}>
          <SectionTitle>Low activity departments</SectionTitle>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
            Departments with no log submissions in the selected period
          </p>
          {!data ? null : data.lowActivity.length === 0 ? (
            <div style={{ color: "#22c55e", fontSize: 16, fontWeight: 500, textAlign: "center", padding: "16px 0" }}>
              🎉 All departments have activity in this period
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {data.lowActivity.map((d) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 10, background: "var(--bg-input)", border: "0.5px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                      {d.name.length > 24 ? d.name.slice(0, 24) + "…" : d.name}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{d.staff} staff</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "#1c1107", color: "#f59e0b", border: "0.5px solid #78350f" }}>
                    Inactive
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type AuditLog = {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
    role: string;
    department: { name: string } | null;
  };
};

const ACTION_CONFIG: Record<string, { bg: string; color: string; border: string; icon: string }> = {
  USER_LOGIN:               { bg: "#052e16", color: "#4ade80", border: "#14532d", icon: "🔐" },
  USER_LOGOUT:              { bg: "#1c1107", color: "#f59e0b", border: "#78350f", icon: "🚪" },
  REPORT_GENERATED:         { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", icon: "📊" },
  MEMO_PUBLISHED:           { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95", icon: "📨" },
  MEMO_FORWARDED:           { bg: "#1a0a2e", color: "#c084fc", border: "#6b21a8", icon: "↪️" },
  EVC_SUITE_ACCESS:         { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", icon: "⚡" },
  USER_CREATED:             { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", icon: "👤" },
  USER_UPDATED:             { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", icon: "✏️" },
  ACCOUNT_UPDATED:          { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", icon: "⚙️" },
  DAILY_LOG_SUBMITTED:      { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95", icon: "📋" },
  LOG_APPROVED:             { bg: "#052e16", color: "#4ade80", border: "#14532d", icon: "✅" },
  LOG_REJECTED:             { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", icon: "❌" },
  LOG_QUERIED:              { bg: "#1c1107", color: "#f59e0b", border: "#78350f", icon: "❓" },
  KPI_CREATED:              { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", icon: "🎯" },
  TASK_CREATED:             { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95", icon: "📌" },
  TASK_UPDATED:             { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95", icon: "🔄" },
  ANNOUNCEMENT_CREATED:     { bg: "#1c1107", color: "#f59e0b", border: "#78350f", icon: "📢" },
  LEAVE_REQUEST_SUBMITTED:  { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", icon: "🌴" },
  LEAVE_APPROVED:           { bg: "#052e16", color: "#4ade80", border: "#14532d", icon: "✅" },
  LEAVE_REJECTED:           { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", icon: "❌" },
  INTERN_LOG_SUBMITTED:     { bg: "#0c1a2e", color: "#38bdf8", border: "#0369a1", icon: "📓" },
  EXAM_CREATED:             { bg: "#1c1107", color: "#f59e0b", border: "#78350f", icon: "📝" },
  EXAM_COMPLETED:           { bg: "#052e16", color: "#4ade80", border: "#14532d", icon: "🎓" },
  PASSWORD_RESET_REQUESTED: { bg: "#1c1107", color: "#f59e0b", border: "#78350f", icon: "🔑" },
  CHECK_IN:                 { bg: "#052e16", color: "#4ade80", border: "#14532d", icon: "🏢" },
  CHECK_OUT:                { bg: "#1c1107", color: "#f59e0b", border: "#78350f", icon: "🚪" },
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] || { bg: "#1a1d28", color: "#9ca3af", border: "#374151", icon: "📝" };
}

function formatAction(action: string) {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

const ACTION_FILTERS = [
  "ALL",
  "USER_LOGIN",
  "USER_LOGOUT",
  "REPORT_GENERATED",
  "MEMO_PUBLISHED",
  "MEMO_FORWARDED",
  "EVC_SUITE_ACCESS",
  "DAILY_LOG_SUBMITTED",
  "LOG_APPROVED",
  "LOG_REJECTED",
  "TASK_CREATED",
  "USER_CREATED",
  "KPI_CREATED",
  "LEAVE_REQUEST_SUBMITTED",
  "EXAM_COMPLETED",
  "CHECK_IN",
  "CHECK_OUT",
];

export default function AuditTrailPage() {
  const [logs,    setLogs]    = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: "30",
        ...(search             ? { search }         : {}),
        ...(filter !== "ALL"   ? { action: filter } : {}),
        ...(dateFrom           ? { dateFrom }       : {}),
        ...(dateTo             ? { dateTo }         : {}),
      });
      const res  = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs   || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, search, filter, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(fetchLogs, 300);
    return () => clearTimeout(t);
  }, [fetchLogs]);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const inp: React.CSSProperties = {
    background: "var(--bg-input)",
    border: "0.5px solid var(--border)",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    color: "var(--text-primary)",
    outline: "none",
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Audit Trail
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · {total} total records · Admin view only
            </p>
          </div>
          <ThemeToggleButton />
        </div>

        {/* Info banner */}
        <div style={{ background: "#0c1a2e", border: "0.5px solid #1e3a5f", borderRadius: 12, padding: "14px 20px", marginBottom: 22, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🔒</span>
          <div style={{ fontSize: 14, color: "#60a5fa", lineHeight: 1.6 }}>
            Every action taken in this system is recorded here - logins, log submissions, approvals, user changes, exam completions, and more.
            This page is visible to System Administrators only.
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...inp, width: 280 }}
            placeholder="Search by name, email or action..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />

          <select
            style={{ ...inp, width: 220 }}
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          >
            {ACTION_FILTERS.map((a) => (
              <option key={a} value={a}>
                {a === "ALL" ? "All actions" : formatAction(a)}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>From</span>
            <input
              type="date" style={{ ...inp, width: 160 }}
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>To</span>
            <input
              type="date" style={{ ...inp, width: 160 }}
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>

          {(search || filter !== "ALL" || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(""); setFilter("ALL"); setDateFrom(""); setDateTo(""); setPage(1); }}
              style={{ ...inp, cursor: "pointer", color: "#f87171", borderColor: "#7f1d1d", background: "#1f070799" }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="card-bg" style={{ borderRadius: 14, overflow: "hidden" }}>

          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "42px 1.4fr 1.1fr 1.8fr 0.9fr",
            padding: "13px 22px",
            borderBottom: "0.5px solid var(--border-soft)",
            background: "var(--bg-input)",
          }}>
            {["", "Action", "User", "Detail", "Date & time"].map((h) => (
              <div key={h} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {h}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 56, textAlign: "center", fontSize: 15, color: "var(--text-muted)" }}>
              Loading audit records...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 64, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🔍</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                No records found
              </div>
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                Try adjusting your filters or date range
              </div>
            </div>
          ) : (
            logs.map((log, i) => {
              const ac = getActionConfig(log.action);
              return (
                <div
                  key={log.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "42px 1.4fr 1.1fr 1.8fr 0.9fr",
                    padding: "14px 22px",
                    borderBottom: "0.5px solid var(--border-soft)",
                    background: i % 2 === 0 ? "transparent" : "var(--bg-input)",
                    alignItems: "center",
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: ac.bg, border: `0.5px solid ${ac.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14,
                  }}>
                    {ac.icon}
                  </div>

                  {/* Action badge */}
                  <div>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 7,
                      background: ac.bg, color: ac.color, border: `0.5px solid ${ac.border}`,
                    }}>
                      {formatAction(log.action)}
                    </span>
                  </div>

                  {/* User */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {log.user.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {log.user.department?.name || log.user.role}
                    </div>
                  </div>

                  {/* Detail */}
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {log.detail || "No additional detail"}
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 12, color: "var(--text-hint)" }}>
                    <div>
                      {new Date(log.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </div>
                    <div style={{ marginTop: 2 }}>
                      {new Date(log.createdAt).toLocaleTimeString("en-US", {
                        hour: "2-digit", minute: "2-digit", hour12: true,
                        })}
                        </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderTop: "0.5px solid var(--border-soft)" }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, total)} of {total} records
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ ...inp, padding: "8px 18px", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1, fontSize: 13 }}
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      ...inp, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500,
                      background: page === p ? "var(--accent-bg)" : "var(--bg-input)",
                      color:      page === p ? "var(--accent-text)" : "var(--text-muted)",
                      border:     `0.5px solid ${page === p ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  style={{ ...inp, padding: "8px 18px", cursor: page === pages ? "not-allowed" : "pointer", opacity: page === pages ? 0.5 : 1, fontSize: 13 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
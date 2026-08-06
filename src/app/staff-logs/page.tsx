"use client";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type Log = {
  id: string;
  taskTitle: string;
  taskCategory: string;
  description: string;
  timeSpent: number;
  priority: string;
  status: string;
  caseReference: string | null;
  supervisorScore: number | null;
  supervisorComment: string | null;
  createdAt: string;
  date: string;
  user: {
    id: string;
    name: string;
    email: string;
    department: { name: string } | null;
    unit: { name: string } | null;
  };
  supervisor: { name: string } | null;
};

type Stats = {
  total: number;
  approved: number;
  submitted: number;
  rejected: number;
  totalHours: number;
};

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  SUBMITTED: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
  APPROVED:  { bg: "#052e16", color: "#4ade80", border: "#14532d" },
  REJECTED:  { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" },
  QUERIED:   { bg: "#1c1107", color: "#f59e0b", border: "#78350f" },
  DRAFT:     { bg: "#1a1d28", color: "#9ca3af", border: "#374151" },
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW:      "#4ade80",
  MEDIUM:   "#60a5fa",
  HIGH:     "#f59e0b",
  CRITICAL: "#f87171",
};

export default function StaffLogsPage() {
  const [logs,     setLogs]     = useState<Log[]>([]);
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Log | null>(null);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [pages,    setPages]    = useState(1);

  // Filters
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:   String(page),
        limit:  "20",
        status,
        ...(search   ? { search }   : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo   ? { dateTo }   : {}),
      });

      const res  = await fetch(`/api/staff-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs   || []);
      setStats(data.stats || null);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, status, search, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchLogs(); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const inputStyle = {
    background: "var(--bg-input)",
    border: "0.5px solid var(--border)",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    color: "var(--text-primary)",
    outline: "none",
  } as React.CSSProperties;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Staff Logs
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{today}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              padding: "8px 18px", borderRadius: 10, border: "1.5px solid #22c55e",
              background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              {total} total logs
            </div>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 22 }}>
            {[
              { label: "Total logs",   value: stats.total,      color: "var(--text-primary)" },
              { label: "Approved",     value: stats.approved,   color: "#4ade80" },
              { label: "Pending",      value: stats.submitted,  color: "#60a5fa" },
              { label: "Rejected",     value: stats.rejected,   color: "#f87171" },
              { label: "Total hours",  value: `${stats.totalHours}h`, color: "#a78bfa" },
            ].map((s) => (
              <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...inputStyle, width: 260 }}
            placeholder="Search task title, description, case ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            style={{ ...inputStyle, width: 160 }}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="ALL">All statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="QUERIED">Queried</option>
            <option value="DRAFT">Draft</option>
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>From</span>
            <input type="date" style={{ ...inputStyle, width: 150 }} value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>To</span>
            <input type="date" style={{ ...inputStyle, width: 150 }} value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>
          {(search || status !== "ALL" || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(""); setStatus("ALL"); setDateFrom(""); setDateTo(""); setPage(1); }}
              style={{ ...inputStyle, cursor: "pointer", color: "#f87171", borderColor: "#7f1d1d" }}
            >
              Clear filters
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 16 }}>

          {/* Table */}
          <div className="card-bg" style={{ borderRadius: 14, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.8fr 1fr 0.8fr 0.7fr 0.7fr 0.6fr",
              padding: "12px 20px",
              borderBottom: "0.5px solid var(--border-soft)",
              background: "var(--bg-input)",
            }}>
              {["Task", "Staff / Department", "Category", "Time", "Priority", "Status"].map((h) => (
                <div key={h} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {h}
                </div>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: 48, textAlign: "center", fontSize: 15, color: "var(--text-muted)" }}>
                Loading logs...
              </div>
            ) : logs.length === 0 ? (
              <div style={{ padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>No logs found</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Try adjusting your filters or date range</div>
              </div>
            ) : (
              logs.map((log, i) => {
                const ss = STATUS_STYLES[log.status]   || STATUS_STYLES.DRAFT;
                const isSelected = selected?.id === log.id;
                return (
                  <div
                    key={log.id}
                    onClick={() => setSelected(isSelected ? null : log)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.8fr 1fr 0.8fr 0.7fr 0.7fr 0.6fr",
                      padding: "14px 20px",
                      borderBottom: "0.5px solid var(--border-soft)",
                      cursor: "pointer",
                      background: isSelected ? "var(--accent-bg)" : i % 2 === 0 ? "transparent" : "var(--bg-input)",
                      transition: "background 0.1s",
                      alignItems: "center",
                    }}
                  >
                    {/* Task */}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                        {log.taskTitle.length > 40 ? log.taskTitle.slice(0, 38) + "…" : log.taskTitle}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-hint)" }}>
                        {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {log.caseReference && ` · ${log.caseReference}`}
                      </div>
                    </div>
                    {/* Staff */}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{log.user.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{log.user.department?.name || "No dept"}</div>
                    </div>
                    {/* Category */}
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{log.taskCategory}</div>
                    {/* Time */}
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{log.timeSpent}h</div>
                    {/* Priority */}
                    <div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                        background: `${PRIORITY_STYLES[log.priority]}22`,
                        color: PRIORITY_STYLES[log.priority],
                        border: `0.5px solid ${PRIORITY_STYLES[log.priority]}44`,
                      }}>
                        {log.priority}
                      </span>
                    </div>
                    {/* Status */}
                    <div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                        background: ss.bg, color: ss.color, border: `0.5px solid ${ss.border}`,
                      }}>
                        {log.status.charAt(0) + log.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "0.5px solid var(--border-soft)" }}>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total} logs
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ ...inputStyle, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{
                        ...inputStyle, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500,
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
                    style={{ ...inputStyle, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="card-bg" style={{ borderRadius: 14, padding: 24, alignSelf: "start", position: "sticky", top: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>Log detail</h3>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>

              {/* Staff info */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, padding: "12px 14px", background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent-bg)", border: "1.5px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--accent-text)", flexShrink: 0 }}>
                  {selected.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{selected.user.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {selected.user.department?.name} {selected.user.unit ? `· ${selected.user.unit.name}` : ""}
                  </div>
                </div>
              </div>

              {/* Task details */}
              {[
                { label: "Task title",    value: selected.taskTitle },
                { label: "Category",      value: selected.taskCategory },
                { label: "Time spent",    value: `${selected.timeSpent} hours` },
                { label: "Priority",      value: selected.priority },
                { label: "Status",        value: selected.status },
                { label: "Date",          value: new Date(selected.createdAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
                ...(selected.caseReference ? [{ label: "Case reference", value: selected.caseReference }] : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                  <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{value}</div>
                </div>
              ))}

              {/* Description */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                  {selected.description}
                </div>
              </div>

              {/* Supervisor feedback */}
              {(selected.supervisorScore || selected.supervisorComment || selected.supervisor) && (
                <div style={{ marginTop: 4, padding: "12px 14px", background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", borderRadius: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-text)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Supervisor feedback
                  </div>
                  {selected.supervisor && (
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Reviewed by: {selected.supervisor.name}</div>
                  )}
                  {selected.supervisorScore !== null && (
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-text)", marginBottom: 6 }}>
                      Score: {selected.supervisorScore} / 10
                    </div>
                  )}
                  {selected.supervisorComment && (
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      "{selected.supervisorComment}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

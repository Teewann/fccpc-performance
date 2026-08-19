"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import UserAvatar from "@/components/UserAvatar";

// ─── Types ────────────────────────────────────────────────────────────
type StaffLoad = {
  id: string;
  name: string;
  email: string;
  role: string;
  staffId: string | null;
  photo?: string | null;
  department: { id: string; name: string; shortCode?: string } | null;
  unit: { name: string } | null;
  activeTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completedThisMonth: number;
  loadLevel: "EMPTY" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  loadScore: number;
  tasks: TaskSummary[];
};

type TaskSummary = {
  id: string;
  taskRef: string | null;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
  isOverdue: boolean;
};

type UnassignedTask = {
  id: string;
  taskRef: string | null;
  title: string;
  priority: string;
  dueDate: string | null;
  department: { name: string };
  createdBy: { name: string };
  createdAt: string;
};

type Department = { id: string; name: string };

// ─── Load level config - calm, readable ──────────────────────────────
const LOAD = {
  EMPTY:    { label: "Free",      color: "#64748b", accent: "#94a3b8", bar: "#334155", pct: 0   },
  LOW:      { label: "Light",     color: "#16a34a", accent: "#4ade80", bar: "#4ade80", pct: 20  },
  MEDIUM:   { label: "Moderate",  color: "#d97706", accent: "#fbbf24", bar: "#fbbf24", pct: 55  },
  HIGH:     { label: "Busy",      color: "#dc2626", accent: "#f87171", bar: "#f87171", pct: 80  },
  CRITICAL: { label: "Overloaded",color: "#991b1b", accent: "#ef4444", bar: "#ef4444", pct: 100 },
};

const PRIORITY_DOT: Record<string, string> = {
  LOW: "#4ade80", MEDIUM: "#60a5fa", HIGH: "#f59e0b", CRITICAL: "#ef4444",
};

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────
export default function TaskLoadBalancerPage() {
  const router = useRouter();

  // Data
  const [staffList,    setStaffList]    = useState<StaffLoad[]>([]);
  const [unassigned,   setUnassigned]   = useState<UnassignedTask[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [userRole,     setUserRole]     = useState("");
  const [userName,     setUserName]     = useState("");
  const [userDeptId,   setUserDeptId]   = useState<string | null>(null);

  // UI state
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [tab,          setTab]          = useState<"workload" | "unassigned" | "compare">("workload");
  const [filterDept,   setFilterDept]   = useState("ALL");
  const [filterLoad,   setFilterLoad]   = useState("ALL");
  const [searchQ,      setSearchQ]      = useState("");
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // Multi-select for reassignment
  const [selectedTasks,  setSelectedTasks]  = useState<Set<string>>(new Set());
  const [selectedTarget,  setSelectedTarget] = useState<string>("");   // staff id to receive tasks
  const [assigningMode,  setAssigningMode]  = useState(false);  // are we in "pick a receiver" mode?
  const [submitting,     setSubmitting]     = useState(false);
  const [toast,          setToast]          = useState<{ msg: string; ok: boolean } | null>(null);

  // Multi-select for unassigned panel
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());
  const [unassignedTarget,   setUnassignedTarget]   = useState<string>("");

  // ─── Toast helper ─────────────────────────────────────────────────
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // ─── Fetch data ───────────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [lbRes, deptRes, meRes] = await Promise.all([
        fetch("/api/task-load-balancer"),
        fetch("/api/departments"),
        fetch("/api/settings/account"),
      ]);
      const lbData   = await lbRes.json();
      const deptData = await deptRes.json();
      const meData   = await meRes.json();

      if (lbRes.ok) {
        // Enrich with tasks array if not present
        setStaffList(lbData.staffLoads || []);
        setUnassigned(lbData.unassigned || []);
      } else {
        showToast(lbData.error || "Failed to load data", false);
      }
      if (deptRes.ok) setDepartments(deptData.departments || []);
      if (meRes.ok && meData.user) {
        setUserRole(meData.user.role);
        setUserName(meData.user.name || "");
        setUserDeptId(meData.user.departmentId || null);
      }
    } catch {
      showToast("Network error - check your connection", false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Reassign selected tasks from one staff to another ────────────
  async function handleReassign() {
    if (!selectedTarget || selectedTasks.size === 0) return;
    setSubmitting(true);
    let successCount = 0;
    const errors: string[] = [];
    for (const taskId of selectedTasks) {
      try {
        const res = await fetch("/api/task-load-balancer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, assignedToId: selectedTarget, reason: "Rebalanced via Load Balancer" }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
        } else {
          errors.push(data.error || `Task ${taskId} failed`);
          console.error("Reassign error:", data.error, "status:", res.status);
        }
      } catch (err) {
        errors.push(String(err));
        console.error("Reassign network error:", err);
      }
    }
    setSubmitting(false);
    setSelectedTasks(new Set());
    setSelectedTarget("");
    setAssigningMode(false);
    if (successCount > 0) {
      showToast(`${successCount} task${successCount !== 1 ? "s" : ""} reassigned successfully`);
    } else {
      showToast(`Reassignment failed. ${errors[0] || "Check your permissions."}`, false);
    }
    await fetchAll(true);
  }

  // ─── Assign unassigned tasks to a staff member ────────────────────
  async function handleAssignUnassigned() {
    if (!unassignedTarget || selectedUnassigned.size === 0) return;
    setSubmitting(true);
    let successCount = 0;
    const errors: string[] = [];
    for (const taskId of selectedUnassigned) {
      try {
        const res = await fetch("/api/task-load-balancer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, assignedToId: unassignedTarget, reason: "Assigned via Load Balancer" }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
        } else {
          errors.push(data.error || `Task ${taskId} failed`);
          console.error("Assign error:", data.error, "status:", res.status);
        }
      } catch (err) {
        errors.push(String(err));
      }
    }
    setSubmitting(false);
    setSelectedUnassigned(new Set());
    setUnassignedTarget("");
    if (successCount > 0) {
      showToast(`${successCount} task${successCount !== 1 ? "s" : ""} assigned successfully`);
    } else {
      showToast(`Assignment failed. ${errors[0] || "Check your permissions."}`, false);
    }
    await fetchAll(true);
  }

  // ─── Filtered staff ───────────────────────────────────────────────
  const filtered = staffList
    .filter(s => {
      if (filterDept !== "ALL" && s.department?.id !== filterDept) return false;
      if (filterLoad !== "ALL" && s.loadLevel !== filterLoad) return false;
      if (searchQ && !s.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.activeTasks - a.activeTasks);

  // ─── Summary numbers ──────────────────────────────────────────────
  const totalTasks  = staffList.reduce((n, s) => n + s.activeTasks, 0);
  const avgLoad     = staffList.length ? Math.round(totalTasks / staffList.length) : 0;
  const critical    = staffList.filter(s => ["HIGH", "CRITICAL"].includes(s.loadLevel)).length;
  const available   = staffList.filter(s => ["EMPTY", "LOW"].includes(s.loadLevel)).length;

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // ─── Helpers ──────────────────────────────────────────────────────
  function toggleTask(taskId: string) {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  }
  function toggleUnassigned(taskId: string) {
    setSelectedUnassigned(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  }

  // ─── Styles ───────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "0.5px solid var(--border)",
    borderRadius: 14,
  };
  const inp: React.CSSProperties = {
    background: "var(--bg-input)",
    border: "0.5px solid var(--border)",
    borderRadius: 9,
    padding: "9px 13px",
    fontSize: 14,
    color: "var(--text-primary)",
    outline: "none",
  };
  const btn = (active: boolean, color = "var(--accent)"): React.CSSProperties => ({
    padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
    border: `0.5px solid ${active ? color : "var(--border)"}`,
    background: active ? `${color}22` : "var(--bg-input)",
    color: active ? color : "var(--text-muted)",
  });

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)", fontFamily: "inherit" }}>
      <Sidebar />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? "#052e16" : "#1f0707",
          border: `1px solid ${toast.ok ? "#14532d" : "#7f1d1d"}`,
          color: toast.ok ? "#4ade80" : "#f87171",
          borderRadius: 12, padding: "14px 20px", fontSize: 14, fontWeight: 600,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", gap: 10, minWidth: 280,
        }}>
          <span style={{ fontSize: 18 }}>{toast.ok ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}

      <main className="flex-1 min-w-0" style={{ display: "flex", flexDirection: "column", maxHeight: "100vh", overflow: "hidden" }}>

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div style={{ background: "var(--bg-card)", borderBottom: "0.5px solid var(--border)", padding: "16px 28px", flexShrink: 0 }}>

          {/* Top row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button
                onClick={() => router.back()}
                style={{ ...inp, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
              >
                ← Back
              </button>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>⚖️</span>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                    Task Load Balancer
                  </h1>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>
                  {today} · Redistribute work across your team
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={() => fetchAll(true)}
                disabled={refreshing}
                style={{ ...inp, padding: "9px 16px", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.6 : 1 }}
              >
                <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>⟳</span>
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              <ThemeToggleButton />
            </div>
          </div>

          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Total active tasks",  value: totalTasks,           color: "var(--text-primary)" },
              { label: "Avg tasks per person", value: `${avgLoad}`,         color: "#f59e0b"             },
              { label: "Overloaded staff",     value: critical,              color: "#f87171"             },
              { label: "Available staff",      value: available,             color: "#4ade80"             },
              { label: "Unassigned tasks",     value: unassigned.length,     color: "#a78bfa"             },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: "12px 16px" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontWeight: 500, lineHeight: 1.3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs + filters */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, background: "var(--bg-input)", borderRadius: 10, padding: 4 }}>
              {[
                { id: "workload",   label: "👥 Staff Workload" },
                { id: "unassigned", label: `📋 Unassigned (${unassigned.length})` },
                { id: "compare",    label: "📊 Compare" },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id as any)} style={{
                  padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "none",
                  background: tab === t.id ? "var(--bg-card)" : "transparent",
                  color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Filters - only for workload tab */}
            {tab === "workload" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  style={{ ...inp, width: 180 }}
                  placeholder="🔍 Search name…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
                <select style={inp} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                  <option value="ALL">All departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select style={inp} value={filterLoad} onChange={e => setFilterLoad(e.target.value)}>
                  <option value="ALL">All load levels</option>
                  <option value="CRITICAL">🔴 Overloaded</option>
                  <option value="HIGH">🟠 Busy</option>
                  <option value="MEDIUM">🟡 Moderate</option>
                  <option value="LOW">🟢 Light</option>
                  <option value="EMPTY">⚪ Free</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── STICKY ACTION BAR - always visible, never scrolls away ── */}
        {tab === "workload" && selectedTasks.size > 0 && (
          <div style={{
            flexShrink: 0,
            background: "#1a0a2e",
            borderBottom: "1.5px solid #7c3aed",
            borderTop: "0.5px solid #4c1d95",
            padding: "12px 28px",
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            zIndex: 10,
          }}>
            {/* Left: selection info */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>
                {selectedTasks.size} task{selectedTasks.size !== 1 ? "s" : ""} selected
              </div>
              <div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 2 }}>
                {!assigningMode
                  ? "Click \"Reassign\" to choose who receives these tasks"
                  : selectedTarget
                    ? `→ Assigning to: ${staffList.find(s => s.id === selectedTarget)?.name}`
                    : "Now scroll down and click any staff card to choose recipient"}
              </div>
            </div>

            {/* Right: action buttons */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {!assigningMode ? (
                <button
                  onClick={() => setAssigningMode(true)}
                  style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #a78bfa", background: "#2e1065", color: "#a78bfa", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Reassign to someone →
                </button>
              ) : selectedTarget ? (
                <>
                  <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 600 }}>
                    ✓ {staffList.find(s => s.id === selectedTarget)?.name}
                  </div>
                  <button
                    onClick={handleReassign}
                    disabled={submitting}
                    style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #4ade80", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
                  >
                    {submitting ? "Saving…" : "Confirm ✓"}
                  </button>
                  <button
                    onClick={() => setSelectedTarget("")}
                    style={{ padding: "10px 16px", borderRadius: 10, border: "0.5px solid #4c1d95", background: "transparent", color: "#a78bfa", fontSize: 13, cursor: "pointer" }}
                  >
                    Change recipient
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#8b5cf6", fontStyle: "italic" }}>
                  👇 Scroll down - click a staff card to select them
                </div>
              )}
              <button
                onClick={() => { setSelectedTasks(new Set()); setAssigningMode(false); setSelectedTarget(""); }}
                style={{ padding: "10px 16px", borderRadius: 10, border: "0.5px solid #4c1d95", background: "transparent", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ───────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "var(--text-muted)", fontSize: 15 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                Loading staff workload data…
              </div>
            </div>
          ) : (
            <>
              {/* ── TAB: WORKLOAD ──────────────────────────────── */}
              {tab === "workload" && (
                <div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
                    {filtered.length} staff member{filtered.length !== 1 ? "s" : ""}
                    {assigningMode && " · Click any card below to select them as task recipient"}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
                    {filtered.map(member => {
                      const lc = LOAD[member.loadLevel];
                      const isExpanded = expandedId === member.id;
                      const isRecipient = selectedTarget === member.id;

                      return (
                        <div
                          key={member.id}
                          style={{
                            ...card,
                            overflow: "hidden",
                            borderColor: isRecipient ? "#a78bfa" : assigningMode ? "#4ade8044" : "var(--border)",
                            outline: isRecipient ? "2px solid #7c3aed" : "none",
                            cursor: assigningMode ? "pointer" : "default",
                            transition: "border-color 0.15s, outline 0.15s",
                          }}
                          onClick={() => {
                            if (assigningMode) setSelectedTarget(member.id === selectedTarget ? "" : member.id);
                          }}
                        >
                          {/* Load bar at top */}
                          <div style={{ height: 4, background: "var(--border)" }}>
                            <div style={{ height: "100%", width: `${member.loadScore}%`, background: lc.bar, transition: "width 0.6s ease" }} />
                          </div>

                          <div style={{ padding: "16px 18px" }}>
                            {/* Staff info row */}
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                              {/* Avatar - real photo if available */}
                              <div
                                onClick={e => { e.stopPropagation(); router.push(`/staff-directory?userId=${member.id}`); }}
                                style={{ cursor: "pointer", flexShrink: 0 }}
                                title="View staff profile"
                              >
                                <UserAvatar user={{ photo: member.photo, name: member.name }} size={46} />
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Name - clicking takes to staff profile */}
                                <div style={{ marginBottom: 2 }}>
                                  <span
                                    onClick={e => { e.stopPropagation(); router.push(`/staff-directory?userId=${member.id}`); }}
                                    style={{
                                      fontSize: 15, fontWeight: 700, color: "var(--text-primary)",
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                      textDecorationColor: "transparent",
                                      textUnderlineOffset: 3,
                                      transition: "text-decoration-color 0.15s",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.textDecorationColor = "var(--text-primary)")}
                                    onMouseLeave={e => (e.currentTarget.style.textDecorationColor = "transparent")}
                                    title="View full profile & history"
                                  >
                                    {member.name}
                                  </span>
                                  {isRecipient && <span style={{ marginLeft: 8, fontSize: 12, color: "#a78bfa" }}>← selected</span>}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                  {member.department?.name || "No department"}
                                  {member.unit && ` · ${member.unit.name}`}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                                  {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                                  {member.staffId && ` · ${member.staffId}`}
                                </div>
                              </div>

                              {/* Task count */}
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 32, fontWeight: 900, color: lc.color, lineHeight: 1, letterSpacing: "-0.04em" }}>
                                  {member.activeTasks}
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>tasks</div>
                              </div>
                            </div>

                            {/* Load badge + stats */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                              <span style={{
                                fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 7,
                                color: lc.color, background: `${lc.color}18`,
                                border: `0.5px solid ${lc.color}44`,
                              }}>
                                {lc.label}
                              </span>
                              <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                                {member.overdueTasks > 0 && (
                                  <span style={{ color: "#f87171", fontWeight: 600 }}>⚠ {member.overdueTasks} overdue</span>
                                )}
                                <span style={{ color: "var(--text-muted)" }}>✓ {member.completedThisMonth} done</span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ height: 6, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${member.loadScore}%`, background: lc.bar, borderRadius: 4, transition: "width 0.6s ease" }} />
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                                <span>{member.pendingTasks} pending</span>
                                <span>{member.loadScore}% capacity</span>
                              </div>
                            </div>

                            {/* Action row */}
                            {!assigningMode && (
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : member.id); }}
                                  style={{ ...btn(isExpanded), flex: 1, fontSize: 12 }}
                                >
                                  {isExpanded ? "Hide tasks ▲" : `View tasks ▼`}
                                </button>
                                {member.activeTasks > 0 && (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      // Select ALL of this staff's tasks for reassignment
                                      const newSet = new Set(selectedTasks);
                                      const staffTaskIds = member.tasks.map(t => t.id);
                                      const allSelected = staffTaskIds.every(id => newSet.has(id));
                                      if (allSelected) {
                                        staffTaskIds.forEach(id => newSet.delete(id));
                                      } else {
                                        staffTaskIds.forEach(id => newSet.add(id));
                                      }
                                      setSelectedTasks(newSet);
                                      setExpandedId(member.id);
                                    }}
                                    style={{ ...btn(member.tasks.every(t => selectedTasks.has(t.id)) && member.tasks.length > 0, "#f59e0b"), fontSize: 12 }}
                                  >
                                    {member.tasks.every(t => selectedTasks.has(t.id)) && member.tasks.length > 0 ? "Deselect all" : "Select all"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Expanded task list */}
                          {isExpanded && !assigningMode && (
                            <div style={{ borderTop: "0.5px solid var(--border)", padding: "14px 18px", background: "var(--bg-input)" }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Tasks - click to select for reassignment
                              </div>
                              {!member.tasks || member.tasks.length === 0 ? (
                                <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>No active tasks</div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                  {member.tasks.map(task => {
                                    const isSelected = selectedTasks.has(task.id);
                                    const dot = PRIORITY_DOT[task.priority] || "#60a5fa";
                                    return (
                                      <div
                                        key={task.id}
                                        onClick={() => toggleTask(task.id)}
                                        style={{
                                          background: isSelected ? "#1a0a2e" : "var(--bg-card)",
                                          borderTop: `0.5px solid ${isSelected ? "#7c3aed" : "var(--border)"}`,
                                          borderRight: `0.5px solid ${isSelected ? "#7c3aed" : "var(--border)"}`,
                                          borderBottom: `0.5px solid ${isSelected ? "#7c3aed" : "var(--border)"}`,
                                          borderLeft: `3px solid ${dot}`,
                                          borderRadius: 9,
                                          padding: "10px 12px",
                                          cursor: "pointer",
                                          transition: "background 0.15s",
                                          display: "flex",
                                          alignItems: "flex-start",
                                          gap: 10,
                                        }}
                                      >
                                        {/* Checkbox */}
                                        <div style={{
                                          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                                          border: `1.5px solid ${isSelected ? "#a78bfa" : "var(--border)"}`,
                                          background: isSelected ? "#7c3aed" : "transparent",
                                          display: "flex", alignItems: "center", justifyContent: "center",
                                          marginTop: 1,
                                        }}>
                                          {isSelected && <span style={{ fontSize: 11, color: "white", fontWeight: 800 }}>✓</span>}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          {/* Task title - clickable link to the task */}
                                          <div style={{ marginBottom: 4 }}>
                                            <span
                                              onClick={e => { e.stopPropagation(); router.push(`/tasks?taskId=${task.id}`); }}
                                              style={{
                                                fontSize: 13, fontWeight: 600,
                                                color: "#60a5fa",
                                                cursor: "pointer",
                                                textDecoration: "underline",
                                                textDecorationThickness: 1,
                                                textUnderlineOffset: 2,
                                                transition: "font-weight 0.1s, color 0.1s",
                                                lineHeight: 1.4,
                                                display: "inline-flex", alignItems: "center", gap: 4,
                                              }}
                                              onMouseEnter={e => { e.currentTarget.style.fontWeight = "700"; e.currentTarget.style.color = "#93c5fd"; }}
                                              onMouseLeave={e => { e.currentTarget.style.fontWeight = "600"; e.currentTarget.style.color = "#60a5fa"; }}
                                              title="Open task details"
                                            >
                                              {task.title}
                                              <span style={{ fontSize: 10, opacity: 0.7 }}>↗</span>
                                            </span>
                                          </div>
                                          <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--text-muted)", flexWrap: "wrap" }}>
                                            {task.taskRef && <span style={{ fontFamily: "monospace", color: "#f59e0b" }}>#{task.taskRef}</span>}
                                            <span style={{ color: dot }}>{task.priority}</span>
                                            {task.dueDate && (
                                              <span style={{ color: task.isOverdue ? "#f87171" : "var(--text-muted)" }}>
                                                {task.isOverdue ? "⚠ Overdue" : `Due ${new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {filtered.length === 0 && !loading && (
                    <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                      <div style={{ fontSize: 16, fontWeight: 500 }}>No staff found</div>
                      <div style={{ fontSize: 13, marginTop: 6 }}>Try adjusting your filters</div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: UNASSIGNED ────────────────────────────── */}
              {tab === "unassigned" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
                  {/* Left: task list */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                          Unassigned Tasks
                        </h2>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
                          Select tasks below, then choose a staff member on the right to assign them
                        </p>
                      </div>
                      {selectedUnassigned.size > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa" }}>
                          {selectedUnassigned.size} selected
                        </span>
                      )}
                    </div>

                    {unassigned.length === 0 ? (
                      <div style={{ ...card, padding: "60px 40px", textAlign: "center" }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>All tasks are assigned</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No pending unassigned tasks</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {/* Select all row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                          <div
                            onClick={() => {
                              if (selectedUnassigned.size === unassigned.length) {
                                setSelectedUnassigned(new Set());
                              } else {
                                setSelectedUnassigned(new Set(unassigned.map(t => t.id)));
                              }
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-muted)", userSelect: "none" }}
                          >
                            <div style={{
                              width: 18, height: 18, borderRadius: 5,
                              border: `1.5px solid ${selectedUnassigned.size === unassigned.length ? "#a78bfa" : "var(--border)"}`,
                              background: selectedUnassigned.size === unassigned.length ? "#7c3aed" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {selectedUnassigned.size === unassigned.length && <span style={{ fontSize: 11, color: "white", fontWeight: 800 }}>✓</span>}
                            </div>
                            Select all {unassigned.length} tasks
                          </div>
                        </div>

                        {unassigned.map(task => {
                          const isSel = selectedUnassigned.has(task.id);
                          const dot = PRIORITY_DOT[task.priority] || "#60a5fa";
                          const overdue = task.dueDate && new Date(task.dueDate) < new Date();
                          return (
                            <div
                              key={task.id}
                              onClick={() => toggleUnassigned(task.id)}
                              style={{
                                background: isSel ? "#1a0a2e" : "var(--bg-card)",
                                borderRadius: 14,
                                padding: "14px 18px",
                                cursor: "pointer",
                                borderTop: `0.5px solid ${isSel ? "#7c3aed" : "var(--border)"}`,
                                borderRight: `0.5px solid ${isSel ? "#7c3aed" : "var(--border)"}`,
                                borderBottom: `0.5px solid ${isSel ? "#7c3aed" : "var(--border)"}`,
                                borderLeft: `3px solid ${dot}`,
                                display: "flex", alignItems: "flex-start", gap: 12,
                                transition: "background 0.15s",
                              }}
                            >
                              {/* Checkbox */}
                              <div style={{
                                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                                border: `1.5px solid ${isSel ? "#a78bfa" : "var(--border)"}`,
                                background: isSel ? "#7c3aed" : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                marginTop: 1,
                              }}>
                                {isSel && <span style={{ fontSize: 12, color: "white", fontWeight: 800 }}>✓</span>}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>
                                    {task.title}
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: `${dot}18`, color: dot, border: `0.5px solid ${dot}44`, flexShrink: 0, marginLeft: 10 }}>
                                    {task.priority}
                                  </span>
                                </div>
                                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-muted)", flexWrap: "wrap" }}>
                                  {task.taskRef && <span style={{ fontFamily: "monospace", color: "#f59e0b" }}>#{task.taskRef}</span>}
                                  <span>🏛 {task.department.name}</span>
                                  <span>By {task.createdBy.name}</span>
                                  {task.dueDate && (
                                    <span style={{ color: overdue ? "#f87171" : "var(--text-muted)", fontWeight: overdue ? 600 : 400 }}>
                                      {overdue ? "⚠ Overdue" : `📅 Due ${new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right: assign panel */}
                  <div>
                    <div style={{ ...card, padding: "20px", position: "sticky", top: 20 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>
                        Assign to Staff
                      </h3>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
                        {selectedUnassigned.size === 0
                          ? "First select tasks from the list on the left"
                          : `${selectedUnassigned.size} task${selectedUnassigned.size !== 1 ? "s" : ""} selected - now choose a staff member`}
                      </p>

                      {/* Staff options */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, maxHeight: 380, overflowY: "auto" }}>
                        {staffList
                          .sort((a, b) => a.activeTasks - b.activeTasks) // lightest load first
                          .map(s => {
                            const lc = LOAD[s.loadLevel];
                            const isChosen = unassignedTarget === s.id;
                            return (
                              <div
                                key={s.id}
                                onClick={() => setUnassignedTarget(isChosen ? "" : s.id)}
                                style={{
                                  padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                                  border: `0.5px solid ${isChosen ? "#a78bfa" : "var(--border)"}`,
                                  background: isChosen ? "#1a0a2e" : "var(--bg-input)",
                                  display: "flex", alignItems: "center", gap: 10,
                                  transition: "all 0.15s",
                                }}
                              >
                                <UserAvatar user={{ photo: s.photo, name: s.name }} size={34} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: isChosen ? "#a78bfa" : "var(--text-primary)" }}>
                                    {s.name} {isChosen && "✓"}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    {s.department?.name} · {s.activeTasks} tasks · <span style={{ color: LOAD[s.loadLevel].color }}>{LOAD[s.loadLevel].label}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <button
                        onClick={handleAssignUnassigned}
                        disabled={submitting || selectedUnassigned.size === 0 || !unassignedTarget}
                        style={{
                          width: "100%", padding: "12px", borderRadius: 10,
                          border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80",
                          fontSize: 14, fontWeight: 700,
                          cursor: (submitting || selectedUnassigned.size === 0 || !unassignedTarget) ? "not-allowed" : "pointer",
                          opacity: (submitting || selectedUnassigned.size === 0 || !unassignedTarget) ? 0.4 : 1,
                        }}
                      >
                        {submitting ? "Assigning…" : `Assign ${selectedUnassigned.size > 0 ? selectedUnassigned.size : ""} task${selectedUnassigned.size !== 1 ? "s" : ""} ✓`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB: COMPARE ───────────────────────────────── */}
              {tab === "compare" && (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
                      Workload Comparison
                    </h2>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                      All staff ranked from highest to lowest task load. Bar = % of 15-task capacity.
                    </p>
                  </div>

                  <div style={{ ...card, padding: "24px 28px" }}>
                    {/* Header row */}
                    <div style={{ display: "flex", gap: 16, marginBottom: 16, paddingBottom: 12, borderBottom: "0.5px solid var(--border)" }}>
                      <div style={{ width: 32 }} />
                      <div style={{ width: 200, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Staff member</div>
                      <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Workload</div>
                      <div style={{ width: 100, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "right" }}>Status</div>
                    </div>

                    {staffList
                      .slice()
                      .sort((a, b) => b.activeTasks - a.activeTasks)
                      .map((member, i) => {
                        const lc = LOAD[member.loadLevel];
                        const barW = Math.min(100, (member.activeTasks / 15) * 100);
                        return (
                          <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, paddingBottom: 16, borderBottom: "0.5px solid var(--border-soft)" }}>
                            {/* Rank */}
                            <div style={{ width: 32, fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>
                              {i + 1}
                            </div>

                            {/* Name + dept - clickable */}
                            <div style={{ width: 200, flexShrink: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
                                onClick={() => router.push(`/staff-directory?userId=${member.id}`)}>
                                <UserAvatar user={{ photo: member.photo, name: member.name }} size={36} />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                                    textDecoration: "underline", textDecorationColor: "transparent",
                                    transition: "text-decoration-color 0.15s" }}
                                    onMouseEnter={e => e.currentTarget.style.textDecorationColor = "var(--text-primary)"}
                                    onMouseLeave={e => e.currentTarget.style.textDecorationColor = "transparent"}>
                                    {member.name}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    {member.department?.name?.split(" ")[0] || "-"} ↗
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Bar */}
                            <div style={{ flex: 1 }}>
                              <div style={{ position: "relative", height: 28, background: "var(--bg-input)", borderRadius: 7, overflow: "hidden" }}>
                                <div style={{
                                  height: "100%", width: `${barW}%`,
                                  background: lc.bar,
                                  borderRadius: 7,
                                  display: "flex", alignItems: "center",
                                  paddingLeft: barW > 20 ? 10 : 0,
                                  transition: "width 0.8s ease",
                                }}>
                                  {barW > 20 && (
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>
                                      {member.activeTasks} tasks
                                    </span>
                                  )}
                                </div>
                                {barW <= 20 && member.activeTasks > 0 && (
                                  <span style={{ position: "absolute", left: `${barW + 2}%`, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                                    {member.activeTasks}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                                <span>⏳ {member.pendingTasks} pending</span>
                                {member.overdueTasks > 0 && <span style={{ color: "#f87171" }}>⚠ {member.overdueTasks} overdue</span>}
                                <span style={{ color: "#4ade80" }}>✓ {member.completedThisMonth} done this month</span>
                              </div>
                            </div>

                            {/* Load badge */}
                            <div style={{ width: 100, textAlign: "right" }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 7,
                                background: `${lc.color}18`, color: lc.color,
                                border: `0.5px solid ${lc.color}44`,
                                display: "inline-block",
                              }}>
                                {lc.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                    {/* Legend */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                      {Object.entries(LOAD).map(([, cfg]) => (
                        <div key={cfg.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: cfg.bar }} />
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{cfg.label}</span>
                        </div>
                      ))}
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", fontStyle: "italic" }}>
                        Bar shows % of 15-task threshold
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

// ─── Types ────────────────────────────────────────────────────────────
type DailyLog = {
  id: string;
  date: string;
  taskTitle: string;
  taskCategory: string;
  description: string;
  timeSpent: number;
  priority: string;
  status: string;
  caseReference: string | null;
  amountInvolved: number | null;
  evidence: string | null;
  notes: string | null;
  supervisorComment: string | null;
  supervisorScore: number | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; role: string; department: { name: string } | null };
};

type StaffTask = {
  id: string;
  taskRef: string | null;
  title: string;
  priority: string;
  status: string;
  treatmentStatus: string | null;
  dueDate: string | null;
  createdAt: string;
  assignedTo:  { id: string; name: string } | null;
  createdBy:   { id: string; name: string } | null;
  department:  { name: string };
};

type StaffMember = {
  id: string;
  name: string;
  role: string;
  staffId: string | null;
  department: { name: string } | null;
};

type TeamStats = {
  totalLogs: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  avgScore: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
};

// ✅ Per-log decision shape
type LogDecision = {
  status: "APPROVED" | "REJECTED" | "QUERIED" | "";
  score: number;
  comment: string;
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  DRAFT:     { bg:"#1e293b", color:"#94a3b8", border:"#334155",  label:"Draft"     },
  SUBMITTED: { bg:"#0c1a2e", color:"#60a5fa", border:"#1e3a5f",  label:"Submitted" },
  APPROVED:  { bg:"#052e16", color:"#4ade80", border:"#14532d",  label:"Approved"  },
  REJECTED:  { bg:"#1f0707", color:"#f87171", border:"#7f1d1d",  label:"Rejected"  },
  QUERIED:   { bg:"#1c1107", color:"#f59e0b", border:"#78350f",  label:"Queried"   },
};

const TASK_STATUS: Record<string, { color: string; label: string }> = {
  PENDING:           { color:"#60a5fa", label:"Pending"          },
  IN_PROGRESS:       { color:"#a78bfa", label:"In Progress"      },
  UNDER_TREATMENT:   { color:"#f59e0b", label:"Under Treatment"  },
  AWAITING_RESPONSE: { color:"#fb923c", label:"Awaiting Response"},
  TREATED:           { color:"#86efac", label:"Treated"          },
  COMPLETED:         { color:"#4ade80", label:"Completed"        },
  ESCALATED:         { color:"#f87171", label:"Escalated"        },
  FORWARDED:         { color:"#38bdf8", label:"Forwarded"        },
  CANCELLED:         { color:"#6b7280", label:"Cancelled"        },
};

const SOURCE_BADGE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  EVC:        { color:"#fbbf24", bg:"#1c1107", border:"#92400e", label:"⚡ EVC"       },
  DEPARTMENT: { color:"#60a5fa", bg:"#0c1a2e", border:"#1e3a5f", label:"📋 Director"  },
  SELF:       { color:"#94a3b8", bg:"#1e293b", border:"#334155", label:"👤 Self"      },
  TRANSFERRED:{ color:"#38bdf8", bg:"#0c1a2e", border:"#0369a1", label:"🔀 Transferred"},
};

export default function SupervisorPage() {
  const router = useRouter();

  const [activeTab,    setActiveTab]    = useState<"overview"|"logs"|"tasks"|"team">("overview");
  const [logs,         setLogs]         = useState<DailyLog[]>([]);
  const [tasks,        setTasks]        = useState<StaffTask[]>([]);
  const [teamStaff,    setTeamStaff]    = useState<StaffMember[]>([]);
  const [stats,        setStats]        = useState<TeamStats>({ totalLogs:0,pendingReview:0,approved:0,rejected:0,avgScore:0,totalTasks:0,completedTasks:0,overdueTasks:0 });
  const [loading,      setLoading]      = useState(true);
  const [userRole,     setUserRole]     = useState("");
  const [userId,       setUserId]       = useState("");
  const [userName,     setUserName]     = useState("");

  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const [selectedLog,  setSelectedLog]  = useState<DailyLog | null>(null);
  const [reviewScore,  setReviewScore]  = useState(70);
  const [reviewComment,setReviewComment]= useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [toast,        setToast]        = useState<{msg:string;ok:boolean}|null>(null);

  // ✅ Bulk selection + per-log decisions
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [showDecisionPanel, setShowDecisionPanel] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, LogDecision>>({});
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // ✅ Phase C: AI suggest
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiReasons, setAiReasons] = useState<Record<string, string>>({});
  const [logFilter,    setLogFilter]    = useState<"ALL"|"SUBMITTED"|"APPROVED"|"REJECTED">("SUBMITTED");
  const [taskFilter,   setTaskFilter]   = useState("ALL");
  const [staffFilter,  setStaffFilter]  = useState("ALL");
  const [search,       setSearch]       = useState("");

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, tasksRes, meRes, usersRes] = await Promise.all([
        fetch("/api/staff-logs?limit=500"),
        fetch("/api/tasks?view=department"),
        fetch("/api/settings/account"),
        fetch("/api/users?limit=500&isActive=true"),
      ]);

      const logsData  = await logsRes.json();
      const tasksData = await tasksRes.json();
      const meData    = await meRes.json();
      const usersData = await usersRes.json();

      if (logsRes.ok)  setLogs(logsData.logs || []);
      if (tasksRes.ok) setTasks(tasksData.tasks || []);
      if (meData.user) { setUserRole(meData.user.role); setUserId(meData.user.id); setUserName(meData.user.name || ""); }
      if (usersRes.ok) setTeamStaff(usersData.users || []);

      const allLogs: DailyLog[] = logsData.logs || [];
      const allTasks: StaffTask[] = tasksData.tasks || [];
      const scores = allLogs.filter(l => l.supervisorScore !== null).map(l => l.supervisorScore as number);
      setStats({
        totalLogs:     allLogs.length,
        pendingReview: allLogs.filter(l => l.status === "SUBMITTED").length,
        approved:      allLogs.filter(l => l.status === "APPROVED").length,
        rejected:      allLogs.filter(l => l.status === "REJECTED").length,
        avgScore:      scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0,
        totalTasks:    allTasks.length,
        completedTasks:allTasks.filter(t => t.status === "COMPLETED").length,
        overdueTasks:  allTasks.filter(t =>
          t.dueDate && new Date(t.dueDate) < new Date() && !["COMPLETED","CANCELLED"].includes(t.status)
        ).length,
      });

      // Clear stale selections
      setSelectedLogIds(prev => {
        const next = new Set<string>();
        prev.forEach(id => {
          const log = allLogs.find(l => l.id === id);
          if (log && log.status === "SUBMITTED") next.add(id);
        });
        return next;
      });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleReview(action: "APPROVED"|"REJECTED"|"QUERIED") {
    if (!selectedLog) return;
    setSubmitting(true);
    try {
      const res  = await fetch("/api/staff-logs", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          logId:   selectedLog.id,
          status:  action,
          score:   action === "APPROVED" ? reviewScore : null,
          comment: reviewComment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedLog(null);
        setReviewComment("");
        setReviewScore(70);
        fetchAll();
        showToast(`Log ${action.toLowerCase()} successfully.`);
      } else {
        showToast(data.error || "Failed.", false);
      }
    } finally { setSubmitting(false); }
  }

  function toggleSelect(id: string) {
    setSelectedLogIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

    function clearSelection() {
    setSelectedLogIds(new Set());
    setDecisions({});
    setAiReasons({});
  }

  // ✅ Open the decision panel — pre-fill every selected log with default decision
  function openDecisionPanel() {
    const initial: Record<string, LogDecision> = {};
    selectedLogIds.forEach(id => {
      initial[id] = decisions[id] || { status: "", score: 70, comment: "" };
    });
    setDecisions(initial);
    setShowDecisionPanel(true);
  }

  function setDecisionFor(logId: string, patch: Partial<LogDecision>) {
    setDecisions(prev => ({
      ...prev,
      [logId]: { ...(prev[logId] || { status: "", score: 70, comment: "" }), ...patch },
    }));
  }

  // ✅ Quick apply to all rows
  function applyAll(status: "APPROVED"|"REJECTED"|"QUERIED") {
    setDecisions(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        next[id] = { ...next[id], status };
      });
      return next;
    });
  }

  function applyAllPendingRows(status: "APPROVED"|"REJECTED"|"QUERIED") {
    // Same as applyAll but for rows that don't have a decision yet
    setDecisions(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        if (!next[id].status) next[id] = { ...next[id], status };
      });
      return next;
    });
  }

  // ✅ Save all decisions
  async function saveAllDecisions() {
    const decided = Object.entries(decisions).filter(([_, d]) => d.status !== "");
    if (decided.length === 0) {
      showToast("No decisions to save. Set a decision on at least one log.", false);
      return;
    }

    setBulkSubmitting(true);
    try {
      const res = await fetch("/api/staff-logs/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisions: decided.map(([logId, d]) => ({
            logId,
            status: d.status,
            score: d.status === "APPROVED" ? d.score : null,
            comment: d.comment,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          `${data.reviewed} of ${data.total} decision${data.total !== 1 ? "s" : ""} saved.`
        );
        setShowDecisionPanel(false);
        clearSelection();
        fetchAll();
      } else {
        showToast(data.error || "Save failed.", false);
      }
    } finally { setBulkSubmitting(false); }
  }

  
  async function handleAISuggest() {
    const selectedIds = Object.keys(decisions);
    if (selectedIds.length === 0) {
      showToast("No logs selected.", false);
      return;
    }
    if (selectedIds.length > 20) {
      showToast("AI Suggest works best on 20 or fewer logs at a time. Please narrow your selection.", false);
      return;
    }

    setAiSuggesting(true);
    try {
      const res = await fetch("/api/staff-logs/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logIds: selectedIds }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "AI suggestion failed.", false);
        return;
      }

      const suggestions: { logId: string; decision: string; score: number | null; reason: string }[] =
        data.suggestions || [];

      if (suggestions.length === 0) {
        showToast("AI returned no suggestions.", false);
        return;
      }

      const newDecisions = { ...decisions };
      const newReasons: Record<string, string> = { ...aiReasons };

      suggestions.forEach(s => {
        const existing = newDecisions[s.logId] || { status: "", score: 70, comment: "" };
        newDecisions[s.logId] = {
          status: s.decision as "APPROVED" | "REJECTED" | "QUERIED",
          score: s.decision === "APPROVE" && s.score != null ? s.score : existing.score,
          comment: existing.comment,
        };
        newReasons[s.logId] = s.reason;
      });

      setDecisions(newDecisions);
      setAiReasons(newReasons);
      showToast(`AI suggested decisions for ${suggestions.length} log${suggestions.length !== 1 ? "s" : ""}. Review and adjust before saving.`);
    } catch {
      showToast("Network error contacting AI.", false);
    } finally {
      setAiSuggesting(false);
    }
  }

  const filteredLogs = logs.filter(l => {
    if (logFilter !== "ALL" && l.status !== logFilter) return false;
    if (staffFilter !== "ALL" && l.user.id !== staffFilter) return false;
    if (search && !l.taskTitle.toLowerCase().includes(search.toLowerCase()) &&
        !l.user.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectableLogs = filteredLogs.filter(l => l.status === "SUBMITTED");

  const filteredTasks = tasks.filter(t => {
    if (taskFilter !== "ALL") {
      const TREATMENT_ONLY = ["UNDER_TREATMENT","AWAITING_RESPONSE","TREATED","ESCALATED","FORWARDED"];
      if (TREATMENT_ONLY.includes(taskFilter)) { if (t.treatmentStatus !== taskFilter) return false; }
      else { if (t.status !== taskFilter) return false; }
    }
    if (staffFilter !== "ALL" && t.assignedTo?.id !== staffFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const today = new Date().toLocaleDateString("en-GB", { weekday:"long",year:"numeric",month:"long",day:"numeric" });

  const inp: React.CSSProperties = {
    background:"var(--bg-input)", border:"0.5px solid var(--border)",
    borderRadius:9, padding:"9px 13px", fontSize:14,
    color:"var(--text-primary)", outline:"none",
  };

  const tabBtn = (key: string, label: string, count?: number) => {
    const active = activeTab === key;
    return (
      <button key={key} onClick={() => setActiveTab(key as any)}
        style={{ padding:"10px 20px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer",
          border:`1.5px solid ${active?"#60a5fa":"var(--border)"}`,
          background: active?"#0c1a2e":"var(--bg-input)",
          color: active?"#60a5fa":"var(--text-muted)",
          display:"flex", alignItems:"center", gap:6 }}>
        {label}
        {count !== undefined && count > 0 && (
          <span style={{ fontSize:11, fontWeight:800, padding:"1px 7px", borderRadius:20,
            background: active?"#60a5fa22":"var(--bg-card)", color: active?"#60a5fa":"var(--text-muted)",
            border:`0.5px solid ${active?"#60a5fa44":"var(--border)"}` }}>
            {count}
          </span>
        )}
      </button>
    );
  };

  // ✅ Decision panel modal is rendered at the bottom of the JSX
  return (
    <div className="flex min-h-screen" style={{ background:"var(--bg-page)" }}>
      <Sidebar />

      {toast && (
        <div style={{ position:"fixed", top:20, right:20, zIndex:9999,
          background: toast.ok?"#052e16":"#1f0707",
          border:`1px solid ${toast.ok?"#14532d":"#7f1d1d"}`,
          color: toast.ok?"#4ade80":"#f87171",
          borderRadius:12, padding:"14px 20px", fontSize:14, fontWeight:600,
          boxShadow:"0 8px 32px rgba(0,0,0,0.4)", display:"flex", alignItems:"center", gap:10, minWidth:280 }}>
          <span style={{ fontSize:18 }}>{toast.ok?"✓":"✕"}</span>
          {toast.msg}
        </div>
      )}

      <main className="flex-1 p-6 min-w-0">

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <h1 style={{ fontSize:26, fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>
              Supervisor Panel
            </h1>
            <p style={{ fontSize:14, color:"var(--text-muted)", marginTop:4 }}>{today}</p>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <button onClick={() => fetchAll()}
              style={{ padding:"9px 18px", borderRadius:9, border:"0.5px solid var(--border)", background:"var(--bg-input)", color:"var(--text-muted)", fontSize:13, cursor:"pointer" }}>
              ⟳ Refresh
            </button>
            <button onClick={() => router.push("/tasks")}
              style={{ padding:"9px 18px", borderRadius:9, border:"1.5px solid #60a5fa", background:"#0c1a2e", color:"#60a5fa", fontSize:13, fontWeight:600, cursor:"pointer" }}>
              → Tasks
            </button>
            <button onClick={() => router.push("/task-load-balancer")}
              style={{ padding:"9px 18px", borderRadius:9, border:"1.5px solid #a78bfa", background:"#1a0a2e", color:"#a78bfa", fontSize:13, fontWeight:600, cursor:"pointer" }}>
              ⚖ Load Balancer
            </button>
            <ThemeToggleButton />
          </div>
        </div>

        <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
          {tabBtn("overview", "📊 Overview")}
          {tabBtn("logs",     "📝 Log Reviews", stats.pendingReview)}
          {tabBtn("tasks",    "📋 Department Tasks", stats.overdueTasks > 0 ? stats.overdueTasks : undefined)}
          {tabBtn("team",     "👥 My Team")}
        </div>

        {loading && activeTab !== "overview" ? (
          <div style={{ textAlign:"center", padding:60, color:"var(--text-muted)", fontSize:15 }}>
            <div style={{ fontSize:36, marginBottom:12 }}>⏳</div>Loading…
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
                  {[
                    { label:"Logs pending review", value:stats.pendingReview, color:"#f59e0b", bg:"#1c1107", border:"#78350f", action:() => setActiveTab("logs") },
                    { label:"Logs approved",       value:stats.approved,      color:"#4ade80", bg:"#052e16", border:"#14532d" },
                    { label:"Avg team score",      value:`${stats.avgScore}%`, color:"#a78bfa", bg:"#1a0a2e", border:"#4c1d95" },
                    { label:"Overdue tasks",       value:stats.overdueTasks,  color:"#f87171", bg:"#1f0707", border:"#7f1d1d", action:() => setActiveTab("tasks") },
                  ].map((s,i) => (
                    <div key={i} onClick={s.action}
                      className="card-bg"
                      style={{ borderRadius:14, padding:"20px 22px", textAlign:"center",
                        border:`1.5px solid ${s.border}`,
                        cursor: s.action ? "pointer" : "default",
                        background: s.bg }}>
                      <div style={{ fontSize:32, fontWeight:800, color:s.color, letterSpacing:"-0.03em" }}>{s.value}</div>
                      <div style={{ fontSize:13, color:"var(--text-muted)", marginTop:6, fontWeight:500 }}>{s.label}</div>
                      {s.action && <div style={{ fontSize:11, color:s.color, marginTop:4 }}>Click to review →</div>}
                    </div>
                  ))}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28 }}>
                  {[
                    { label:"Total team logs",  value:stats.totalLogs,     color:"var(--text-primary)" },
                    { label:"Logs rejected",    value:stats.rejected,       color:"#f87171" },
                    { label:"Total tasks",      value:stats.totalTasks,     color:"#60a5fa" },
                    { label:"Tasks completed",  value:stats.completedTasks, color:"#4ade80" },
                  ].map((s,i) => (
                    <div key={i} className="card-bg" style={{ borderRadius:12, padding:"14px 18px", textAlign:"center" }}>
                      <div style={{ fontSize:26, fontWeight:700, color:s.color }}>{s.value}</div>
                      <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {stats.pendingReview > 0 && (
                  <div style={{ background:"#1c1107", border:"0.5px solid #78350f", borderRadius:12, padding:"14px 20px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:"#f59e0b" }}>⏳ {stats.pendingReview} log{stats.pendingReview!==1?"s":""} waiting for your review</div>
                      <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>Staff daily work logs need approval or scoring</div>
                    </div>
                    <button onClick={() => setActiveTab("logs")}
                      style={{ padding:"8px 18px", borderRadius:9, border:"1.5px solid #f59e0b", background:"#1c1107", color:"#f59e0b", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                      Review now →
                    </button>
                  </div>
                )}
                {stats.overdueTasks > 0 && (
                  <div style={{ background:"#1f0707", border:"0.5px solid #7f1d1d", borderRadius:12, padding:"14px 20px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:"#f87171" }}>⚠ {stats.overdueTasks} overdue task{stats.overdueTasks!==1?"s":""} in your department</div>
                      <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>Tasks past their due date that are not completed</div>
                    </div>
                    <button onClick={() => setActiveTab("tasks")}
                      style={{ padding:"8px 18px", borderRadius:9, border:"1.5px solid #f87171", background:"#1f0707", color:"#f87171", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                      View tasks →
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "logs" && (
              <div style={{ display:"grid", gridTemplateColumns:selectedLog?"1fr 400px":"1fr", gap:16 }}>

                <div>
                  <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
                    <input style={{ ...inp, width:200 }} placeholder="🔍 Search staff or task…" value={search} onChange={e=>setSearch(e.target.value)} />
                    <select style={inp} value={logFilter} onChange={e=>setLogFilter(e.target.value as any)}>
                      <option value="ALL">All logs</option>
                      <option value="SUBMITTED">⏳ Pending review ({stats.pendingReview})</option>
                      <option value="APPROVED">✅ Approved</option>
                      <option value="REJECTED">✕ Rejected</option>
                    </select>
                    <select style={inp} value={staffFilter} onChange={e=>setStaffFilter(e.target.value)}>
                      <option value="ALL">All staff</option>
                      {teamStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    <div style={{ marginLeft: "auto", display: "flex", gap: 4, padding: 3, background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
                      <button
                        onClick={() => setViewMode("cards")}
                        title="Card view"
                        style={{
                          padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          border: viewMode === "cards" ? "1.5px solid #60a5fa" : "1.5px solid transparent",
                          background: viewMode === "cards" ? "#0c1a2e" : "transparent",
                          color: viewMode === "cards" ? "#60a5fa" : "var(--text-muted)",
                        }}
                      >
                        📋 Cards
                      </button>
                      <button
                        onClick={() => setViewMode("table")}
                        title="Table view"
                        style={{
                          padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          border: viewMode === "table" ? "1.5px solid #60a5fa" : "1.5px solid transparent",
                          background: viewMode === "table" ? "#0c1a2e" : "transparent",
                          color: viewMode === "table" ? "#60a5fa" : "var(--text-muted)",
                        }}
                      >
                        📊 Table
                      </button>
                    </div>
                  </div>

                  {/* ✅ Selection bar with single "Open Decision Panel" button */}
                  {selectedLogIds.size > 0 && (
                    <div style={{
                      background: "#0c1a2e",
                      border: "1.5px solid #60a5fa",
                      borderRadius: 12,
                      padding: "12px 18px",
                      marginBottom: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa" }}>
                        ✓ {selectedLogIds.size} log{selectedLogIds.size !== 1 ? "s" : ""} selected
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={openDecisionPanel}
                          style={{ padding: "8px 22px", borderRadius: 9, border: "1.5px solid #60a5fa", background: "#0c1a2e", color: "#60a5fa", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          🎯 Open Decision Panel
                        </button>
                        <button onClick={clearSelection}
                          style={{ padding: "8px 18px", borderRadius: 9, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {selectableLogs.length > 1 && logFilter === "SUBMITTED" && (
                    <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        onClick={() => {
                          const allSelected = selectableLogs.every(l => selectedLogIds.has(l.id));
                          if (allSelected) clearSelection();
                          else setSelectedLogIds(new Set(selectableLogs.map(l => l.id)));
                        }}
                        style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", cursor: "pointer" }}
                      >
                        {selectableLogs.every(l => selectedLogIds.has(l.id)) ? "Deselect all" : `Select all ${selectableLogs.length}`}
                      </button>
                    </div>
                  )}

                  {filteredLogs.length === 0 ? (
                    <div className="card-bg" style={{ borderRadius:14, padding:48, textAlign:"center" }}>
                      <div style={{ fontSize:40, marginBottom:12 }}>📝</div>
                      <div style={{ fontSize:16, fontWeight:500, color:"var(--text-primary)" }}>No logs found</div>
                      <div style={{ fontSize:13, color:"var(--text-muted)", marginTop:6 }}>Try changing the filter</div>
                    </div>
                  ) : viewMode === "cards" ? (
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {filteredLogs.map(log => {
                        const ss = STATUS_STYLE[log.status] || STATUS_STYLE.SUBMITTED;
                        const sel = selectedLog?.id === log.id;
                        const isSelected = selectedLogIds.has(log.id);
                        const isSelectable = log.status === "SUBMITTED";
                        const dec = decisions[log.id];
                        return (
                          <div key={log.id}
                            className="card-bg"
                            style={{ borderRadius:12, padding:"16px 20px", cursor:"pointer",
                              borderLeft:`3px solid ${sel?"var(--accent)":ss.color}`,
                              outline:`0.5px solid ${isSelected?"#60a5fa":sel?"var(--accent)":"var(--border)"}`,
                              background: isSelected ? "rgba(96,165,250,0.08)" : undefined }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                              <div style={{ display:"flex", gap:10, alignItems:"flex-start", flex:1 }}>
                                {isSelectable && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => { e.stopPropagation(); toggleSelect(log.id); }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ marginTop: 4, width: 18, height: 18, cursor: "pointer", accentColor: "#60a5fa" }}
                                  />
                                )}
                                <div
                                  onClick={() => { setSelectedLog(sel?null:log); setReviewComment(log.supervisorComment||""); setReviewScore(log.supervisorScore||70); }}
                                  style={{ flex: 1, cursor: "pointer" }}
                                >
                                  <div style={{ fontSize:15, fontWeight:600, color:"var(--text-primary)", marginBottom:3 }}>
                                    {log.taskTitle}
                                    {dec?.status && (
                                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                                        background: dec.status === "APPROVED" ? "#052e16" : dec.status === "REJECTED" ? "#1f0707" : "#1c1107",
                                        color: dec.status === "APPROVED" ? "#4ade80" : dec.status === "REJECTED" ? "#f87171" : "#f59e0b",
                                        border: `0.5px solid ${dec.status === "APPROVED" ? "#14532d" : dec.status === "REJECTED" ? "#7f1d1d" : "#78350f"}`,
                                      }}>
                                        → {dec.status === "APPROVED" ? "Approve" : dec.status === "REJECTED" ? "Reject" : "Query"}{dec.status === "APPROVED" ? ` (${dec.score})` : ""}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize:13, color:"var(--text-muted)" }}>
                                    <span style={{ color:"#60a5fa", cursor:"pointer", textDecoration:"underline" }}
                                      onClick={e=>{e.stopPropagation();router.push(`/staff-directory?userId=${log.user.id}`);}}>
                                      {log.user.name}
                                    </span>
                                    {" · "}{log.user.department?.name || "No dept"}
                                    {" · "}{log.taskCategory}
                                  </div>
                                </div>
                              </div>
                              <span style={{ fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:7,
                                background:ss.bg, color:ss.color, border:`0.5px solid ${ss.border}`, flexShrink:0, marginLeft:12 }}>
                                {ss.label}
                              </span>
                            </div>
                            <div
                              onClick={() => { setSelectedLog(sel?null:log); setReviewComment(log.supervisorComment||""); setReviewScore(log.supervisorScore||70); }}
                              style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.5, marginBottom:10, cursor: "pointer" }}
                            >
                              {log.description.length > 120 ? log.description.slice(0,118)+"…" : log.description}
                            </div>
                            <div style={{ display:"flex", gap:16, fontSize:12, color:"var(--text-hint)", flexWrap:"wrap" }}>
                              <span>📅 {new Date(log.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</span>
                              <span>⏱ {log.timeSpent}h</span>
                              {log.supervisorScore !== null && <span style={{ color:"#a78bfa" }}>Score: {log.supervisorScore}/100</span>}
                              {log.caseReference && <span>🔖 {log.caseReference}</span>}
                              {log.reviewedAt && <span style={{ color:"#4ade80" }}>Reviewed {new Date(log.reviewedAt).toLocaleDateString("en-GB")}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="card-bg" style={{ borderRadius: 12, overflow: "hidden" }}>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "36px 2fr 1.2fr 1fr 1.2fr 70px 90px 110px 80px 90px",
                        gap: 10,
                        padding: "12px 16px",
                        background: "var(--bg-input)",
                        borderBottom: "0.5px solid var(--border)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}>
                        <div></div>
                        <div>Title</div>
                        <div>Staff</div>
                        <div>Dept</div>
                        <div>Category</div>
                        <div>Time</div>
                        <div>Priority</div>
                        <div>Status</div>
                        <div>Score</div>
                        <div>Actions</div>
                      </div>

                      {filteredLogs.map((log, i) => {
                        const ss = STATUS_STYLE[log.status] || STATUS_STYLE.SUBMITTED;
                        const isSelected = selectedLogIds.has(log.id);
                        const isSelectable = log.status === "SUBMITTED";
                        const sel = selectedLog?.id === log.id;
                        const dec = decisions[log.id];
                        return (
                          <div
                            key={log.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "36px 2fr 1.2fr 1fr 1.2fr 70px 90px 110px 80px 90px",
                              gap: 10,
                              padding: "12px 16px",
                              alignItems: "center",
                              borderBottom: "0.5px solid var(--border-soft)",
                              background: isSelected
                                ? "rgba(96,165,250,0.08)"
                                : sel
                                ? "var(--accent-bg)"
                                : i % 2 === 0
                                ? "transparent"
                                : "var(--bg-input)",
                              fontSize: 13,
                            }}
                          >
                            <div>
                              {isSelectable && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => { e.stopPropagation(); toggleSelect(log.id); }}
                                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#60a5fa" }}
                                />
                              )}
                            </div>

                            <div
                              onClick={() => { setSelectedLog(sel?null:log); setReviewComment(log.supervisorComment||""); setReviewScore(log.supervisorScore||70); }}
                              style={{ cursor: "pointer", minWidth: 0 }}
                            >
                              <div style={{ fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {log.taskTitle}
                                {dec?.status && (
                                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5,
                                    background: dec.status === "APPROVED" ? "#052e16" : dec.status === "REJECTED" ? "#1f0707" : "#1c1107",
                                    color: dec.status === "APPROVED" ? "#4ade80" : dec.status === "REJECTED" ? "#f87171" : "#f59e0b",
                                  }}>
                                    {dec.status === "APPROVED" ? `✓ ${dec.score}` : dec.status === "REJECTED" ? "✕" : "?"}
                                  </span>
                                )}
                              </div>
                              {log.caseReference && (
                                <div style={{ fontSize: 11, color: "var(--text-hint)", marginTop: 2 }}>
                                  🔖 {log.caseReference}
                                </div>
                              )}
                            </div>

                            <div
                              onClick={(e) => { e.stopPropagation(); router.push(`/staff-directory?userId=${log.user.id}`); }}
                              style={{ cursor: "pointer", color: "#60a5fa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {log.user.name}
                            </div>

                            <div style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {log.user.department?.name || "-"}
                            </div>

                            <div style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {log.taskCategory}
                            </div>

                            <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                              {log.timeSpent}h
                            </div>

                            <div>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
                                background: log.priority === "CRITICAL" ? "#1f0707" : log.priority === "HIGH" ? "#1c1107" : log.priority === "MEDIUM" ? "#0c1a2e" : "#052e16",
                                color: log.priority === "CRITICAL" ? "#f87171" : log.priority === "HIGH" ? "#f59e0b" : log.priority === "MEDIUM" ? "#60a5fa" : "#4ade80",
                                border: `0.5px solid ${log.priority === "CRITICAL" ? "#7f1d1d" : log.priority === "HIGH" ? "#78350f" : log.priority === "MEDIUM" ? "#1e3a5f" : "#14532d"}`,
                              }}>
                                {log.priority}
                              </span>
                            </div>

                            <div>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
                                background: ss.bg, color: ss.color, border: `0.5px solid ${ss.border}`,
                              }}>
                                {ss.label}
                              </span>
                            </div>

                            <div style={{ color: log.supervisorScore !== null ? "#a78bfa" : "var(--text-hint)", fontWeight: 600 }}>
                              {log.supervisorScore !== null ? `${log.supervisorScore}` : "-"}
                            </div>

                            <div>
                              <button
                                onClick={() => { setSelectedLog(sel?null:log); setReviewComment(log.supervisorComment||""); setReviewScore(log.supervisorScore||70); }}
                                style={{
                                  padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                  border: isSelectable ? "1px solid #1e3a5f" : "0.5px solid var(--border)",
                                  background: isSelectable ? "#0c1a2e" : "var(--bg-input)",
                                  color: isSelectable ? "#60a5fa" : "var(--text-muted)",
                                }}
                              >
                                {isSelectable ? "Review" : "View"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedLog && (
                  <div className="card-bg" style={{ borderRadius:14, padding:22, position:"sticky", top:24, alignSelf:"start", maxHeight:"calc(100vh - 120px)", overflowY:"auto" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16, paddingBottom:12, borderBottom:"0.5px solid var(--border-soft)" }}>
                      <div style={{ fontSize:16, fontWeight:700, color:"var(--text-primary)" }}>Review Log</div>
                      <button onClick={() => setSelectedLog(null)} style={{ background:"none", border:"none", color:"var(--text-muted)", fontSize:20, cursor:"pointer" }}>✕</button>
                    </div>

                    <div style={{ fontSize:15, fontWeight:600, color:"var(--text-primary)", marginBottom:4 }}>{selectedLog.taskTitle}</div>
                    <div style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16 }}>
                      By {selectedLog.user.name} · {new Date(selectedLog.date).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}
                    </div>

                    <div style={{ background:"var(--bg-input)", borderRadius:10, padding:"12px 14px", marginBottom:16, lineHeight:1.7, fontSize:14, color:"var(--text-secondary)" }}>
                      {selectedLog.description}
                    </div>

                    {[
                      { label:"Category",     value:selectedLog.taskCategory },
                      { label:"Time spent",   value:`${selectedLog.timeSpent} hour${selectedLog.timeSpent!==1?"s":""}` },
                      { label:"Priority",     value:selectedLog.priority },
                      ...(selectedLog.caseReference ? [{ label:"Case ref", value:selectedLog.caseReference }] : []),
                      ...(selectedLog.amountInvolved ? [{ label:"Amount", value:`₦${selectedLog.amountInvolved.toLocaleString()}` }] : []),
                      ...(selectedLog.notes ? [{ label:"Notes", value:selectedLog.notes }] : []),
                    ].map(r => (
                      <div key={r.label} style={{ marginBottom:10 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>{r.label}</div>
                        <div style={{ fontSize:14, color:"var(--text-primary)" }}>{r.value}</div>
                      </div>
                    ))}

                    {selectedLog.evidence && (
                      <div style={{ marginBottom:14, padding:"10px 12px", background:"var(--bg-input)", borderRadius:8, border:"0.5px solid var(--border)" }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Evidence</div>
                        <div style={{ fontSize:13, color:"#60a5fa" }}>📎 Evidence attached</div>
                      </div>
                    )}

                    {selectedLog.status === "SUBMITTED" && (
                      <div style={{ marginTop:16, paddingTop:14, borderTop:"0.5px solid var(--border-soft)" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"var(--text-muted)", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Your review</div>

                        <div style={{ marginBottom:14 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                            <label style={{ fontSize:13, fontWeight:600, color:"var(--text-muted)" }}>Score: <span style={{ color:"#a78bfa", fontWeight:800 }}>{reviewScore}/100</span></label>
                          </div>
                          <input type="range" min={0} max={100} value={reviewScore}
                            onChange={e => setReviewScore(Number(e.target.value))}
                            style={{ width:"100%", accentColor:"#a78bfa", cursor:"pointer" }} />
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text-muted)", marginTop:4 }}>
                            <span>0 - Poor</span><span>50 - Average</span><span>100 - Excellent</span>
                          </div>
                        </div>

                        <textarea rows={3} value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                          placeholder="Add a comment or feedback…"
                          style={{ width:"100%", background:"var(--bg-input)", border:"0.5px solid var(--border)", borderRadius:9, padding:"10px 12px", fontSize:14, color:"var(--text-primary)", outline:"none", resize:"none", marginBottom:12, boxSizing:"border-box" }} />

                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={() => handleReview("APPROVED")} disabled={submitting}
                            style={{ flex:1, padding:"10px", borderRadius:9, border:"1.5px solid #4ade80", background:"#052e16", color:"#4ade80", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                            ✅ Approve
                          </button>
                          <button onClick={() => handleReview("QUERIED")} disabled={submitting}
                            style={{ flex:1, padding:"10px", borderRadius:9, border:"0.5px solid #78350f", background:"#1c1107", color:"#f59e0b", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                            ❓ Query
                          </button>
                          <button onClick={() => handleReview("REJECTED")} disabled={submitting}
                            style={{ flex:1, padding:"10px", borderRadius:9, border:"0.5px solid #7f1d1d", background:"#1f0707", color:"#f87171", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                            ✕ Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedLog.status !== "SUBMITTED" && selectedLog.supervisorComment && (
                      <div style={{ marginTop:14, padding:"12px 14px", background:"var(--accent-bg)", border:"0.5px solid var(--accent-border)", borderRadius:10 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--accent-text)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Your previous feedback</div>
                        <div style={{ fontSize:14, color:"var(--accent-text)", opacity:0.9, lineHeight:1.6 }}>{selectedLog.supervisorComment}</div>
                        {selectedLog.supervisorScore !== null && (
                          <div style={{ fontSize:13, color:"var(--accent-text)", marginTop:6, fontWeight:700 }}>Score: {selectedLog.supervisorScore}/100</div>
                        )}
                      </div>
                    )}

                    <button onClick={() => router.push(`/staff-directory?userId=${selectedLog.user.id}`)}
                      style={{ width:"100%", marginTop:12, padding:"9px", borderRadius:9, border:"0.5px solid var(--border)", background:"var(--bg-input)", color:"var(--text-muted)", fontSize:13, cursor:"pointer" }}>
                      👤 View {selectedLog.user.name}'s profile ↗
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "tasks" && (
              <div>
                <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                  <input style={{ ...inp, width:220 }} placeholder="🔍 Search tasks…" value={search} onChange={e=>setSearch(e.target.value)} />
                  <select style={inp} value={taskFilter} onChange={e=>setTaskFilter(e.target.value)}>
                    <option value="ALL">All statuses</option>
                    <option value="PENDING">⏳ Pending</option>
                    <option value="UNDER_TREATMENT">⚙️ Under Treatment</option>
                    <option value="ESCALATED">🔺 Escalated</option>
                    <option value="FORWARDED">➡️ Forwarded</option>
                    <option value="COMPLETED">✅ Completed</option>
                  </select>
                  <select style={inp} value={staffFilter} onChange={e=>setStaffFilter(e.target.value)}>
                    <option value="ALL">All staff</option>
                    {teamStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="card-bg" style={{ borderRadius:14, padding:48, textAlign:"center" }}>
                    <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                    <div style={{ fontSize:16, fontWeight:500, color:"var(--text-primary)" }}>No tasks found</div>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {filteredTasks.map(task => {
                      const displayStatus = task.treatmentStatus && task.treatmentStatus !== "PENDING" ? task.treatmentStatus : task.status;
                      const ts = TASK_STATUS[displayStatus] || TASK_STATUS.PENDING;
                      const sb = SOURCE_BADGE[(task as any).taskSource] || SOURCE_BADGE.DEPARTMENT;
                      const od = task.dueDate && new Date(task.dueDate) < new Date() && !["COMPLETED","CANCELLED"].includes(task.status);
                      return (
                        <div key={task.id} className="card-bg"
                          style={{ borderRadius:12, padding:"16px 20px",
                            borderLeft:`3px solid ${od?"#f87171":ts.color}`,
                            outline:"0.5px solid var(--border)", cursor:"pointer" }}
                          onClick={() => router.push(`/tasks?taskId=${task.id}`)}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:15, fontWeight:600, color:"var(--text-primary)", marginBottom:3 }}>{task.title}</div>
                              {task.taskRef && <div style={{ fontSize:11, fontFamily:"monospace", color:"#f59e0b" }}>#{task.taskRef}</div>}
                              <div style={{ fontSize:13, color:"var(--text-muted)", marginTop:4 }}>
                                {task.department.name}
                                {task.assignedTo && (
                                  <> · <span style={{ color:"#60a5fa", cursor:"pointer" }}
                                    onClick={e=>{e.stopPropagation();router.push(`/staff-directory?userId=${task.assignedTo!.id}`);}}>
                                    {task.assignedTo.name}
                                  </span></>
                                )}
                              </div>
                            </div>
                            <div style={{ display:"flex", gap:6, flexShrink:0, marginLeft:12, flexWrap:"wrap", justifyContent:"flex-end" }}>
                              <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:6,
                                background:sb.bg, color:sb.color, border:`0.5px solid ${sb.border}` }}>
                                {sb.label}
                              </span>
                              <span style={{ fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:7,
                                background:`${ts.color}18`, color:ts.color }}>
                                {ts.label}
                              </span>
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:16, fontSize:12, color:"var(--text-hint)" }}>
                            {task.dueDate && (
                              <span style={{ color:od?"#f87171":"var(--text-hint)", fontWeight:od?700:400 }}>
                                {od?"⚠ Overdue: ":"📅 "}{new Date(task.dueDate).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}
                              </span>
                            )}
                            <span style={{ color:"#a78bfa", marginLeft:"auto", cursor:"pointer" }}
                              onClick={e=>{e.stopPropagation();router.push(`/task-history?taskId=${task.id}`);}}>
                              📋 history
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "team" && (
              <div>
                <div style={{ marginBottom:16 }}>
                  <input style={{ ...inp, width:260 }} placeholder="🔍 Search team…" value={search} onChange={e=>setSearch(e.target.value)} />
                </div>
                {teamStaff.filter(s =>
                  !search || s.name.toLowerCase().includes(search.toLowerCase())
                ).length === 0 ? (
                  <div className="card-bg" style={{ borderRadius:14, padding:48, textAlign:"center" }}>
                    <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
                    <div style={{ fontSize:16, fontWeight:500 }}>No team members found</div>
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
                    {teamStaff
                      .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
                      .map(member => {
                        const memberLogs  = logs.filter(l => l.user.id === member.id);
                        const memberTasks = tasks.filter(t => t.assignedTo?.id === member.id);
                        const pendingLogs = memberLogs.filter(l => l.status === "SUBMITTED").length;
                        const activeTasks = memberTasks.filter(t => !["COMPLETED","CANCELLED"].includes(t.status)).length;
                        const avgScore    = memberLogs.filter(l=>l.supervisorScore!==null).length > 0
                          ? Math.round(memberLogs.filter(l=>l.supervisorScore!==null).reduce((a,l)=>a+(l.supervisorScore!),0) / memberLogs.filter(l=>l.supervisorScore!==null).length)
                          : null;
                        return (
                          <div key={member.id} className="card-bg"
                            style={{ borderRadius:14, padding:"18px 20px", cursor:"pointer" }}
                            onClick={() => router.push(`/staff-directory?userId=${member.id}`)}>
                            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                              <div style={{ width:44, height:44, borderRadius:"50%", background:"#0c1a2e", border:"2px solid #60a5fa",
                                display:"flex", alignItems:"center", justifyContent:"center",
                                fontSize:15, fontWeight:800, color:"#60a5fa", flexShrink:0 }}>
                                {member.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)" }}>{member.name}</div>
                                <div style={{ fontSize:12, color:"var(--text-muted)" }}>
                                  {member.role.charAt(0)+member.role.slice(1).toLowerCase()}
                                  {member.staffId && ` · ${member.staffId}`}
                                </div>
                              </div>
                              {pendingLogs > 0 && (
                                <span style={{ fontSize:11, fontWeight:800, padding:"3px 9px", borderRadius:20, background:"#1c1107", color:"#f59e0b", border:"0.5px solid #78350f" }}>
                                  {pendingLogs} pending
                                </span>
                              )}
                            </div>
                            <div style={{ display:"flex", gap:14, fontSize:13 }}>
                              <div style={{ textAlign:"center" }}>
                                <div style={{ fontSize:20, fontWeight:700, color:"#60a5fa" }}>{activeTasks}</div>
                                <div style={{ fontSize:11, color:"var(--text-muted)" }}>active tasks</div>
                              </div>
                              <div style={{ textAlign:"center" }}>
                                <div style={{ fontSize:20, fontWeight:700, color:"#f59e0b" }}>{memberLogs.length}</div>
                                <div style={{ fontSize:11, color:"var(--text-muted)" }}>total logs</div>
                              </div>
                              {avgScore !== null && (
                                <div style={{ textAlign:"center" }}>
                                  <div style={{ fontSize:20, fontWeight:700, color:"#a78bfa" }}>{avgScore}%</div>
                                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>avg score</div>
                                </div>
                              )}
                            </div>
                            <div style={{ marginTop:10, fontSize:12, color:"#60a5fa", textAlign:"right" }}>View full profile ↗</div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ✅ Decision Panel Modal */}
      {showDecisionPanel && (
        <div onClick={() => !bulkSubmitting && setShowDecisionPanel(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9998,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg-card)", border: "0.5px solid var(--border)",
              borderRadius: 14, padding: 24, maxWidth: 900, width: "100%",
              maxHeight: "92vh", overflowY: "auto" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "0.5px solid var(--border-soft)" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                  Batch Review: {Object.keys(decisions).length} log{Object.keys(decisions).length !== 1 ? "s" : ""}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Set a decision on each log, then click Save All. Logs without a decision will be skipped.
                </div>
              </div>
              <button onClick={() => setShowDecisionPanel(false)} disabled={bulkSubmitting}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer" }}>
                ✕
              </button>
            </div>

            {/* Quick apply bar */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, padding: "10px 14px", background: "var(--bg-input)", borderRadius: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                Quick apply to all:
              </span>
              <button onClick={() => applyAll("APPROVED")}
                style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #4ade80", background: "#052e16", color: "#4ade80", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ✅ All Approve
              </button>
              <button onClick={() => applyAll("QUERIED")}
                style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #f59e0b", background: "#1c1107", color: "#f59e0b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ❓ All Query
              </button>
              <button onClick={() => applyAll("REJECTED")}
                style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #f87171", background: "#1f0707", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ✕ All Reject
              </button>
              <button onClick={() => { setDecisions({}); }}
                style={{ padding: "6px 14px", borderRadius: 7, border: "0.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
                Clear all
              </button>
            </div>

            {/* Per-log rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {Object.keys(decisions).map(logId => {
                const log = logs.find(l => l.id === logId);
                if (!log) return null;
                const dec = decisions[logId];
                return (
                  <div key={logId} style={{
                    padding: 14, borderRadius: 10,
                    border: `0.5px solid ${dec.status === "APPROVED" ? "#4ade80" : dec.status === "REJECTED" ? "#f87171" : dec.status === "QUERIED" ? "#f59e0b" : "var(--border)"}`,
                    background: dec.status === "APPROVED" ? "rgba(74,222,128,0.05)" : dec.status === "REJECTED" ? "rgba(248,113,113,0.05)" : dec.status === "QUERIED" ? "rgba(245,158,11,0.05)" : "var(--bg-input)",
                  }}>
                    {/* Log info row */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                        {log.taskTitle}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                        {log.user.name} · {log.user.department?.name || "No dept"} · {log.taskCategory} · {log.timeSpent}h
                      </div>
                      {aiReasons[logId] && (
                        <div style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: "#a78bfa",
                          background: "#1a0a2e",
                          border: "0.5px solid #4c1d95",
                          borderRadius: 6,
                          padding: "5px 10px",
                          lineHeight: 1.4,
                        }}>
                          ✨ <strong>AI:</strong> {aiReasons[logId]}
                        </div>
                      )}
                    </div>

                    {/* Decision controls */}
                    <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: 10, alignItems: "center" }}>
                      {/* Decision buttons */}
                      <div style={{ display: "flex", gap: 4 }}>
                        {(["APPROVED", "QUERIED", "REJECTED"] as const).map(s => {
                          const active = dec.status === s;
                          const colors = s === "APPROVED" ? { bg: "#052e16", border: "#4ade80", color: "#4ade80", label: "✅" }
                            : s === "QUERIED" ? { bg: "#1c1107", border: "#f59e0b", color: "#f59e0b", label: "❓" }
                            : { bg: "#1f0707", border: "#f87171", color: "#f87171", label: "✕" };
                          return (
                            <button key={s}
                              onClick={() => setDecisionFor(logId, { status: s })}
                              style={{
                                padding: "6px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
                                background: active ? colors.bg : "transparent",
                                border: `1.5px solid ${active ? colors.border : "var(--border)"}`,
                                color: active ? colors.color : "var(--text-muted)",
                                opacity: active ? 1 : 0.6,
                              }}
                              title={s === "APPROVED" ? "Approve" : s === "QUERIED" ? "Query" : "Reject"}
                            >
                              {colors.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Score — only shown when approved */}
                      {dec.status === "APPROVED" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Score:</span>
                          <input
                            type="number" min={0} max={100}
                            value={dec.score}
                            onChange={(e) => setDecisionFor(logId, { score: Math.max(0, Math.min(100, Number(e.target.value))) })}
                            style={{ width: 60, background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 6, padding: "5px 8px", fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                          />
                        </div>
                      )}

                      {/* Comment input */}
                      <input
                        type="text"
                        value={dec.comment}
                        onChange={(e) => setDecisionFor(logId, { comment: e.target.value })}
                        placeholder="Comment (optional)"
                        style={{
                          background: "var(--bg-input)", border: "0.5px solid var(--border)",
                          borderRadius: 6, padding: "6px 10px", fontSize: 13,
                          color: "var(--text-primary)", outline: "none", width: "100%",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
                        <div style={{ display: "flex", gap: 10, paddingTop: 14, borderTop: "0.5px solid var(--border-soft)", alignItems: "center" }}>
              <button
                onClick={handleAISuggest}
                disabled={aiSuggesting || bulkSubmitting}
                style={{
                  padding: "10px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: aiSuggesting ? "wait" : "pointer",
                  border: "1.5px solid #a78bfa", background: "#1a0a2e", color: "#a78bfa",
                  opacity: aiSuggesting ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {aiSuggesting ? "✨ Thinking…" : "✨ AI Suggest"}
              </button>
              <div style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>
                {(() => {
                  const approved = Object.values(decisions).filter(d => d.status === "APPROVED").length;
                  const queried = Object.values(decisions).filter(d => d.status === "QUERIED").length;
                  const rejected = Object.values(decisions).filter(d => d.status === "REJECTED").length;
                  const undecided = Object.values(decisions).filter(d => !d.status).length;
                  return (
                    <>
                      {approved > 0 && <span style={{ color: "#4ade80", fontWeight: 700, marginRight: 10 }}>✓ {approved} approve</span>}
                      {queried > 0 && <span style={{ color: "#f59e0b", fontWeight: 700, marginRight: 10 }}>? {queried} query</span>}
                      {rejected > 0 && <span style={{ color: "#f87171", fontWeight: 700, marginRight: 10 }}>✕ {rejected} reject</span>}
                      {undecided > 0 && <span style={{ color: "var(--text-hint)" }}>{undecided} undecided</span>}
                    </>
                  );
                })()}
              </div>
              <button onClick={() => setShowDecisionPanel(false)} disabled={bulkSubmitting}
                style={{ padding: "10px 20px", borderRadius: 9, border: "0.5px solid var(--border)",
                  background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={saveAllDecisions} disabled={bulkSubmitting}
                style={{
                  padding: "10px 28px", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: "pointer",
                  border: "1.5px solid #60a5fa", background: "#0c1a2e", color: "#60a5fa",
                  opacity: bulkSubmitting ? 0.6 : 1,
                }}>
                {bulkSubmitting ? "Saving…" : "Save All Decisions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
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

  // Tabs: overview | logs | tasks | team
  const [activeTab,    setActiveTab]    = useState<"overview"|"logs"|"tasks"|"team">("overview");
  const [logs,         setLogs]         = useState<DailyLog[]>([]);
  const [tasks,        setTasks]        = useState<StaffTask[]>([]);
  const [teamStaff,    setTeamStaff]    = useState<StaffMember[]>([]);
  const [stats,        setStats]        = useState<TeamStats>({ totalLogs:0,pendingReview:0,approved:0,rejected:0,avgScore:0,totalTasks:0,completedTasks:0,overdueTasks:0 });
  const [loading,      setLoading]      = useState(true);
  const [userRole,     setUserRole]     = useState("");
  const [userId,       setUserId]       = useState("");
  const [userName,     setUserName]     = useState("");

  // Log review state
  const [selectedLog,  setSelectedLog]  = useState<DailyLog | null>(null);
  const [reviewScore,  setReviewScore]  = useState(70);
  const [reviewComment,setReviewComment]= useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [toast,        setToast]        = useState<{msg:string;ok:boolean}|null>(null);

  // Filters
  const [logFilter,    setLogFilter]    = useState<"ALL"|"SUBMITTED"|"APPROVED"|"REJECTED">("SUBMITTED");
  const [taskFilter,   setTaskFilter]   = useState("ALL");
  const [staffFilter,  setStaffFilter]  = useState("ALL");
  const [search,       setSearch]       = useState("");

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Fetch data ────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, tasksRes, meRes, usersRes] = await Promise.all([
        fetch("/api/staff-logs"),
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

      // Compute stats
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
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Review log ────────────────────────────────────────────────────
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

  // ── Filtered data ─────────────────────────────────────────────────
  const filteredLogs = logs.filter(l => {
    if (logFilter !== "ALL" && l.status !== logFilter) return false;
    if (staffFilter !== "ALL" && l.user.id !== staffFilter) return false;
    if (search && !l.taskTitle.toLowerCase().includes(search.toLowerCase()) &&
        !l.user.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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

  return (
    <div className="flex min-h-screen" style={{ background:"var(--bg-page)" }}>
      <Sidebar />

      {/* Toast */}
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

        {/* Header */}
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

        {/* TABS */}
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
            {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div>
                {/* Stats grid */}
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

                {/* Quick alerts */}
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

            {/* ── LOG REVIEWS TAB (merged from Staff Logs) ─────────── */}
            {activeTab === "logs" && (
              <div style={{ display:"grid", gridTemplateColumns:selectedLog?"1fr 400px":"1fr", gap:16 }}>

                {/* Log list */}
                <div>
                  {/* Filters */}
                  <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
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
                  </div>

                  {filteredLogs.length === 0 ? (
                    <div className="card-bg" style={{ borderRadius:14, padding:48, textAlign:"center" }}>
                      <div style={{ fontSize:40, marginBottom:12 }}>📝</div>
                      <div style={{ fontSize:16, fontWeight:500, color:"var(--text-primary)" }}>No logs found</div>
                      <div style={{ fontSize:13, color:"var(--text-muted)", marginTop:6 }}>Try changing the filter</div>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {filteredLogs.map(log => {
                        const ss = STATUS_STYLE[log.status] || STATUS_STYLE.SUBMITTED;
                        const sel = selectedLog?.id === log.id;
                        return (
                          <div key={log.id} onClick={() => { setSelectedLog(sel?null:log); setReviewComment(log.supervisorComment||""); setReviewScore(log.supervisorScore||70); }}
                            className="card-bg"
                            style={{ borderRadius:12, padding:"16px 20px", cursor:"pointer",
                              borderLeft:`3px solid ${sel?"var(--accent)":ss.color}`,
                              outline:`0.5px solid ${sel?"var(--accent)":"var(--border)"}` }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:15, fontWeight:600, color:"var(--text-primary)", marginBottom:3 }}>{log.taskTitle}</div>
                                <div style={{ fontSize:13, color:"var(--text-muted)" }}>
                                  <span style={{ color:"#60a5fa", cursor:"pointer", textDecoration:"underline" }}
                                    onClick={e=>{e.stopPropagation();router.push(`/staff-directory?userId=${log.user.id}`);}}>
                                    {log.user.name}
                                  </span>
                                  {" · "}{log.user.department?.name || "No dept"}
                                  {" · "}{log.taskCategory}
                                </div>
                              </div>
                              <span style={{ fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:7,
                                background:ss.bg, color:ss.color, border:`0.5px solid ${ss.border}`, flexShrink:0, marginLeft:12 }}>
                                {ss.label}
                              </span>
                            </div>
                            <div style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.5, marginBottom:10 }}>
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
                  )}
                </div>

                {/* Review panel */}
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
                            <span>0 — Poor</span><span>50 — Average</span><span>100 — Excellent</span>
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

            {/* ── DEPARTMENT TASKS TAB ─────────────────────────────── */}
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
                              {/* EVC / source badge */}
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

            {/* ── MY TEAM TAB ──────────────────────────────────────── */}
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
    </div>
  );
}

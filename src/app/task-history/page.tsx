"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import UserAvatar from "@/components/UserAvatar";

type HistoryTask = {
  id: string;
  taskRef: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  treatmentStatus: string | null;
  dueDate: string | null;
  completedAt: string | null;
  escalatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  forwardNote: string | null;
  escalationReason: string | null;
  directorComment: string | null;
  notes: string | null;
  office: string | null;
  caseReference: string | null;
  isPaymentRequest: boolean;
  department: { name: string };
  assignedTo:   { id: string; name: string; role: string } | null;
  createdBy:    { id: string; name: string; role: string };
  forwardedTo:  { id: string; name: string } | null;
  forwardedFrom:{ id: string; name: string } | null;
};

type StaffOption = { id: string; name: string; role: string; department: { name: string } | null };

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
  PENDING:           { color:"#60a5fa", bg:"#0c1a2e", border:"#1e3a5f", label:"Pending",           icon:"⏳" },
  ACKNOWLEDGED:      { color:"#a78bfa", bg:"#1a0a2e", border:"#4c1d95", label:"Acknowledged",      icon:"👁" },
  UNDER_TREATMENT:   { color:"#f59e0b", bg:"#1c1107", border:"#78350f", label:"Under Treatment",   icon:"⚙️" },
  AWAITING_RESPONSE: { color:"#fb923c", bg:"#1c1107", border:"#9a3412", label:"Awaiting Response", icon:"💬" },
  TREATED:           { color:"#86efac", bg:"#052e16", border:"#166534", label:"Treated",           icon:"✔️" },
  COMPLETED:         { color:"#4ade80", bg:"#052e16", border:"#14532d", label:"Completed",         icon:"✅" },
  ESCALATED:         { color:"#f87171", bg:"#1f0707", border:"#7f1d1d", label:"Escalated",         icon:"🔺" },
  FORWARDED:         { color:"#38bdf8", bg:"#0c1a2e", border:"#0369a1", label:"Forwarded",         icon:"➡️" },
  CANCELLED:         { color:"#6b7280", bg:"#1a1d28", border:"#374151", label:"Cancelled",         icon:"🚫" },
  IN_PROGRESS:       { color:"#818cf8", bg:"#1e1b4b", border:"#3730a3", label:"In Progress",       icon:"🔄" },
};

const PRIORITY_COLOR: Record<string,string> = { LOW:"#4ade80",MEDIUM:"#60a5fa",HIGH:"#f59e0b",CRITICAL:"#f87171" };

// Build a synthetic activity timeline from task fields
function buildTimeline(task: HistoryTask) {
  const events: { time: string; icon: string; color: string; title: string; detail: string }[] = [];

  // Created
  events.push({ time:task.createdAt, icon:"📋", color:"#60a5fa",
    title:"Task created",
    detail:`Created by ${task.createdBy.name}${task.assignedTo ? ` and assigned to ${task.assignedTo.name}` : " (unassigned)"}` });

  // Forwarded
  if (task.forwardedFrom) {
    events.push({ time:task.updatedAt, icon:"➡️", color:"#38bdf8",
      title:"Task forwarded",
      detail:`Forwarded by ${task.forwardedFrom.name}${task.forwardedTo ? ` to ${task.forwardedTo.name}` : ""}${task.forwardNote ? ` — Note: "${task.forwardNote}"` : ""}` });
  }

  // Escalated
  if (task.escalationReason) {
    events.push({ time:task.escalatedAt||task.updatedAt, icon:"🔺", color:"#f87171",
      title:"Task escalated",
      detail:`Reason: "${task.escalationReason}"` });
  }

  // Treatment statuses
  if (task.treatmentStatus && task.treatmentStatus !== "PENDING") {
    const sc = STATUS_CONFIG[task.treatmentStatus];
    events.push({ time:task.updatedAt, icon:sc?.icon||"⚙️", color:sc?.color||"#f59e0b",
      title:`Marked as ${sc?.label||task.treatmentStatus}`,
      detail:`Treatment status updated${task.assignedTo ? ` (assigned to ${task.assignedTo.name})` : ""}` });
  }

  // Director comment
  if (task.directorComment) {
    events.push({ time:task.updatedAt, icon:"💬", color:"#a78bfa",
      title:"Comment added",
      detail:`"${task.directorComment.slice(0,120)}${task.directorComment.length>120?"…":""}"` });
  }

  // Completed
  if (task.completedAt) {
    events.push({ time:task.completedAt, icon:"✅", color:"#4ade80",
      title:"Task completed",
      detail:`Completed${task.assignedTo ? ` by ${task.assignedTo.name}` : ""}` });
  }

  // Notes (capture rebalance/transfer notes)
  if (task.notes) {
    const noteLines = task.notes.split("\n\n").filter(n => n.startsWith("["));
    noteLines.forEach(note => {
      const match = note.match(/^\[([^\]]+)\]/);
      const prefix = match?.[1] || "Note";
      const isTransfer  = prefix.toLowerCase().includes("transfer");
      const isRebalance = prefix.toLowerCase().includes("rebalance");
      const isReassign  = prefix.toLowerCase().includes("reassign");
      events.push({ time:task.updatedAt, icon:isTransfer?"🔀":isRebalance?"⚖️":isReassign?"👤":"📝",
        color:isTransfer?"#f59e0b":isRebalance?"#60a5fa":isReassign?"#a78bfa":"#94a3b8",
        title:isTransfer?"Task transferred":isRebalance?"Task rebalanced":isReassign?"Task reassigned":"Note added",
        detail:note.replace(/^\[[^\]]+\]\s*/,"").slice(0,160) });
    });
  }

  // Sort by time
  return events.sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

function TaskHistoryContent() {
  const router      = useRouter();
  const searchParams= useSearchParams();

  const [tasks,      setTasks]      = useState<HistoryTask[]>([]);
  const [staff,      setStaff]      = useState<StaffOption[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [userRole,   setUserRole]   = useState("");
  const [userId,     setUserId]     = useState("");
  const [userDeptId, setUserDeptId] = useState<string|null>(null);

  // Filters
  const [viewMode,   setViewMode]   = useState<"mine"|"staff"|"dept">("mine");
  const [staffFilter,setStaffFilter]= useState(searchParams.get("userId")||"");
  const [taskFilter, setTaskFilter] = useState(searchParams.get("taskId")||"");
  const [statusFilter,setStatusFilter] = useState("ALL");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [search,     setSearch]     = useState("");

  const [selectedTask, setSelectedTask] = useState<HistoryTask|null>(null);

  const isPrivileged = ["DIRECTOR","SUPERVISOR","HR","ADMIN","EXECUTIVE"].includes(userRole);
  const isAdminOrEVC = ["ADMIN","EXECUTIVE"].includes(userRole);

  useEffect(() => {
    fetch("/api/settings/account").then(r=>r.json()).then(d=>{
      if (d.user) { setUserRole(d.user.role); setUserId(d.user.id); setUserDeptId(d.user.departmentId||null); }
    });
  },[]);

  useEffect(() => {
    if (!userRole) return;
    fetch("/api/users?limit=500&isActive=true").then(r=>r.json()).then(d=>{ if(d.users) setStaff(d.users); });
  },[userRole]);

  const fetchHistory = useCallback(async () => {
    if (!userRole) return;
    setLoading(true);
    try {
      let url = "/api/tasks?";
      if (viewMode==="mine")  url += `view=assigned`;
      else if (viewMode==="dept") url += `view=department`;
      else if (viewMode==="staff" && staffFilter) url += `view=all&userId=${staffFilter}`;
      else url += `view=all`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      // Include all statuses in history — no status filter in URL, filter client-side
      const res  = await fetch(url);
      const data = await res.json();
      if (res.ok) setTasks(data.tasks||[]);
    } finally { setLoading(false); }
  },[userRole,viewMode,staffFilter,search]);

  useEffect(() => { fetchHistory(); },[fetchHistory]);

  // If taskId in URL, highlight that task
  useEffect(() => {
    const tid = searchParams.get("taskId");
    if (tid && tasks.length > 0) {
      const found = tasks.find(t=>t.id===tid);
      if (found) setSelectedTask(found);
    }
  },[searchParams,tasks]);

  // Client-side filter
  const filtered = tasks.filter(t => {
    if (statusFilter!=="ALL") {
      const TREATMENT_ONLY = ["UNDER_TREATMENT","AWAITING_RESPONSE","TREATED","ESCALATED","FORWARDED","ACKNOWLEDGED"];
      if (TREATMENT_ONLY.includes(statusFilter)) { if (t.treatmentStatus!==statusFilter) return false; }
      else { if (t.status!==statusFilter) return false; }
    }
    if (dateFrom && new Date(t.createdAt) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(t.createdAt) > new Date(dateTo+"T23:59:59")) return false;
    return true;
  });

  // Summary stats
  const stats = {
    total:     filtered.length,
    completed: filtered.filter(t=>t.status==="COMPLETED").length,
    escalated: filtered.filter(t=>t.treatmentStatus==="ESCALATED"||t.escalationReason).length,
    forwarded: filtered.filter(t=>t.treatmentStatus==="FORWARDED"||t.forwardedFrom||t.forwardedTo).length,
    pending:   filtered.filter(t=>t.status==="PENDING").length,
    overdue:   filtered.filter(t=>t.dueDate&&new Date(t.dueDate)<new Date()&&!["COMPLETED","CANCELLED"].includes(t.status)).length,
  };

  const today = new Date().toLocaleDateString("en-GB",{weekday:"long",year:"numeric",month:"long",day:"numeric"});

  const inp: React.CSSProperties = { background:"var(--bg-input)", border:"0.5px solid var(--border)", borderRadius:9, padding:"9px 13px", fontSize:14, color:"var(--text-primary)", outline:"none" };

  return (
    <div className="flex min-h-screen" style={{ background:"var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0" style={{ display:"flex", flexDirection:"column", maxHeight:"100vh", overflow:"hidden" }}>

        {/* HEADER */}
        <div style={{ background:"var(--bg-card)", borderBottom:"0.5px solid var(--border)", padding:"16px 28px", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={() => router.back()}
                style={{ padding:"8px 16px", borderRadius:9, border:"1.5px solid #f87171", background:"#1f0707", color:"#f87171", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                ← Back
              </button>
              <div>
                <h1 style={{ fontSize:20, fontWeight:700, color:"var(--text-primary)", margin:0 }}>📋 Task History & Activity</h1>
                <p style={{ fontSize:12, color:"var(--text-muted)", margin:0, marginTop:2 }}>{today}</p>
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => router.push("/tasks")}
                style={{ padding:"9px 18px", borderRadius:9, border:"1.5px solid #60a5fa", background:"#0c1a2e", color:"#60a5fa", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                → Go to Tasks
              </button>
              <ThemeToggleButton />
            </div>
          </div>

          {/* View mode tabs */}
          <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
            {[
              { key:"mine",  label:"My History",       show:true },
              { key:"staff", label:"Specific Staff",   show:isPrivileged },
              { key:"dept",  label:"Department",       show:isPrivileged },
            ].filter(v=>v.show).map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key as any)}
                style={{ padding:"8px 18px", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer",
                  border:`1.5px solid ${viewMode===v.key?"#a78bfa":"var(--border)"}`,
                  background:viewMode===v.key?"#1a0a2e":"var(--bg-input)",
                  color:viewMode===v.key?"#a78bfa":"var(--text-muted)" }}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Filters row */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <input style={{...inp,width:220}} placeholder="🔍 Search tasks…" value={search} onChange={e=>setSearch(e.target.value)} />

            {viewMode==="staff" && isPrivileged && (
              <select style={inp} value={staffFilter} onChange={e=>setStaffFilter(e.target.value)}>
                <option value="">Select staff member…</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.role}{s.department?` (${s.department.name})`:""}</option>
                ))}
              </select>
            )}

            <select style={inp} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="PENDING">⏳ Pending</option>
              <option value="UNDER_TREATMENT">⚙️ Under Treatment</option>
              <option value="TREATED">✔️ Treated</option>
              <option value="ESCALATED">🔺 Escalated</option>
              <option value="FORWARDED">➡️ Forwarded</option>
              <option value="COMPLETED">✅ Completed</option>
              <option value="CANCELLED">🚫 Cancelled</option>
            </select>

            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:12, color:"var(--text-muted)" }}>From</span>
              <input type="date" style={inp} value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
              <span style={{ fontSize:12, color:"var(--text-muted)" }}>To</span>
              <input type="date" style={inp} value={dateTo} onChange={e=>setDateTo(e.target.value)} />
            </div>

            {(dateFrom||dateTo||statusFilter!=="ALL"||search) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); setStatusFilter("ALL"); setSearch(""); }}
                style={{ padding:"9px 14px", borderRadius:9, border:"0.5px solid var(--border)", background:"var(--bg-input)", color:"var(--text-muted)", fontSize:13, cursor:"pointer" }}>
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* STATS STRIP */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10, padding:"14px 28px", borderBottom:"0.5px solid var(--border)", background:"var(--bg-card)", flexShrink:0 }}>
          {[
            { label:"Total",     value:stats.total,     color:"var(--text-primary)" },
            { label:"Completed", value:stats.completed,  color:"#4ade80" },
            { label:"Pending",   value:stats.pending,    color:"#60a5fa" },
            { label:"Escalated", value:stats.escalated,  color:"#f87171" },
            { label:"Forwarded", value:stats.forwarded,  color:"#38bdf8" },
            { label:"Overdue",   value:stats.overdue,    color:"#fb923c" },
          ].map(s => (
            <div key={s.label} className="card-bg" style={{ borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex:1, overflow:"hidden", display:"grid", gridTemplateColumns:selectedTask?"1fr 440px":"1fr" }}>

          {/* Task list */}
          <div style={{ overflowY:"auto", padding:"16px 28px" }}>
            {loading ? (
              <div style={{ textAlign:"center", padding:60, color:"var(--text-muted)", fontSize:15 }}>
                <div style={{ fontSize:36, marginBottom:12 }}>⏳</div>Loading history…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:60, color:"var(--text-muted)" }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📭</div>
                <div style={{ fontSize:16, fontWeight:500 }}>No history found</div>
                <div style={{ fontSize:13, marginTop:6 }}>Try adjusting your filters</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {filtered.map(task => {
                  const displayStatus = task.treatmentStatus&&task.treatmentStatus!=="PENDING" ? task.treatmentStatus : task.status;
                  const sc  = STATUS_CONFIG[displayStatus]||STATUS_CONFIG.PENDING;
                  const pc  = PRIORITY_COLOR[task.priority]||"#60a5fa";
                  const sel = selectedTask?.id===task.id;
                  const od  = task.dueDate&&!["COMPLETED","CANCELLED"].includes(task.status)&&new Date(task.dueDate)<new Date();
                  const hasActivity = !!(task.escalationReason||task.forwardedFrom||task.forwardedTo||task.directorComment);

                  return (
                    <div key={task.id} onClick={() => setSelectedTask(sel?null:task)}
                      className="card-bg"
                      style={{ borderRadius:12, padding:"16px 20px", cursor:"pointer",
                        borderLeft:`3px solid ${sel?"var(--accent)":sc.color}`,
                        outline:`0.5px solid ${sel?"var(--accent)":"var(--border)"}`,
                        transition:"outline 0.15s" }}>

                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:15, fontWeight:600, color:"var(--text-primary)", marginBottom:3 }}>{task.title}</div>
                          {task.taskRef && <div style={{ fontSize:11, fontFamily:"monospace", color:"#f59e0b" }}>#{task.taskRef}</div>}
                        </div>
                        <div style={{ display:"flex", gap:6, flexShrink:0, marginLeft:12 }}>
                          <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:6, color:pc, background:`${pc}22` }}>{task.priority}</span>
                          <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:6, background:sc.bg, color:sc.color, border:`0.5px solid ${sc.border}` }}>{sc.icon} {sc.label}</span>
                        </div>
                      </div>

                      <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:8 }}>
                        {task.department.name}
                        {task.assignedTo && (
                          <> · <span style={{ color:"#60a5fa", cursor:"pointer" }}
                            onClick={e=>{ e.stopPropagation(); router.push(`/staff-directory?userId=${task.assignedTo!.id}`); }}>
                            {task.assignedTo.name}
                          </span></>
                        )}
                        {" · By "}
                        <span style={{ color:"#a78bfa", cursor:"pointer" }}
                          onClick={e=>{ e.stopPropagation(); router.push(`/staff-directory?userId=${task.createdBy.id}`); }}>
                          {task.createdBy.name}
                        </span>
                      </div>

                      {/* Activity badges */}
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                        <span style={{ fontSize:11, color:"var(--text-muted)" }}>
                          📅 {new Date(task.createdAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
                        </span>
                        {task.completedAt && <span style={{ fontSize:11, color:"#4ade80" }}>✅ Done {new Date(task.completedAt).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>}
                        {task.escalationReason && <span style={{ fontSize:11, color:"#f87171", fontWeight:600 }}>🔺 Escalated</span>}
                        {(task.forwardedFrom||task.forwardedTo) && <span style={{ fontSize:11, color:"#38bdf8", fontWeight:600 }}>➡️ Forwarded</span>}
                        {task.directorComment && <span style={{ fontSize:11, color:"#a78bfa" }}>💬 Commented</span>}
                        {od && <span style={{ fontSize:11, color:"#f87171", fontWeight:700 }}>⚠ Overdue</span>}
                        {task.caseReference && <span style={{ fontSize:11, color:"var(--text-muted)" }}>🔖 {task.caseReference}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DETAIL / TIMELINE PANEL */}
          {selectedTask && (
            <div style={{ borderLeft:"0.5px solid var(--border)", overflowY:"auto", background:"var(--bg-card)" }}>
              {/* Panel header */}
              <div style={{ position:"sticky", top:0, background:"var(--bg-card)", borderBottom:"0.5px solid var(--border)", padding:"14px 18px", zIndex:2 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>Task Timeline</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => router.push(`/tasks?taskId=${selectedTask.id}`)}
                      style={{ padding:"6px 12px", borderRadius:7, border:"0.5px solid #60a5fa", background:"#0c1a2e", color:"#60a5fa", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      Open task ↗
                    </button>
                    <button onClick={() => setSelectedTask(null)} style={{ background:"none", border:"none", color:"var(--text-muted)", fontSize:18, cursor:"pointer" }}>✕</button>
                  </div>
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", marginTop:8 }}>{selectedTask.title}</div>
                {selectedTask.taskRef && <div style={{ fontSize:11, fontFamily:"monospace", color:"#f59e0b" }}>#{selectedTask.taskRef}</div>}
              </div>

              <div style={{ padding:"16px 18px" }}>
                {/* Quick info */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
                  {[
                    { label:"Department",  value:selectedTask.department.name },
                    { label:"Priority",    value:selectedTask.priority },
                    { label:"Assigned to", value:selectedTask.assignedTo?.name||"Unassigned" },
                    { label:"Created by",  value:selectedTask.createdBy.name },
                    ...(selectedTask.dueDate ? [{ label:"Due date", value:new Date(selectedTask.dueDate).toLocaleDateString("en-GB") }] : []),
                    ...(selectedTask.completedAt ? [{ label:"Completed", value:new Date(selectedTask.completedAt).toLocaleDateString("en-GB") }] : []),
                    ...(selectedTask.caseReference ? [{ label:"Case ref", value:selectedTask.caseReference }] : []),
                    ...(selectedTask.office ? [{ label:"Office", value:selectedTask.office }] : []),
                  ].map(r => (
                    <div key={r.label} style={{ padding:"8px 10px", background:"var(--bg-input)", borderRadius:8 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>{r.label}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>{r.value}</div>
                    </div>
                  ))}
                </div>

                {/* Description */}
                <div style={{ padding:"10px 12px", background:"var(--bg-input)", borderRadius:8, marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Description</div>
                  <div style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6 }}>{selectedTask.description}</div>
                </div>

                {/* Activity timeline */}
                <div style={{ fontSize:12, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>
                  Activity Timeline
                </div>
                <div style={{ position:"relative" }}>
                  {/* Vertical line */}
                  <div style={{ position:"absolute", left:14, top:0, bottom:0, width:1, background:"var(--border)" }} />
                  <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                    {buildTimeline(selectedTask).map((event, i) => (
                      <div key={i} style={{ display:"flex", gap:12, marginBottom:20, position:"relative" }}>
                        {/* Icon bubble */}
                        <div style={{ width:28, height:28, borderRadius:"50%", flexShrink:0,
                          background:`${event.color}22`, border:`1.5px solid ${event.color}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:13, position:"relative", zIndex:1 }}>
                          {event.icon}
                        </div>
                        <div style={{ flex:1, paddingTop:4 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:event.color, marginBottom:3 }}>{event.title}</div>
                          <div style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.5, marginBottom:4 }}>{event.detail}</div>
                          <div style={{ fontSize:10, color:"var(--text-hint)" }}>
                            {new Date(event.time).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ borderTop:"0.5px solid var(--border)", paddingTop:16, marginTop:8, display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Quick actions</div>
                  <button onClick={() => router.push(`/tasks?taskId=${selectedTask.id}`)}
                    style={{ padding:"10px", borderRadius:9, border:"1.5px solid #60a5fa", background:"#0c1a2e", color:"#60a5fa", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                    📋 Open full task view ↗
                  </button>
                  {selectedTask.assignedTo && (
                    <button onClick={() => router.push(`/staff-directory?userId=${selectedTask.assignedTo!.id}`)}
                      style={{ padding:"10px", borderRadius:9, border:"0.5px solid var(--border)", background:"var(--bg-input)", color:"var(--text-muted)", fontSize:13, cursor:"pointer" }}>
                      👤 View {selectedTask.assignedTo.name}'s profile
                    </button>
                  )}
                  <button onClick={() => router.push(`/staff-directory?userId=${selectedTask.createdBy.id}`)}
                    style={{ padding:"10px", borderRadius:9, border:"0.5px solid var(--border)", background:"var(--bg-input)", color:"var(--text-muted)", fontSize:13, cursor:"pointer" }}>
                    👤 View creator's profile ({selectedTask.createdBy.name})
                  </button>
                  {selectedTask.department && (
                    <button onClick={() => router.push(`/departments`)}
                      style={{ padding:"10px", borderRadius:9, border:"0.5px solid var(--border)", background:"var(--bg-input)", color:"var(--text-muted)", fontSize:13, cursor:"pointer" }}>
                      🏛 Go to {selectedTask.department.name} department
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function TaskHistoryPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-page)", color: "var(--text-muted)" }}>
        Loading task history...
      </div>
    }>
      <TaskHistoryContent />
    </Suspense>
  );
}
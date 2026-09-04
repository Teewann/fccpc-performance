"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import { useToast } from "@/components/ui/ToastProvider";
import BroadcastDirectiveForm from "@/components/tasks/BroadcastDirectiveForm";

type Task = {
  id: string; taskRef: string | null; title: string; description: string;
  priority: string; status: string; treatmentStatus?: string; taskSource?: string;
  dueDate: string | null; caseReference: string | null; notes: string | null;
  directorComment: string | null; completedAt: string | null; createdAt: string;
  forwardNote: string | null; escalationReason: string | null; office: string | null;
  isPaymentRequest: boolean;
  department: { name: string };
  assignedTo: { id: string; name: string; department: { name: string } | null } | null;
  createdBy: { id: string; name: string; role: string };
  forwardedTo: { id: string; name: string; department: { name: string } | null } | null;
  forwardedFrom: { id: string; name: string; role: string } | null;
  documentName?: string | null; documentData?: string | null; documentType?: string | null;
};

type StaffMember = {
  id: string; name: string; role: string;
  department: { id: string; name: string } | null;
  unit: { name: string } | null;
};

type FinanceStaffMember = {
  id: string; name: string; role: string;
};

type Department = { id: string; name: string };

type Counts = {
  total: number; pending: number; underTreatment: number; awaitingResponse: number;
  treated: number; completed: number; escalated: number; forwarded: number;
  overdue: number; myLoad: number;
};

const STATUS_CONFIG: Record<string, { bg: string; color: string; border: string; label: string; icon: string }> = {
  PENDING:           { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", label: "Pending",           icon: "⏳" },
  ACKNOWLEDGED:      { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95", label: "Acknowledged",      icon: "👁" },
  UNDER_TREATMENT:   { bg: "#1c1107", color: "#f59e0b", border: "#78350f", label: "Under Treatment",   icon: "⚙️" },
  AWAITING_RESPONSE: { bg: "#1c1107", color: "#fb923c", border: "#9a3412", label: "Awaiting Response", icon: "💬" },
  TREATED:           { bg: "#052e16", color: "#86efac", border: "#166534", label: "Treated",           icon: "✔️" },
  COMPLETED:         { bg: "#052e16", color: "#4ade80", border: "#14532d", label: "Completed",         icon: "✅" },
  ESCALATED:         { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", label: "Escalated",         icon: "🔺" },
  FORWARDED:         { bg: "#0c1a2e", color: "#38bdf8", border: "#0369a1", label: "Forwarded",         icon: "➡️" },
  CANCELLED:         { bg: "#1a1d28", color: "#6b7280", border: "#374151", label: "Cancelled",         icon: "🚫" },
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#4ade80", MEDIUM: "#60a5fa", HIGH: "#f59e0b", CRITICAL: "#f87171",
};

const FCCPC_OFFICES = [
  "Abuja (HQ)", "Lagos Zonal Office", "Kano Zonal Office", "Minna Field Office",
  "Bauchi Field Office", "Katsina Field Office", "Port Harcourt Zonal Office", "Enugu Field Office",
];

const EMPTY_FORM = {
  title: "", description: "", assignedToId: "", priority: "MEDIUM",
  dueDate: "", caseReference: "", notes: "", office: "",
  isPaymentRequest: false, paymentRouting: "DIRECTOR", paymentRecipientId: "",
};

const STATUS_FILTERS = [
  { key: "ALL",             label: "All",             countKey: "total",            color: "#e2e8f0", border: "#475569", bg: "#1e293b"  },
  { key: "PENDING",         label: "Pending",         countKey: "pending",          color: "#60a5fa", border: "#1e3a5f", bg: "#0c1a2e"  },
  { key: "UNDER_TREATMENT", label: "Under Treatment", countKey: "underTreatment",   color: "#f59e0b", border: "#78350f", bg: "#1c1107"  },
  { key: "TREATED",         label: "Treated",         countKey: "treated",          color: "#86efac", border: "#166534", bg: "#052e16"  },
  { key: "ESCALATED",       label: "Escalated",       countKey: "escalated",        color: "#f87171", border: "#7f1d1d", bg: "#1f0707"  },
  { key: "FORWARDED",       label: "Forwarded",       countKey: "forwarded",        color: "#38bdf8", border: "#0369a1", bg: "#0c1a2e"  },
  { key: "COMPLETED",       label: "Completed",       countKey: "completed",        color: "#4ade80", border: "#14532d", bg: "#052e16"  },
];

type Panel = "detail" | "forward" | "escalate" | "comment" | "transfer";

function DocumentViewer({ documentName, documentData, documentType, onClose }: {
  documentName: string; documentData: string; documentType: string; onClose: () => void;
}) {
  const isImage = documentType.startsWith("image/");
  const isPDF   = documentType === "application/pdf";
  const src     = `data:${documentType};base64,${documentData}`;

  function dl() {
    const bytes = atob(documentData);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: documentType }));
    const a   = document.createElement("a"); a.href = url; a.download = documentName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-card)", borderRadius: 16, border: "0.5px solid var(--border)", width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "0.5px solid var(--border)", flexShrink: 0, flexWrap: "wrap" }}>
          <span style={{ fontSize: 20 }}>📎</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{documentName}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{documentType}</div>
          </div>
          <button onClick={dl} style={{ padding: "8px 14px", borderRadius: 8, border: "0.5px solid #60a5fa", background: "#0c1a2e", color: "#60a5fa", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>📥 Download</button>
          <button onClick={onClose} style={{ padding: "8px 12px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "#060606" }}>
          {isImage && <img src={src} alt={documentName} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8, objectFit: "contain" }} />}
          {isPDF   && <iframe src={src} title={documentName} style={{ width: "100%", height: "70vh", border: "none", borderRadius: 8 }} />}
          {!isImage && !isPDF && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{documentName}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Preview not available for this file type.</div>
              <button onClick={dl} style={{ padding: "12px 24px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>📥 Download to view</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TasksContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [counts,     setCounts]     = useState<Counts>({ total:0,pending:0,underTreatment:0,awaitingResponse:0,treated:0,completed:0,escalated:0,forwarded:0,overdue:0,myLoad:0 });
  const [prevCounts, setPrevCounts] = useState<Counts | null>(null);
  const [viewCounts, setViewCounts] = useState<{ assigned: number; created: number; department: number; all: number }>({ assigned: 0, created: 0, department: 0, all: 0 });

  const [page,  setPage]  = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [staffList,  setStaffList]  = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);

  const [financeStaff,      setFinanceStaff]      = useState<FinanceStaffMember[]>([]);
  const [financeStaffLoaded, setFinanceStaffLoaded] = useState(false);
  const [financeStaffLoading, setFinanceStaffLoading] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [showBroadcast, setShowBroadcast] = useState(false);

  const [loading,    setLoading]    = useState(true);
  const [userRole,   setUserRole]   = useState("");
  const [userId,     setUserId]     = useState("");
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [selected,     setSelected]     = useState<Task | null>(null);
  const [panel,        setPanel]        = useState<Panel>("detail");
  const [showForm,     setShowForm]     = useState(false);
  const [filter,       setFilter]       = useState("ALL");
  const [view,         setView]         = useState("assigned");
  const [searchTerm,   setSearchTerm]   = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [loadWarning,  setLoadWarning]  = useState("");
  const [docViewer,    setDocViewer]    = useState<{name:string;data:string;type:string}|null>(null);

  const [form,         setForm]         = useState(EMPTY_FORM);
  const [taskFile,     setTaskFile]     = useState<File | null>(null);
  const [selectedFinanceStaff, setSelectedFinanceStaff] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [comment,      setComment]      = useState("");
  const [forwardToId,  setForwardToId]  = useState("");
  const [forwardNote,  setForwardNote]  = useState("");
  const [escalReason,  setEscalReason]  = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferNote, setTransferNote] = useState("");

  const { showToast } = useToast();
  const canAssign      = ["DIRECTOR","ADMIN","EXECUTIVE"].includes(userRole);
  const canUseBalancer = ["DIRECTOR","ADMIN","EXECUTIVE","HR","SUPERVISOR"].includes(userRole);
  const canBroadcast   = ["DIRECTOR","ADMIN","EXECUTIVE","HR"].includes(userRole);

  const viewTabs = [
    { key: "assigned",   label: "Assigned to me", hint: "Tasks assigned to you or transferred to you" },
    { key: "created",    label: "Created by me",  hint: "Tasks you created or assigned to others" },
    { key: "department", label: "Department",      hint: "All tasks in your department" },
    { key: "all",        label: "All",             hint: "Assigned to me + Created by me + Department tasks" },
  ];

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view, page: String(page), limit: "20" });
      if (searchTerm) params.set("search", searchTerm);
      const res  = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      if (res.ok) {
        setTasks(data.tasks || []);
        setCounts(data.counts || {});
        setPrevCounts(data.counts || null);
        setLoadWarning(data.loadWarning || "");
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        setViewCounts(data.viewCounts || { assigned: 0, created: 0, department: 0, all: 0 });
      } else {
        showToast(data.error || "Failed to load tasks", false);
      }
    } finally { setLoading(false); }
  }, [view, searchTerm, page]);

  const loadStaffList = useCallback(async () => {
    if (staffLoaded || staffLoading) return;
    setStaffLoading(true);
    try {
      const res  = await fetch("/api/users?limit=500&isActive=true");
      const data = await res.json();
      if (res.ok) {
        setStaffList(data.users || []);
        setStaffLoaded(true);
      }
    } catch (err) { console.error(err); }
    finally { setStaffLoading(false); }
  }, [staffLoaded, staffLoading]);

  const loadFinanceStaff = useCallback(async () => {
    if (financeStaffLoaded || financeStaffLoading) return;
    setFinanceStaffLoading(true);
    try {
      const res  = await fetch("/api/tasks?financeStaff=1");
      const data = await res.json();
      if (res.ok && data.financeStaff) {
        setFinanceStaff(data.financeStaff);
        setFinanceStaffLoaded(true);
      }
    } catch (err) { console.error("Finance staff fetch error:", err); }
    finally { setFinanceStaffLoading(false); }
  }, [financeStaffLoaded, financeStaffLoading]);

  const handleOpenCreateForm = useCallback(() => {
    setShowForm(true);
    loadStaffList();
  }, [loadStaffList]);

  const handlePaymentToggle = useCallback((checked: boolean) => {
    setForm(prev => ({ ...prev, isPaymentRequest: checked, assignedToId: "" }));
    if (checked) {
      loadFinanceStaff();
    }
  }, [loadFinanceStaff]);

  useEffect(() => {
    fetch("/api/settings/account").then(r => r.json()).then(d => {
      if (d.user) {
        setUserRole(d.user.role);
        setUserId(d.user.id);
        setUserDeptId(d.user.departmentId || null);
      }
    });
    fetch("/api/departments").then(r => r.json()).then(d => {
      setDepartments(d.departments || d || []);
    });
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { setPage(1); }, [view, searchTerm]);

  useEffect(() => {
    const id = searchParams.get("taskId");
    if (id && tasks.length > 0) {
      const found = tasks.find(t => t.id === id);
      if (found) { setSelected(found); setPanel("detail"); }
    }
  }, [searchParams, tasks]);

  const displayCounts = loading && prevCounts ? prevCounts : counts;

  const filteredTasks = tasks.filter(task => {
    if (filter === "ALL") return true;
    const TREATMENT_ONLY = ["UNDER_TREATMENT","AWAITING_RESPONSE","TREATED","ESCALATED","FORWARDED","ACKNOWLEDGED"];
    if (TREATMENT_ONLY.includes(filter)) return task.treatmentStatus === filter;
    return task.status === filter;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description) { showToast("Title and description are required.", false); return; }
    if (form.isPaymentRequest && form.paymentRouting === "SPECIFIC" && !form.paymentRecipientId) {
      showToast("Please select a specific Finance staff member.", false); return;
    }
    if (form.isPaymentRequest && form.paymentRouting === "MULTI_FINANCE" && selectedFinanceStaff.length === 0) {
      showToast("Please select at least one Finance staff member.", false); return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (form.paymentRouting === "MULTI_FINANCE" && selectedFinanceStaff.length > 0) {
        fd.set("paymentRouting", "MULTI_FINANCE");
        fd.set("paymentRecipientIds", JSON.stringify(selectedFinanceStaff));
      }
      if (taskFile) fd.append("document", taskFile);
      const res  = await fetch("/api/tasks", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        showToast("Task created successfully.");
        if (data.loadWarning) setLoadWarning(data.loadWarning);
        setForm(EMPTY_FORM); setTaskFile(null);
        if (fileRef.current) fileRef.current.value = "";
        setShowForm(false); fetchTasks();
      } else { showToast(data.error || "Failed.", false); }
    } finally { setSubmitting(false); }
  }

  async function patch(body: object) {
    const res  = await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    return { ok: res.ok, data };
  }

  async function handleTreatmentUpdate(treatment: string) {
    if (!selected) return;
    setSubmitting(true);
    const { ok, data } = await patch({ taskId: selected.id, treatmentStatus: treatment });
    setSubmitting(false);
    if (ok) { setSelected(null); fetchTasks(); showToast(`Marked as ${treatment.replace(/_/g," ").toLowerCase()}.`); }
    else showToast(data.error || "Update failed.", false);
  }

  async function handleStatusUpdate(status: string) {
    if (!selected) return;
    setSubmitting(true);
    const { ok, data } = await patch({ taskId: selected.id, status });
    setSubmitting(false);
    if (ok) { setSelected(null); fetchTasks(); showToast(`Task marked as ${status.toLowerCase()}.`); }
    else showToast(data.error || "Update failed.", false);
  }

  async function handleComment() {
    if (!selected || !comment.trim()) return;
    setSubmitting(true);
    const { ok, data } = await patch({ taskId: selected.id, directorComment: comment });
    setSubmitting(false);
    if (ok) { setComment(""); setSelected(null); fetchTasks(); showToast("Comment saved."); }
    else showToast(data.error || "Failed.", false);
  }

  async function handleForward() {
    if (!selected || !forwardToId) return;
    setSubmitting(true);
    const { ok, data } = await patch({ taskId: selected.id, action: "forward", forwardToId, forwardNote });
    setSubmitting(false);
    if (ok) { setSelected(null); setForwardToId(""); setForwardNote(""); fetchTasks(); showToast("Task forwarded successfully."); }
    else showToast(data.error || "Forward failed.", false);
  }

  async function handleEscalate() {
    if (!selected || !escalReason.trim()) { showToast("Escalation reason required.", false); return; }
    setSubmitting(true);
    const { ok, data } = await patch({ taskId: selected.id, action: "escalate", escalationReason: escalReason });
    setSubmitting(false);
    if (ok) { setSelected(null); setEscalReason(""); fetchTasks(); showToast("Task escalated. Director notified."); }
    else showToast(data.error || "Escalation failed.", false);
  }

  async function handleTransfer() {
    if (!selected || !transferToId) return;
    setSubmitting(true);
    const { ok, data } = await patch({ taskId: selected.id, action: "transfer", transferToId, transferNote });
    setSubmitting(false);
    if (ok) { setSelected(null); setTransferToId(""); setTransferNote(""); fetchTasks(); showToast("Task transferred successfully."); }
    else showToast(data.error || "Transfer failed.", false);
  }

  async function handleDelete(taskId: string) {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    const res = await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
    if (res.ok) { setSelected(null); fetchTasks(); showToast("Task deleted."); }
    else showToast("Failed to delete task.", false);
  }

  const today     = new Date().toLocaleDateString("en-GB", { weekday:"long",year:"numeric",month:"long",day:"numeric" });
  const loadColor = displayCounts.myLoad >= 10 ? "#f87171" : displayCounts.myLoad >= 6 ? "#f59e0b" : "#4ade80";

  function staffGroups(excludeSelf = false, filterFn?: (s: StaffMember) => boolean) {
    let list = excludeSelf ? staffList.filter(s => s.id !== userId) : staffList;
    if (filterFn) list = list.filter(filterFn);
    const ALL_ROLES = ["EXECUTIVE","DIRECTOR","ADMIN","HR","SUPERVISOR","STAFF",
      "INTERN","CORPER","CONTRACT","CONSULTANT","IT_SIWES","OTHER"] as const;
    return ALL_ROLES.map(roleGroup => {
      const group = list.filter(s => s.role === roleGroup);
      if (!group.length) return null;
      const labels: Record<string,string> = {
        EXECUTIVE:"Executives",DIRECTOR:"Directors",ADMIN:"Administrators",
        HR:"HR Officers",SUPERVISOR:"Supervisors",STAFF:"Staff",
        INTERN:"Interns",CORPER:"Corpers",CONTRACT:"Contract Staff",
        CONSULTANT:"Consultants",IT_SIWES:"IT/SIWES",OTHER:"Others",
      };
      return (
        <optgroup key={roleGroup} label={`── ${labels[roleGroup] || roleGroup} ──`}>
          {group.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}{s.department ? ` (${s.department.name})` : ""}
            </option>
          ))}
        </optgroup>
      );
    });
  }

  const inp: React.CSSProperties = {
    width:"100%", background:"var(--bg-input)", border:"0.5px solid var(--border)",
    borderRadius:10, padding:"12px 14px", fontSize:15, color:"var(--text-primary)",
    outline:"none", boxSizing:"border-box", marginBottom:14,
  };
  const lbl: React.CSSProperties = { display:"block", fontSize:14, fontWeight:600, color:"var(--text-muted)", marginBottom:7 };
  const pageBtn: React.CSSProperties = {
    background:"var(--bg-input)", border:"0.5px solid var(--border)", borderRadius:9,
    padding:"8px 16px", cursor:"pointer", fontSize:13, color:"var(--text-muted)",
  };

  return (
    <div className="flex min-h-screen" style={{ background:"var(--bg-page)" }}>
      <Sidebar />

      {docViewer && (
        <DocumentViewer documentName={docViewer.name} documentData={docViewer.data} documentType={docViewer.type} onClose={() => setDocViewer(null)} />
      )}

      {showBroadcast && (
        <BroadcastDirectiveForm
          departments={departments}
          defaultDepartmentId={userDeptId}
          onClose={() => setShowBroadcast(false)}
          onSuccess={() => { setShowBroadcast(false); fetchTasks(); }}
        />
      )}

      <main className="flex-1 p-6 min-w-0">

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <h1 style={{ fontSize:26, fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>Tasks</h1>
            <p style={{ fontSize:14, color:"var(--text-muted)", marginTop:4 }}>{today}</p>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap: "wrap" }}>

            <button onClick={() => router.push("/performance")}
              style={{ padding:"8px 16px", borderRadius:10, border:"0.5px solid #92400e", background:"#1c0a00", color:"#fbbf24", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              🏆 Leaderboard
            </button>

            <div style={{ padding:"8px 16px", borderRadius:10, background:"var(--bg-card)", border:`0.5px solid ${loadColor}`, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13, color:"var(--text-muted)" }}>My load</span>
              <span style={{ fontSize:18, fontWeight:700, color:loadColor }}>{displayCounts.myLoad}</span>
            </div>

            <button
              onClick={() => router.push("/task-history")}
              style={{ padding:"10px 18px", borderRadius:10, border:"1.5px solid #a78bfa", background:"#1a0a2e", color:"#a78bfa", fontSize:14, fontWeight:600, cursor:"pointer" }}
              title="View task history and activity log"
            >
              📋 History
            </button>
            {canUseBalancer && (
              <button onClick={() => router.push("/task-load-balancer")} style={{ padding:"10px 22px", borderRadius:10, border:"1.5px solid #60a5fa", background:"#0c1a2e", color:"#60a5fa", fontSize:14, fontWeight:600, cursor:"pointer" }}>
                ⚖ Load Balancer
              </button>
            )}
            {canBroadcast && (
              <button onClick={() => setShowBroadcast(true)} style={{ padding:"10px 22px", borderRadius:10, border:"1.5px solid #a78bfa", background:"#1a0a2e", color:"#a78bfa", fontSize:14, fontWeight:600, cursor:"pointer" }}>
                📣 Broadcast to department
              </button>
            )}
            <button onClick={handleOpenCreateForm} style={{ padding:"10px 22px", borderRadius:10, border:"1.5px solid #22c55e", background:"#052e16", color:"#4ade80", fontSize:14, fontWeight:600, cursor:"pointer" }}>
              {showForm ? "Cancel" : canAssign ? "+ Assign task" : "+ Create task"}
            </button>
            <ThemeToggleButton />
          </div>
        </div>

        {loadWarning && (
          <div style={{ background:"#1c1107", border:"0.5px solid #78350f", borderRadius:10, padding:"12px 18px", fontSize:14, color:"#f59e0b", marginBottom:16 }}>
            ⚠ {loadWarning}
          </div>
        )}

        <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
          {viewTabs.map(v => {
            const active = view === v.key;
            const cnt = viewCounts[v.key as keyof typeof viewCounts] ?? 0;
            return (
              <button key={v.key}
                onClick={() => { setView(v.key); setFilter("ALL"); setSelected(null); }}
                title={v.hint}
                style={{
                  padding:"9px 18px", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer",
                  border:`1.5px solid ${active ? "#60a5fa" : "var(--border)"}`,
                  background: active ? "#0c1a2e" : "var(--bg-input)",
                  color: active ? "#60a5fa" : "var(--text-muted)",
                }}>
                {v.label}
                <span style={{
                  marginLeft:6, fontSize:11, fontWeight:700, padding:"1px 7px", borderRadius:20,
                  background: active ? "#60a5fa22" : "var(--bg-card)",
                  color: active ? "#60a5fa" : "var(--text-muted)",
                  border:`0.5px solid ${active ? "#60a5fa44" : "var(--border)"}`,
                }}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
          {[
            { label:"Total",          value:displayCounts.total,            color:"var(--text-primary)" },
            { label:"Pending",        value:displayCounts.pending,          color:"#60a5fa" },
            { label:"Under treatment",value:displayCounts.underTreatment,   color:"#f59e0b" },
            { label:"Awaiting resp.", value:displayCounts.awaitingResponse,  color:"#fb923c" },
            { label:"Overdue",        value:displayCounts.overdue,          color:"#f87171" },
          ].map(s => (
            <div key={s.label} className="card-bg" style={{ borderRadius:12, padding:"14px 16px", textAlign:"center" }}>
              <div style={{ fontSize:26, fontWeight:700, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:12 }}>
          <input type="text" placeholder="🔍  Search by Task ID, title, description, case ref, or staff name…"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...inp, marginBottom:0 }} />
        </div>

        <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
          {STATUS_FILTERS.map(f => {
            const count  = displayCounts[f.countKey as keyof Counts] ?? 0;
            const active = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"8px 14px", borderRadius:9, cursor:"pointer",
                  fontSize:13, fontWeight: active ? 700 : 600,
                  border:`1.5px solid ${f.border}`,
                  background: active ? f.bg : "var(--bg-card)",
                  color: f.color,
                  boxShadow: active ? `0 0 0 1px ${f.border}` : "none",
                  transition:"background 0.15s, box-shadow 0.15s",
                }}>
                {f.label}
                <span style={{
                  fontSize:11, fontWeight:800,
                  padding:"2px 8px", borderRadius:20,
                  background: active ? `${f.color}30` : `${f.color}18`,
                  color: f.color,
                  border:`1px solid ${f.border}`,
                  minWidth:24, textAlign:"center" as const,
                  letterSpacing:"0.02em",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-hint)", marginBottom: 20 }}>
          Filter counts are totals across every page — use Previous/Next below the list to see them all, not just this page.
        </div>

        {showForm && (
          <div className="card-bg" style={{ borderRadius:14, padding:28, marginBottom:22 }}>
            <h2 style={{ fontSize:18, fontWeight:700, color:"var(--text-primary)", marginBottom:20 }}>
              {canAssign ? "Assign task to staff" : "Create task"}
            </h2>
            <form onSubmit={handleCreate}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lbl}>Task title *</label>
                  <input style={inp} value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Clear, specific task title" required />
                </div>

                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lbl}>Description *</label>
                  <textarea style={{...inp,resize:"none",minHeight:90} as any} value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Full details of what needs to be done…" required />
                </div>

                <div style={{ gridColumn:"1/-1" }}>
                  <div style={{ padding:"12px 16px", background:"var(--bg-input)", borderRadius:10, border:`1.5px solid ${form.isPaymentRequest ? "#22c55e" : "var(--border)"}`, display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
                    onClick={() => handlePaymentToggle(!form.isPaymentRequest)}>
                    <input type="checkbox" id="payreq" checked={form.isPaymentRequest}
                      onChange={e => handlePaymentToggle(e.target.checked)}
                      style={{ width:18, height:18, accentColor:"#22c55e", cursor:"pointer" }} onClick={e => e.stopPropagation()} />
                    <div>
                      <label htmlFor="payreq" style={{ fontSize:14, fontWeight:600, color: form.isPaymentRequest ? "#4ade80" : "var(--text-primary)", cursor:"pointer" }}>
                        💳 This is a payment confirmation request to Finance
                      </label>
                      <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>
                        Ticking this replaces the assign dropdown with Finance routing options
                      </div>
                    </div>
                  </div>
                </div>

                {form.isPaymentRequest ? (
                  <>
                    <div>
                      <label style={lbl}>Route payment to</label>
                      <select style={inp} value={form.paymentRouting} onChange={e => {
                        setForm({...form,paymentRouting:e.target.value,paymentRecipientId:""});
                        setSelectedFinanceStaff([]);
                        if (!financeStaffLoaded) loadFinanceStaff();
                      }}>
                        <option value="DIRECTOR">Head of Finance (Director only)</option>
                        <option value="ALL_FINANCE">All Finance Department staff</option>
                        <option value="SPECIFIC">One specific Finance person</option>
                        <option value="MULTI_FINANCE">Select specific Finance staff (multiple)</option>
                      </select>
                    </div>

                    {financeStaffLoading && (
                      <div style={{ gridColumn:"1/-1", fontSize:13, color:"var(--text-muted)", padding:"10px 14px", background:"var(--bg-input)", borderRadius:9 }}>
                        Loading Finance staff…
                      </div>
                    )}

                    {form.paymentRouting === "SPECIFIC" && financeStaffLoaded && (
                      <div>
                        <label style={lbl}>Select Finance staff member</label>
                        <select style={inp} value={form.paymentRecipientId} onChange={e => setForm({...form,paymentRecipientId:e.target.value})}>
                          <option value="">Select person…</option>
                          {financeStaff.length === 0 ? (
                            <option disabled>No Finance/Accounts staff found in database</option>
                          ) : (
                            financeStaff.map(s => (
                              <option key={s.id} value={s.id}>{s.name} - {s.role}</option>
                            ))
                          )}
                        </select>
                        {financeStaff.length === 0 && (
                          <div style={{ fontSize:12, color:"#f87171", marginTop:-10, marginBottom:10 }}>
                            ⚠ No Finance staff found. Ask admin to assign users to the "Finance and Accounts" department.
                          </div>
                        )}
                        {financeStaff.length > 0 && (
                          <div style={{ fontSize:12, color:"#4ade80", marginTop:-10, marginBottom:10 }}>
                            ✓ {financeStaff.length} Finance staff available
                          </div>
                        )}
                      </div>
                    )}

                    {form.paymentRouting === "MULTI_FINANCE" && financeStaffLoaded && (
                      <div style={{ gridColumn:"1/-1" }}>
                        <label style={lbl}>Select Finance staff to notify ({selectedFinanceStaff.length} selected)</label>
                        {financeStaff.length === 0 ? (
                          <div style={{ fontSize:13, color:"#f87171", padding:"10px 14px", background:"#1f0707", borderRadius:9, border:"0.5px solid #7f1d1d" }}>
                            ⚠ No Finance/Accounts department staff found.
                          </div>
                        ) : (
                          <div style={{ background:"var(--bg-input)", border:"0.5px solid var(--border)", borderRadius:10, padding:8, display:"flex", flexDirection:"column", gap:6, maxHeight:220, overflowY:"auto" }}>
                            <div onClick={() => setSelectedFinanceStaff(selectedFinanceStaff.length === financeStaff.length ? [] : financeStaff.map(s=>s.id))}
                              style={{ padding:"8px 10px", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", gap:10,
                                background: selectedFinanceStaff.length === financeStaff.length ? "#052e16" : "var(--bg-card)",
                                border:`0.5px solid ${selectedFinanceStaff.length === financeStaff.length ? "#14532d" : "var(--border)"}` }}>
                              <div style={{ width:18, height:18, borderRadius:5, flexShrink:0,
                                border:`1.5px solid ${selectedFinanceStaff.length === financeStaff.length ? "#4ade80" : "var(--border)"}`,
                                background: selectedFinanceStaff.length === financeStaff.length ? "#22c55e" : "transparent",
                                display:"flex", alignItems:"center", justifyContent:"center" }}>
                                {selectedFinanceStaff.length === financeStaff.length && <span style={{ fontSize:11, color:"white", fontWeight:800 }}>✓</span>}
                              </div>
                              <span style={{ fontSize:13, fontWeight:600, color: selectedFinanceStaff.length === financeStaff.length ? "#4ade80" : "var(--text-muted)" }}>
                                Select all ({financeStaff.length} Finance staff)
                              </span>
                            </div>
                            {financeStaff.map(s => {
                              const checked = selectedFinanceStaff.includes(s.id);
                              return (
                                <div key={s.id}
                                  onClick={() => setSelectedFinanceStaff(prev => checked ? prev.filter(id=>id!==s.id) : [...prev, s.id])}
                                  style={{ padding:"8px 10px", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", gap:10,
                                    background: checked ? "#0c1a2e" : "transparent",
                                    border:`0.5px solid ${checked ? "#1e3a5f" : "transparent"}` }}>
                                  <div style={{ width:18, height:18, borderRadius:5, flexShrink:0,
                                    border:`1.5px solid ${checked ? "#60a5fa" : "var(--border)"}`,
                                    background: checked ? "#3b82f6" : "transparent",
                                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    {checked && <span style={{ fontSize:11, color:"white", fontWeight:800 }}>✓</span>}
                                  </div>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:13, fontWeight:600, color: checked ? "#60a5fa" : "var(--text-primary)" }}>{s.name}</div>
                                    <div style={{ fontSize:11, color:"var(--text-muted)" }}>{s.role}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {selectedFinanceStaff.length === 0 && (
                          <div style={{ fontSize:12, color:"#f59e0b", marginTop:6 }}>⚠ Select at least one Finance staff member to notify</div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <label style={lbl}>{canAssign ? "Assign to" : "Assign to (optional)"}</label>
                    <select style={inp} value={form.assignedToId} onChange={e => setForm({...form,assignedToId:e.target.value})}>
                      <option value="">Select person…</option>
                      <option value="SELF">👤 Assign to myself (self task)</option>
                      {staffLoaded ? staffGroups(false) : (
                        <option value="" disabled>Loading staff list…</option>
                      )}
                    </select>
                    {!staffLoaded && !staffLoading && (
                      <div style={{ fontSize:12, color:"#f59e0b", marginTop:-8, marginBottom:8 }}>
                        Click the "Assign task" button to load staff list
                      </div>
                    )}
                    {staffLoading && (
                      <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:-8, marginBottom:8 }}>
                        Loading staff…
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label style={lbl}>Priority</label>
                  <select style={inp} value={form.priority} onChange={e => setForm({...form,priority:e.target.value})}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label style={lbl}>Due date</label>
                  <input type="date" style={inp} value={form.dueDate} min={new Date().toISOString().split("T")[0]} onChange={e => setForm({...form,dueDate:e.target.value})} />
                </div>

                <div>
                  <label style={lbl}>Office / Zone</label>
                  <select style={inp} value={form.office} onChange={e => setForm({...form,office:e.target.value})}>
                    <option value="">All offices (HQ default)</option>
                    {FCCPC_OFFICES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label style={lbl}>Case reference</label>
                  <input style={inp} value={form.caseReference} onChange={e => setForm({...form,caseReference:e.target.value})} placeholder="e.g. S&I-2026-0142" />
                </div>

                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lbl}>Attach document (optional)</label>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={e => setTaskFile(e.target.files?.[0] || null)} style={{...inp,padding:"10px 14px"}} />
                  {taskFile && <div style={{ fontSize:12, color:"#4ade80", marginTop:-10, marginBottom:10 }}>📎 {taskFile.name}</div>}
                </div>

                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lbl}>Notes (optional)</label>
                  <textarea style={{...inp,resize:"none",minHeight:70} as any} value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Additional notes…" />
                </div>
              </div>

              <div style={{ display:"flex", gap:12, paddingTop:8, borderTop:"0.5px solid var(--border-soft)" }}>
                <button type="button"
                  onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setTaskFile(null); if (fileRef.current) fileRef.current.value=""; }}
                  style={{ padding:"11px 20px", borderRadius:10, border:"0.5px solid var(--border)", background:"var(--bg-input)", color:"var(--text-muted)", cursor:"pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  style={{ padding:"11px 28px", borderRadius:10, border:"1.5px solid #22c55e", background:"#052e16", color:"#4ade80", fontSize:14, fontWeight:600, cursor:submitting?"not-allowed":"pointer" }}>
                  {submitting ? "Creating…" : canAssign ? "Assign task" : "Create task"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:selected?"1fr 420px":"1fr", gap:16 }}>

          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {loading ? (
              <div style={{ textAlign:"center", padding:48, color:"var(--text-muted)", fontSize:15 }}>Loading tasks…</div>
            ) : filteredTasks.length === 0 ? (
              <div className="card-bg" style={{ borderRadius:14, padding:56, textAlign:"center" }}>
                <div style={{ fontSize:44, marginBottom:16 }}>📋</div>
                <div style={{ fontSize:18, fontWeight:500, color:"var(--text-primary)", marginBottom:8 }}>No tasks found</div>
                <div style={{ fontSize:14, color:"var(--text-muted)" }}>
                  {filter !== "ALL" ? `No ${filter.replace(/_/g," ").toLowerCase()} tasks on this page — try Previous/Next below, or a different filter` : "No tasks match the current filter"}
                </div>
              </div>
            ) : (
              filteredTasks.map(task => {
                const displayStatus = task.treatmentStatus && task.treatmentStatus !== "PENDING" ? task.treatmentStatus : task.status;
                const sc  = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.PENDING;
                const pc  = PRIORITY_COLOR[task.priority] || "#60a5fa";
                const sel = selected?.id === task.id;
                const od  = task.dueDate && !["COMPLETED","CANCELLED"].includes(task.status) && new Date(task.dueDate) < new Date();
                return (
                  <div key={task.id}
                    onClick={() => { setSelected(sel ? null : task); setPanel("detail"); setComment(""); setForwardToId(""); setForwardNote(""); setEscalReason(""); setTransferToId(""); setTransferNote(""); }}
                    className="card-bg"
                    style={{ borderRadius:14, padding:"20px 24px", cursor:"pointer", borderLeft:`3px solid ${sel?"var(--accent)":sc.color}`, outline:`0.5px solid ${sel?"var(--accent)":"var(--border)"}`, transition:"outline 0.15s" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:16, fontWeight:600, color:"var(--text-primary)" }}>{task.title}</div>
                        {task.taskRef && <div style={{ fontSize:12, fontFamily:"monospace", color:"#f59e0b", marginTop:2, marginBottom:4 }}>Task ID: {task.taskRef}</div>}
                        <div style={{ fontSize:13, color:"var(--text-muted)" }}>
                          {task.department.name}
                          {task.assignedTo ? ` · To: ` : ""}
                          {task.assignedTo && (
                            <span
                              style={{ color:"#60a5fa", cursor:"pointer", textDecoration:"underline", textDecorationThickness:1 }}
                              onClick={e => { e.stopPropagation(); router.push(`/staff-directory?userId=${task.assignedTo!.id}`); }}
                            >
                              {task.assignedTo.name}
                            </span>
                          )}
                          {" · By: "}
                          <span
                            style={{ color:"#a78bfa", cursor:"pointer", textDecoration:"underline", textDecorationThickness:1 }}
                            onClick={e => { e.stopPropagation(); router.push(`/staff-directory?userId=${task.createdBy.id}`); }}
                          >
                            {task.createdBy.name}
                          </span>
                          {task.forwardedTo && ` · Fwd→ ${task.forwardedTo.name}`}
                          {task.office && ` · 📍 ${task.office}`}
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:8, flexShrink:0, marginLeft:12, flexWrap:"wrap", justifyContent:"flex-end" }}>
                        {task.taskSource === "EVC" && (
                          <span style={{ fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:6,
                            background:"#1c0a00", color:"#fbbf24", border:"1px solid #92400e",
                            boxShadow:"0 0 8px #f59e0b44", letterSpacing:"0.04em" }}>
                            ⚡ EVC
                          </span>
                        )}
                        {task.isPaymentRequest && (
                          <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:6,
                            background:"#1a0a2e", color:"#a78bfa", border:"0.5px solid #4c1d95" }}>
                            💳 Payment
                          </span>
                        )}
                        <span style={{ fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:7, color:pc, background:`${pc}22`, border:`0.5px solid ${pc}44` }}>{task.priority}</span>
                        <span style={{ fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:7, background:sc.bg, color:sc.color, border:`0.5px solid ${sc.border}` }}>{sc.icon} {sc.label}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.5, marginBottom:10 }}>
                      {task.description.length > 120 ? task.description.slice(0,118)+"…" : task.description}
                    </div>
                    <div style={{ display:"flex", gap:16, fontSize:13, color:"var(--text-hint)", flexWrap:"wrap", alignItems:"center" }}>
                      {task.dueDate && <span style={{ color:od?"#f87171":"var(--text-hint)" }}>{od?"⚠ Overdue: ":"📅 "}{new Date(task.dueDate).toLocaleDateString()}</span>}
                      {task.caseReference && <span>🔖 {task.caseReference}</span>}
                      {task.escalationReason && <span style={{ color:"#f87171" }}>🔺 Escalated</span>}
                      {task.forwardNote && <span style={{ color:"#38bdf8" }}>➡️ Forwarded</span>}
                      {task.documentName && (
                        <span style={{ color:"#60a5fa", cursor:"pointer", textDecoration:"underline", textDecorationThickness:1, display:"flex", alignItems:"center", gap:4 }}
                          onClick={e => { e.stopPropagation(); if (task.documentData&&task.documentType) setDocViewer({name:task.documentName!,data:task.documentData,type:task.documentType}); }}>
                          📎 {task.documentName}
                        </span>
                      )}
                      <span style={{ color:"#a78bfa", cursor:"pointer", textDecoration:"underline", textDecorationThickness:1, marginLeft:"auto" }}
                        onClick={e => { e.stopPropagation(); router.push(`/task-history?taskId=${task.id}`); }}>
                        📋 history
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {pages > 1 && (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 4px" }}>
                <div style={{ fontSize:13, color:"var(--text-muted)" }}>
                  Page {page} of {pages} · {total} tasks total
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn}>Previous</button>
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={pageBtn}>Next</button>
                </div>
              </div>
            )}
          </div>

          {selected && (
            <div className="card-bg" style={{ borderRadius:14, padding:24, position:"sticky", top:24, alignSelf:"start", maxHeight:"calc(100vh - 120px)", overflowY:"auto" }}>

              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16, paddingBottom:14, borderBottom:"0.5px solid var(--border-soft)" }}>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {(["detail","forward","escalate","comment","transfer"] as const).map(p => (
                    <button key={p} onClick={() => setPanel(p)}
                      style={{ padding:"6px 12px", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer",
                        border:`0.5px solid ${panel===p?"var(--accent)":"var(--border)"}`,
                        background:panel===p?"var(--accent-bg)":"transparent",
                        color:panel===p?"var(--accent-text)":"var(--text-muted)" }}>
                      {p.charAt(0).toUpperCase()+p.slice(1)}
                    </button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => router.push(`/task-history?taskId=${selected.id}`)}
                    style={{ padding:"6px 10px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", border:"0.5px solid #a78bfa", background:"#1a0a2e", color:"#a78bfa" }}>
                    📋
                  </button>
                  <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", color:"var(--text-muted)", fontSize:20, cursor:"pointer" }}>✕</button>
                </div>
              </div>

              {panel === "detail" && (
                <div>
                  <div style={{ fontSize:18, fontWeight:700, color:"var(--text-primary)", marginBottom:6 }}>{selected.title}</div>
                  {selected.taskRef && <div style={{ fontSize:13, color:"#f59e0b", fontFamily:"monospace", marginBottom:14, fontWeight:600 }}>ID: {selected.taskRef}</div>}

                  {selected.documentName && (
                    <div style={{ marginBottom:16, padding:"12px 14px", background:"var(--bg-input)", borderRadius:10, border:"0.5px solid var(--border)" }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Attached document</div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                        <span style={{ fontSize:22 }}>{selected.documentType?.startsWith("image/")?"🖼":selected.documentType==="application/pdf"?"📄":"📎"}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{selected.documentName}</div>
                          <div style={{ fontSize:11, color:"var(--text-muted)" }}>{selected.documentType}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        {selected.documentData && selected.documentType && (
                          <button onClick={() => setDocViewer({name:selected.documentName!,data:selected.documentData!,type:selected.documentType!})}
                            style={{ flex:1, padding:"8px 0", borderRadius:7, border:"0.5px solid #a78bfa", background:"#1a0a2e", color:"#a78bfa", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                            👁 View
                          </button>
                        )}
                        {selected.documentData && (
                          <button onClick={() => {
                            const bytes = atob(selected.documentData!);
                            const arr = new Uint8Array(bytes.length);
                            for (let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
                            const url=URL.createObjectURL(new Blob([arr],{type:selected.documentType||"application/octet-stream"}));
                            const a=document.createElement("a");a.href=url;a.download=selected.documentName!;
                            document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
                          }}
                            style={{ flex:1, padding:"8px 0", borderRadius:7, border:"0.5px solid #60a5fa", background:"#0c1a2e", color:"#60a5fa", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                            📥 Download
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ background:"var(--bg-input)", border:"0.5px solid var(--border)", borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
                    <div style={{ fontSize:14, color:"var(--text-secondary)", lineHeight:1.7 }}>{selected.description}</div>
                  </div>

                  {(() => {
                    const sc = STATUS_CONFIG[selected.status]||STATUS_CONFIG.PENDING;
                    const rows = [
                      { label:"Status",   value:`${sc.icon} ${sc.label}` },
                      ...(selected.treatmentStatus&&selected.treatmentStatus!=="PENDING" ? [{ label:"Treatment", value:STATUS_CONFIG[selected.treatmentStatus]?.label||selected.treatmentStatus }] : []),
                      { label:"Priority",    value:selected.priority },
                      { label:"Department",  value:selected.department.name },
                      { label:"Assigned to", value:selected.assignedTo?.name||"Unassigned", link:selected.assignedTo ? `/staff-directory?userId=${selected.assignedTo.id}` : undefined },
                      { label:"Created by",  value:`${selected.createdBy.name} (${selected.createdBy.role.charAt(0)+selected.createdBy.role.slice(1).toLowerCase()})`, link:`/staff-directory?userId=${selected.createdBy.id}` },
                      ...(selected.forwardedTo   ? [{ label:"Forwarded to",  value:selected.forwardedTo.name }] : []),
                      ...(selected.forwardedFrom ? [{ label:"Forwarded by",  value:selected.forwardedFrom.name }] : []),
                      ...(selected.forwardNote   ? [{ label:"Forward note",  value:selected.forwardNote }] : []),
                      ...(selected.escalationReason ? [{ label:"Escalation reason", value:selected.escalationReason, color:"#f87171" }] : []),
                      ...(selected.dueDate ? [{ label:"Due date", value:new Date(selected.dueDate).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}) }] : []),
                      ...(selected.office        ? [{ label:"Office/Zone",   value:selected.office }] : []),
                      ...(selected.caseReference ? [{ label:"Case ref",      value:selected.caseReference }] : []),
                      ...(selected.notes         ? [{ label:"Notes",         value:selected.notes }] : []),
                    ] as { label:string; value:string; color?:string; link?:string }[];

                    return rows.map(({ label, value, color, link }) => (
                      <div key={label} style={{ marginBottom:12 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{label}</div>
                        {link ? (
                          <span onClick={() => router.push(link)} style={{ fontSize:14, fontWeight:500, color:color||"#60a5fa", cursor:"pointer", textDecoration:"underline", textDecorationThickness:1 }}>
                            {value} ↗
                          </span>
                        ) : (
                          <div style={{ fontSize:14, fontWeight:500, color:color||"var(--text-primary)", lineHeight:1.5 }}>{value}</div>
                        )}
                      </div>
                    ));
                  })()}

                  {selected.directorComment && (
                    <div style={{ marginTop:14, padding:"14px 16px", background:"var(--accent-bg)", border:"0.5px solid var(--accent-border)", borderRadius:10 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--accent-text)", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>Director comment</div>
                      <div style={{ fontSize:14, color:"var(--accent-text)", opacity:0.9, lineHeight:1.6 }}>{selected.directorComment}</div>
                    </div>
                  )}

                  {!["COMPLETED","CANCELLED"].includes(selected.status) && (
                    <div style={{ marginTop:18, paddingTop:14, borderTop:"0.5px solid var(--border-soft)" }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"var(--text-muted)", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.06em" }}>Update treatment status</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                        {[
                          { s:"ACKNOWLEDGED",     label:"Acknowledge",      bg:"#1a0a2e", color:"#a78bfa", border:"#4c1d95" },
                          { s:"UNDER_TREATMENT",  label:"Under Treatment",  bg:"#1c1107", color:"#f59e0b", border:"#78350f" },
                          { s:"AWAITING_RESPONSE",label:"Awaiting Response",bg:"#1c1107", color:"#fb923c", border:"#9a3412" },
                          { s:"TREATED",          label:"Mark Treated",     bg:"#052e16", color:"#86efac", border:"#166534" },
                        ].map(({s,label,bg,color,border}) => (
                          <button key={s} onClick={() => handleTreatmentUpdate(s)} disabled={submitting||selected.treatmentStatus===s}
                            style={{ padding:"10px 8px", borderRadius:8, border:`0.5px solid ${border}`, background:bg, color, fontSize:12, fontWeight:600, cursor:selected.treatmentStatus===s?"default":"pointer", opacity:selected.treatmentStatus===s?0.4:1 }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <div style={{ marginTop:10, display:"flex", gap:8 }}>
                        <button onClick={() => handleStatusUpdate("COMPLETED")} disabled={submitting}
                          style={{ flex:1, padding:"10px", borderRadius:8, border:"1.5px solid #4ade80", background:"#052e16", color:"#4ade80", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                          ✅ Mark Complete
                        </button>
                        <button onClick={() => handleStatusUpdate("CANCELLED")} disabled={submitting}
                          style={{ flex:1, padding:"10px", borderRadius:8, border:"0.5px solid #374151", background:"#1a1d28", color:"#6b7280", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                          🚫 Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {(selected.createdBy.id===userId||["DIRECTOR","ADMIN"].includes(userRole)) && (
                    <button onClick={() => handleDelete(selected.id)}
                      style={{ width:"100%", marginTop:12, padding:"10px", borderRadius:9, border:"0.5px solid #7f1d1d", background:"#1f0707", color:"#f87171", fontSize:13, fontWeight:500, cursor:"pointer" }}>
                      Delete task
                    </button>
                  )}
                </div>
              )}

              {panel === "forward" && (
                <div>
                  <div style={{ fontSize:17, fontWeight:700, color:"var(--text-primary)", marginBottom:6 }}>Forward task</div>
                  <div style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16, lineHeight:1.6, padding:"10px 12px", background:"var(--bg-input)", borderRadius:8 }}>
                    <strong>Forward</strong> creates a copy for another person. The original stays with you.
                    {selected.documentName && <div style={{ marginTop:6, color:"#60a5fa" }}>📎 Document <strong>{selected.documentName}</strong> will also be forwarded.</div>}
                  </div>
                  <label style={lbl}>Forward to *</label>
                  <select style={inp} value={forwardToId} onChange={e => setForwardToId(e.target.value)}>
                    <option value="">Select person…</option>
                    {staffLoaded ? staffGroups(true) : (
                      <option value="" disabled>Loading staff…</option>
                    )}
                  </select>
                  <label style={lbl}>Reason / note</label>
                  <textarea rows={3} value={forwardNote} onChange={e => setForwardNote(e.target.value)} placeholder="Why are you forwarding?" style={{...inp,resize:"none"}} />
                  <button onClick={handleForward} disabled={submitting||!forwardToId}
                    style={{ width:"100%", padding:"12px", borderRadius:10, border:"1.5px solid #38bdf8", background:"#0c1a2e", color:"#38bdf8", fontSize:14, fontWeight:700, cursor:!forwardToId?"not-allowed":"pointer", opacity:!forwardToId?0.5:1 }}>
                    {submitting ? "Forwarding…" : "Forward task →"}
                  </button>
                </div>
              )}

              {panel === "escalate" && (
                <div>
                  <div style={{ fontSize:17, fontWeight:700, color:"var(--text-primary)", marginBottom:6 }}>Escalate task</div>
                  <div style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16, lineHeight:1.6, padding:"10px 12px", background:"var(--bg-input)", borderRadius:8 }}>
                    Sends an urgent alert to the department Director. The task stays assigned to you.
                  </div>
                  <label style={lbl}>Escalation reason *</label>
                  <textarea rows={4} value={escalReason} onChange={e => setEscalReason(e.target.value)} placeholder="What is blocked? Why do you need Director attention?" style={{...inp,resize:"none"}} />
                  <div style={{ background:"#1f0707", border:"0.5px solid #7f1d1d", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
                    <div style={{ fontSize:13, color:"#f87171", lineHeight:1.6 }}>⚠ The Director of this department will be alerted immediately.</div>
                  </div>
                  <button onClick={handleEscalate} disabled={submitting||!escalReason.trim()}
                    style={{ width:"100%", padding:"12px", borderRadius:10, border:"1.5px solid #f87171", background:"#1f0707", color:"#f87171", fontSize:14, fontWeight:700, cursor:!escalReason.trim()?"not-allowed":"pointer", opacity:!escalReason.trim()?0.5:1 }}>
                    {submitting ? "Escalating…" : "🔺 Escalate this task"}
                  </button>
                </div>
              )}

              {panel === "comment" && (
                <div>
                  <div style={{ fontSize:17, fontWeight:700, color:"var(--text-primary)", marginBottom:6 }}>Add comment</div>
                  <div style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16, lineHeight:1.6, padding:"10px 12px", background:"var(--bg-input)", borderRadius:8 }}>
                    Leave a comment or instruction. Visible to the assignee and creator.
                  </div>
                  <textarea rows={5} value={comment} onChange={e => setComment(e.target.value)} placeholder="Write your comment here…" style={{...inp,resize:"none"}} />
                  <button onClick={handleComment} disabled={submitting||!comment.trim()}
                    style={{ width:"100%", padding:"12px", borderRadius:10, border:"1.5px solid #22c55e", background:"#052e16", color:"#4ade80", fontSize:14, fontWeight:700, cursor:!comment.trim()?"not-allowed":"pointer", opacity:!comment.trim()?0.5:1 }}>
                    {submitting ? "Saving…" : "Save comment"}
                  </button>
                </div>
              )}

              {panel === "transfer" && (
                <div>
                  <div style={{ fontSize:17, fontWeight:700, color:"var(--text-primary)", marginBottom:6 }}>Transfer task (handover)</div>
                  <div style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16, lineHeight:1.6, padding:"10px 12px", background:"var(--bg-input)", borderRadius:8 }}>
                    <strong>Transfer</strong> permanently changes the assignee. The new person takes full ownership. Unlike Forward, no copy is made.
                  </div>
                  <label style={lbl}>Transfer to *</label>
                  <select style={inp} value={transferToId} onChange={e => setTransferToId(e.target.value)}>
                    <option value="">Select person…</option>
                    {staffLoaded ? staffGroups(true) : (
                      <option value="" disabled>Loading staff…</option>
                    )}
                  </select>
                  <label style={lbl}>Transfer reason / note</label>
                  <textarea rows={3} value={transferNote} onChange={e => setTransferNote(e.target.value)} placeholder="Why are you transferring? (optional)" style={{...inp,resize:"none"}} />
                  <button onClick={handleTransfer} disabled={submitting||!transferToId}
                    style={{ width:"100%", padding:"12px", borderRadius:10, border:"1.5px solid #f59e0b", background:"#1c1107", color:"#f59e0b", fontSize:14, fontWeight:700, cursor:!transferToId?"not-allowed":"pointer", opacity:!transferToId?0.5:1 }}>
                    {submitting ? "Transferring…" : "Transfer task →"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-page)", color: "var(--text-muted)" }}>
        Loading tasks...
      </div>
    }>
      <TasksContent />
    </Suspense>
  );
}
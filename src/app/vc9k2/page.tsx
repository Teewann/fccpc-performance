"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────
type Overview = {
  totalStaff: number; totalDepts: number; logsThisMonth: number;
  approvedLogs: number; pendingLogs: number; totalTasks: number;
  completedTasks: number; pendingLeave: number;
  healthScore: number; logRate: number; approvalRate: number; taskRate: number;
};
type RevenueItem = {
  id: string; title: string; amount: number; source: string;
  reference: string | null; department: string | null;
  notes: string | null; status: string; evcComment: string | null;
  documentName: string | null;
  createdAt: string; reviewedAt: string | null;
  submittedBy?: { name: string; department: { name: string } | null };
};
type Revenue = {
  total: number; approved: number; pending: number;
  bySource: Record<string, number>;
  items: RevenueItem[]; pendingApprovals: RevenueItem[];
};
type Director = {
  id: string; name: string; email: string; department: string;
  deptLogs: number; approvedByDir: number; pendingForDir: number;
  tasksCreated: number; tasksCompleted: number;
};
type Annotation = {
  id: string; subject: string; content: string; priority: string; createdAt: string;
};
type Promotion = {
  id: string; name: string; department: string; role: string;
  approvalRate: number; avgScore: number; examPassed: boolean;
  perfScore: number; recommendation: string;
};
type VaultFile = {
  id: string; title: string; description: string | null;
  category: string; fileName: string; fileType: string;
  fileSize: number; isEncrypted: boolean; tags: string | null; createdAt: string;
};
type EVCTask = {
  id: string; title: string; description: string; priority: string;
  status: string; category: string; isConfidential: boolean;
  dueDate: string | null; completedAt: string | null; createdAt: string;
  documentName: string | null;
  assignedTo: { name: string; role: string; department: { name: string } | null };
};
type StaffForAssign = {
  id: string; name: string; role: string;
  department: { name: string } | null;
};
type Notification = {
  id: string; title: string; message: string; type: string;
  read: boolean; createdAt: string;
};

const REVENUE_SOURCES = [
  "Administrative Fine","Consent Order Settlement","Penalty — Competition Violation",
  "Penalty — Consumer Protection","Merger Filing Fee","Licence Fee",
  "Cost Recovery","Forfeiture","Other",
];
const VAULT_CATEGORIES = [
  "Strategic","Financial","Legal","Personal","Classified","Confidential","Reference","Other",
];
const TASK_CATEGORIES = [
  "Enforcement Action","Investigation Order","Policy Directive",
  "Inspection Order","Strategic Initiative","Compliance Review",
  "Special Assignment","General",
];

function formatNGN(amount: number) {
  if (amount >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000)     return `₦${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000)         return `₦${(amount / 1_000).toFixed(0)}K`;
  return `₦${amount.toLocaleString()}`;
}
function formatFileSize(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

const EVC_SUITE_PASSWORD = "FCCPC@EVC2026";

// ─── Main Component ───────────────────────────────────────────────────
export default function EVCSuitePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  useEffect(() => {
    if (status === "authenticated" && role !== "EXECUTIVE") {
      router.replace("/dashboard");
    }
  }, [status, role, router]);

  // ── Gate 2: second password ──────────────────────────────────────
  // FIX 1: passInput is NEVER stored in localStorage or any persistent state.
  // It resets to "" on every unlock, lock, and page mount.
  const [unlocked,     setUnlocked]     = useState(false);
  const [passInput,    setPassInput]    = useState("");
  const [passError,    setPassError]    = useState("");
  const [passAttempts, setPassAttempts] = useState(0);
  const [lockedOut,    setLockedOut]    = useState(false);

  // Always clear password field on mount and on lock/unlock transitions
  useEffect(() => {
    setPassInput("");
    setPassError("");
  }, [unlocked]);

  // ── Auto-lock timer ──────────────────────────────────────────────
  const lockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => {
      setUnlocked(false);
      setPassInput(""); // clear on auto-lock too
    }, 15 * 60 * 1000);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    const events = ["mousedown", "keydown", "scroll"];
    const handler = () => resetLockTimer();
    events.forEach((e) => window.addEventListener(e, handler));
    resetLockTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, [unlocked, resetLockTimer]);

  // ── Data state ───────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState("overview");
  const [overview,      setOverview]      = useState<Overview | null>(null);
  const [revenue,       setRevenue]       = useState<Revenue | null>(null);
  const [directors,     setDirectors]     = useState<Director[]>([]);
  const [annotations,   setAnnotations]   = useState<Annotation[]>([]);
  const [promotions,    setPromotions]    = useState<Promotion[]>([]);
  const [vaultFiles,    setVaultFiles]    = useState<VaultFile[]>([]);
  const [evcTasks,      setEvcTasks]      = useState<EVCTask[]>([]);
  const [staffList,     setStaffList]     = useState<StaffForAssign[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [msg,           setMsg]           = useState({ text: "", ok: true });

  // ── Filter state per tab ─────────────────────────────────────────
  // Tasks filters
  const [taskSearch,      setTaskSearch]      = useState("");
  const [taskStatusFilter,setTaskStatusFilter]= useState("ALL");
  const [taskPriorityFilter,setTaskPriorityFilter] = useState("ALL");
  const [taskCategoryFilter,setTaskCategoryFilter] = useState("ALL");
  const [taskDateFrom,    setTaskDateFrom]    = useState("");
  const [taskDateTo,      setTaskDateTo]      = useState("");

  // Revenue filters
  const [revSearch,       setRevSearch]       = useState("");
  const [revSourceFilter, setRevSourceFilter] = useState("ALL");
  const [revStatusFilter, setRevStatusFilter] = useState("ALL");
  const [revDateFrom,     setRevDateFrom]     = useState("");
  const [revDateTo,       setRevDateTo]       = useState("");

  // Directors filters
  const [dirSearch,       setDirSearch]       = useState("");
  const [dirSortBy,       setDirSortBy]       = useState("score");

  // Vault filters
  const [vaultSearch,     setVaultSearch]     = useState("");
  const [vaultCatFilter,  setVaultCatFilter]  = useState("ALL");
  const [vaultEncFilter,  setVaultEncFilter]  = useState("ALL");

  // Promotions filters
  const [promoSearch,     setPromoSearch]     = useState("");
  const [promoRecFilter,  setPromoRecFilter]  = useState("ALL");
  const [promoDeptFilter, setPromoDeptFilter] = useState("ALL");

  // Notes filters
  const [noteSearch,      setNoteSearch]      = useState("");
  const [notePrioFilter,  setNotePrioFilter]  = useState("ALL");

  // ── Forms ────────────────────────────────────────────────────────
  const [showRevForm,  setShowRevForm]  = useState(false);
  const [showVault,    setShowVault]    = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  const [revForm, setRevForm] = useState({
    title: "", amount: "", source: REVENUE_SOURCES[0],
    reference: "", department: "", notes: "",
  });
  const [revFile, setRevFile] = useState<File | null>(null);

  const [vaultForm, setVaultForm] = useState({
    title: "", description: "", category: VAULT_CATEGORIES[0],
    tags: "", isEncrypted: false,
  });
  const [vaultFile, setVaultFile] = useState<File | null>(null);

  // FIX 2: Task form now includes taskFile for document attachment
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", assignedToId: "",
    priority: "HIGH", category: TASK_CATEGORIES[0],
    dueDate: "", isConfidential: false, notes: "",
  });
  const [taskFile, setTaskFile] = useState<File | null>(null);
  const taskFileRef = useRef<HTMLInputElement>(null);

  const [noteForm, setNoteForm] = useState({ subject: "", content: "", priority: "NORMAL" });

  const [approvalMsg,           setApprovalMsg]           = useState<Record<string, string>>({});
  const [approvalConfirm,       setApprovalConfirm]       = useState<string | null>(null);
  const [approvalPassInput,     setApprovalPassInput]     = useState("");
  const [pendingApprovalAction, setPendingApprovalAction] = useState<string | null>(null);
  const [downloadPass,          setDownloadPass]          = useState("");
  const [downloadTarget,        setDownloadTarget]        = useState<VaultFile | null>(null);

  // ── Styles ───────────────────────────────────────────────────────
  const bg     = "#080a10";
  const card   = "#0d1017";
  const border = "#1a1f2e";
  const text1  = "#f0f2f8";
  const text2  = "#6b7890";
  const gold   = "#f59e0b";
  const green  = "#22c55e";
  const red    = "#ef4444";
  const blue   = "#3b82f6";

  const inp: React.CSSProperties = {
    width: "100%", background: "#0a0c14",
    border: `0.5px solid ${border}`, borderRadius: 10,
    padding: "12px 14px", fontSize: 15, color: text1,
    outline: "none", boxSizing: "border-box", marginBottom: 14,
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 13, fontWeight: 600,
    color: text2, marginBottom: 7,
  };
  const filterInp: React.CSSProperties = {
    background: "#0a0c14", border: `0.5px solid ${border}`,
    borderRadius: 9, padding: "9px 13px", fontSize: 13,
    color: text1, outline: "none",
  };

  // ── Fetch ────────────────────────────────────────────────────────
  const fetchSection = useCallback(async (section: string) => {
    setLoading(true);
    try {
      if (section === "overview" || section === "revenue") {
        const res = await fetch("/api/vc9k2?section=overview");
        const data = await res.json();
        if (res.ok) { setOverview(data.overview); setRevenue(data.revenue); }
      }
      if (section === "directors") {
        const res = await fetch("/api/vc9k2?section=directors");
        const data = await res.json();
        if (res.ok) setDirectors(data.directors || []);
      }
      if (section === "annotations") {
        const res = await fetch("/api/vc9k2?section=annotations");
        const data = await res.json();
        if (res.ok) setAnnotations(data.notes || []);
      }
      if (section === "promotions") {
        const res = await fetch("/api/vc9k2?section=promotions");
        const data = await res.json();
        if (res.ok) setPromotions(data.recommendations || []);
      }
      if (section === "vault") {
        const res = await fetch("/api/evc-vault");
        const data = await res.json();
        if (res.ok) setVaultFiles(data.files || []);
      }
      if (section === "tasks") {
        const res = await fetch("/api/evc-tasks");
        const data = await res.json();
        if (res.ok) { setEvcTasks(data.tasks || []); setStaffList(data.allStaff || []); }
      }
      if (section === "notifications") {
        const res = await fetch("/api/notifications");
        const data = await res.json();
        if (res.ok) setNotifications(data.notifications || []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (unlocked) fetchSection("overview");
  }, [unlocked, fetchSection]);

  function switchTab(tab: string) {
    setActiveTab(tab);
    setMsg({ text: "", ok: true });
    fetchSection(tab);
  }

  // ── Password gate handler ─────────────────────────────────────────
  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (lockedOut) return;
    if (passInput === EVC_SUITE_PASSWORD) {
      setUnlocked(true);
      // FIX 1: clear immediately on success — useEffect above also does this
      setPassInput("");
      setPassError("");
      setPassAttempts(0);
    } else {
      const att = passAttempts + 1;
      setPassAttempts(att);
      setPassInput(""); // clear on wrong attempt too
      if (att >= 3) {
        setLockedOut(true);
        setPassError("Access locked for 30 seconds. Too many incorrect attempts.");
        setTimeout(() => { setLockedOut(false); setPassAttempts(0); setPassError(""); }, 30000);
      } else {
        setPassError(`Incorrect code. ${3 - att} attempt${3 - att !== 1 ? "s" : ""} remaining.`);
      }
    }
  }

  function handleLock() {
    setUnlocked(false);
    setPassInput(""); // FIX 1: always clear on manual lock
    setPassError("");
    setPassAttempts(0);
  }

  // ── Revenue submit ────────────────────────────────────────────────
  async function handleRevSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setMsg({ text: "", ok: true });
    try {
      const fd = new FormData();
      Object.entries(revForm).forEach(([k, v]) => fd.append(k, v));
      fd.append("type", "revenue");
      if (revFile) fd.append("document", revFile);
      const res  = await fetch("/api/vc9k2", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "Revenue item recorded successfully.", ok: true });
        setRevForm({ title: "", amount: "", source: REVENUE_SOURCES[0], reference: "", department: "", notes: "" });
        setRevFile(null); setShowRevForm(false); fetchSection("revenue");
      } else { setMsg({ text: data.error || "Failed.", ok: false }); }
    } finally { setSubmitting(false); }
  }

  // ── Vault upload ──────────────────────────────────────────────────
  async function handleVaultUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!vaultFile) { setMsg({ text: "Please select a file.", ok: false }); return; }
    setSubmitting(true); setMsg({ text: "", ok: true });
    try {
      const fd = new FormData();
      fd.append("file",        vaultFile);
      fd.append("title",       vaultForm.title);
      fd.append("description", vaultForm.description);
      fd.append("category",    vaultForm.category);
      fd.append("tags",        vaultForm.tags);
      fd.append("isEncrypted", String(vaultForm.isEncrypted));
      const res  = await fetch("/api/evc-vault", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "File saved to vault.", ok: true });
        setVaultForm({ title: "", description: "", category: VAULT_CATEGORIES[0], tags: "", isEncrypted: false });
        setVaultFile(null); setShowVault(false); fetchSection("vault");
      } else { setMsg({ text: data.error || "Upload failed.", ok: false }); }
    } finally { setSubmitting(false); }
  }

  function requestDownload(file: VaultFile) { setDownloadTarget(file); setDownloadPass(""); }

  async function handleDownload() {
    if (downloadPass !== EVC_SUITE_PASSWORD) {
      setMsg({ text: "Incorrect access code. Download cancelled.", ok: false });
      setDownloadTarget(null); setDownloadPass(""); return;
    }
    if (!downloadTarget) return;
    try {
      const res  = await fetch("/api/evc-vault", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: downloadTarget.id }),
      });
      const data = await res.json();
      if (res.ok) {
        const link = document.createElement("a");
        link.href = data.fileData; link.download = data.fileName; link.click();
      }
    } finally { setDownloadTarget(null); setDownloadPass(""); }
  }

  async function handleDeleteVault(fileId: string) {
    if (!confirm("Permanently delete this file from the vault?")) return;
    await fetch(`/api/evc-vault?id=${fileId}`, { method: "DELETE" });
    fetchSection("vault");
  }

  // FIX 2: Task submit — uses FormData to support file attachment
  async function handleTaskSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setMsg({ text: "", ok: true });
    try {
      const fd = new FormData();
      fd.append("title",          taskForm.title);
      fd.append("description",    taskForm.description);
      fd.append("assignedToId",   taskForm.assignedToId);
      fd.append("priority",       taskForm.priority);
      fd.append("category",       taskForm.category);
      fd.append("dueDate",        taskForm.dueDate);
      fd.append("isConfidential", String(taskForm.isConfidential));
      fd.append("notes",          taskForm.notes);
      if (taskFile) fd.append("document", taskFile);

      const res  = await fetch("/api/evc-tasks", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "Task assigned successfully.", ok: true });
        setTaskForm({ title: "", description: "", assignedToId: "", priority: "HIGH", category: TASK_CATEGORIES[0], dueDate: "", isConfidential: false, notes: "" });
        setTaskFile(null);
        if (taskFileRef.current) taskFileRef.current.value = "";
        setShowTaskForm(false); fetchSection("tasks");
      } else { setMsg({ text: data.error || "Failed.", ok: false }); }
    } finally { setSubmitting(false); }
  }

  async function handleNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("type",     "annotation");
      fd.append("subject",  noteForm.subject);
      fd.append("content",  noteForm.content);
      fd.append("priority", noteForm.priority);
      const res = await fetch("/api/vc9k2", { method: "POST", body: fd });
      if (res.ok) {
        setNoteForm({ subject: "", content: "", priority: "NORMAL" });
        setShowNoteForm(false); fetchSection("annotations");
      }
    } finally { setSubmitting(false); }
  }

  async function handleApproval(itemId: string, action: "approve" | "reject") {
    const res = await fetch("/api/vc9k2", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, action }),
    });
    if (res.ok) {
      setApprovalMsg((p) => ({ ...p, [itemId]: action === "approve" ? "Approved ✓" : "Rejected ✗" }));
      fetchSection("revenue");
    }
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  // ── FIX 3: Filtered data helpers ─────────────────────────────────
  const filteredTasks = evcTasks.filter((t) => {
    const q = taskSearch.toLowerCase();
    if (q && !t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q) && !t.assignedTo.name.toLowerCase().includes(q)) return false;
    if (taskStatusFilter   !== "ALL" && t.status   !== taskStatusFilter)   return false;
    if (taskPriorityFilter !== "ALL" && t.priority !== taskPriorityFilter)  return false;
    if (taskCategoryFilter !== "ALL" && t.category !== taskCategoryFilter)  return false;
    if (taskDateFrom && new Date(t.createdAt) < new Date(taskDateFrom))    return false;
    if (taskDateTo   && new Date(t.createdAt) > new Date(taskDateTo + "T23:59:59")) return false;
    return true;
  });

  const filteredRevItems = (revenue?.items || []).filter((item) => {
    const q = revSearch.toLowerCase();
    if (q && !item.title.toLowerCase().includes(q) && !(item.reference || "").toLowerCase().includes(q) && !(item.department || "").toLowerCase().includes(q)) return false;
    if (revSourceFilter !== "ALL" && item.source !== revSourceFilter) return false;
    if (revStatusFilter !== "ALL") {
      if (revStatusFilter === "PENDING"  && item.status !== "PENDING")           return false;
      if (revStatusFilter === "APPROVED" && item.status !== "APPROVED_BY_EVC")   return false;
      if (revStatusFilter === "REJECTED" && item.status !== "REJECTED_BY_EVC")   return false;
    }
    if (revDateFrom && new Date(item.createdAt) < new Date(revDateFrom))         return false;
    if (revDateTo   && new Date(item.createdAt) > new Date(revDateTo + "T23:59:59")) return false;
    return true;
  });

  const filteredDirectors = directors
    .filter((d) => {
      const q = dirSearch.toLowerCase();
      return !q || d.name.toLowerCase().includes(q) || d.department.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const score = (d: Director) => {
        const ap = d.deptLogs > 0 ? Math.round((d.approvedByDir / d.deptLogs) * 100) : 0;
        const tp = d.tasksCreated > 0 ? Math.round((d.tasksCompleted / d.tasksCreated) * 100) : 0;
        return Math.round((ap * 0.5) + (tp * 0.3) + (d.pendingForDir === 0 ? 20 : Math.max(0, 20 - d.pendingForDir * 2)));
      };
      if (dirSortBy === "score")    return score(b) - score(a);
      if (dirSortBy === "name")     return a.name.localeCompare(b.name);
      if (dirSortBy === "logs")     return b.deptLogs - a.deptLogs;
      if (dirSortBy === "pending")  return a.pendingForDir - b.pendingForDir;
      return 0;
    });

  const filteredVault = vaultFiles.filter((f) => {
    const q = vaultSearch.toLowerCase();
    if (q && !f.title.toLowerCase().includes(q) && !f.fileName.toLowerCase().includes(q) && !(f.tags || "").toLowerCase().includes(q)) return false;
    if (vaultCatFilter !== "ALL" && f.category !== vaultCatFilter) return false;
    if (vaultEncFilter === "ENCRYPTED" && !f.isEncrypted)          return false;
    if (vaultEncFilter === "STANDARD"  && f.isEncrypted)           return false;
    return true;
  });

  const uniquePromoDepts = Array.from(new Set(promotions.map((p) => p.department)));
  const filteredPromos = promotions.filter((p) => {
    const q = promoSearch.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !p.department.toLowerCase().includes(q)) return false;
    if (promoDeptFilter !== "ALL" && p.department !== promoDeptFilter) return false;
    if (promoRecFilter  !== "ALL" && !p.recommendation.includes(promoRecFilter)) return false;
    return true;
  });

  const filteredNotes = annotations.filter((n) => {
    const q = noteSearch.toLowerCase();
    if (q && !n.subject.toLowerCase().includes(q) && !n.content.toLowerCase().includes(q)) return false;
    if (notePrioFilter !== "ALL" && n.priority !== notePrioFilter) return false;
    return true;
  });

  // ── Loading guard ─────────────────────────────────────────────────
  if (status === "loading" || (status === "authenticated" && role !== "EXECUTIVE")) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 14, color: text2 }}>Loading...</div>
      </div>
    );
  }

  // ── Password gate ─────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(circle at 30% 40%, rgba(245,158,11,0.04) 0%, transparent 60%), radial-gradient(circle at 70% 60%, rgba(34,197,94,0.03) 0%, transparent 60%)", pointerEvents: "none" }} />
        <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 88, height: 88, borderRadius: 22, background: "#0d1017", border: `2px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px", fontSize: 40 }}>🔐</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: gold, letterSpacing: "-0.02em", marginBottom: 8 }}>FCCPC Command Suite</div>
            <div style={{ fontSize: 14, color: text2, lineHeight: 1.6 }}>Executive Vice Chairman — Private Access<br />Enter your personal access code to continue</div>
          </div>
          <div style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 20, padding: "36px 32px" }}>
            <form onSubmit={handleUnlock}>
              <label style={{ ...lbl, textAlign: "center", display: "block", marginBottom: 14, fontSize: 14 }}>Private access code</label>
              {/* FIX 1: autoComplete="off" + no defaultValue — never remembers the password */}
              <input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder="••••••••••••••"
                disabled={lockedOut}
                required
                autoFocus
                autoComplete="new-password"
                style={{ ...inp, textAlign: "center", fontSize: 22, letterSpacing: "0.4em", marginBottom: 10 }}
              />
              {passError && (
                <div style={{ fontSize: 13, color: "#f87171", textAlign: "center", marginBottom: 16, padding: "10px 14px", background: "#1f0707", borderRadius: 10, border: "0.5px solid #7f1d1d" }}>
                  {passError}
                </div>
              )}
              <button
                type="submit" disabled={lockedOut}
                style={{ width: "100%", padding: 15, borderRadius: 12, border: `1.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 15, fontWeight: 700, cursor: lockedOut ? "not-allowed" : "pointer", opacity: lockedOut ? 0.5 : 1, letterSpacing: "0.06em" }}
              >
                {lockedOut ? "⛔ ACCESS LOCKED — WAIT 30s" : "ENTER COMMAND SUITE →"}
              </button>
            </form>
            <div style={{ marginTop: 20, padding: "12px 14px", background: "#0a0c14", borderRadius: 10, border: `0.5px solid ${border}` }}>
              <div style={{ fontSize: 12, color: text2, lineHeight: 1.7 }}>
                🔒 This access is logged and monitored<br />
                🛡 3 incorrect attempts locks access for 30 seconds<br />
                ⏱ Suite auto-locks after 15 minutes of inactivity
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <a href="/dashboard" style={{ fontSize: 13, color: text2, textDecoration: "none" }}>← Back to my dashboard</a>
          </div>
        </div>
      </div>
    );
  }

  // ── Download password modal ───────────────────────────────────────
  if (downloadTarget) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: card, border: `1.5px solid ${gold}`, borderRadius: 18, padding: 36, width: "100%", maxWidth: 420 }}>
          <div style={{ fontSize: 36, textAlign: "center", marginBottom: 16 }}>🔐</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: gold, textAlign: "center", marginBottom: 8 }}>Download confirmation</div>
          <div style={{ fontSize: 14, color: text2, textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>
            Enter your access code to download<br /><strong style={{ color: text1 }}>{downloadTarget.title}</strong>
          </div>
          <input
            type="password" value={downloadPass}
            onChange={(e) => setDownloadPass(e.target.value)}
            placeholder="Enter access code..."
            autoFocus autoComplete="new-password"
            style={{ ...inp, textAlign: "center", fontSize: 18, letterSpacing: "0.3em" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button onClick={() => { setDownloadTarget(null); setDownloadPass(""); }} style={{ padding: 12, borderRadius: 10, border: `0.5px solid ${border}`, background: "#0a0c14", color: text2, fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleDownload} style={{ padding: 12, borderRadius: 10, border: `1.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Confirm download</button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN SUITE ────────────────────────────────────────────────────
  const TABS = [
    { id: "overview",      label: "Overview",       icon: "🏛"  },
    { id: "revenue",       label: "Revenue",        icon: "💰"  },
    { id: "tasks",         label: "EVC Tasks",      icon: "📌"  },
    { id: "vault",         label: "Private Vault",  icon: "🗄"   },
    { id: "directors",     label: "Directors",      icon: "👔"  },
    { id: "promotions",    label: "Promotions",     icon: "🎓"  },
    { id: "notifications", label: "Notifications",  icon: "🔔"  },
    { id: "annotations",   label: "Private Notes",  icon: "🔒"  },
  ];
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Shared filter bar component ───────────────────────────────────
  const FilterBar = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20, padding: "14px 18px", background: card, border: `0.5px solid ${border}`, borderRadius: 12 }}>
      {children}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text1, fontFamily: "system-ui, sans-serif" }}>

      {/* ── Top header ───────────────────────────────────────────── */}
      <div style={{ background: card, borderBottom: `0.5px solid ${border}`, padding: "16px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#1c1107", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏛</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: gold }}>FCCPC Command Suite</div>
            <div style={{ fontSize: 12, color: text2 }}>Executive Vice Chairman · Confidential</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 13, color: text2 }}>{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</div>
          {overview && (
            <div style={{ padding: "6px 16px", borderRadius: 8, background: overview.healthScore >= 75 ? "#052e16" : "#1c1107", border: `0.5px solid ${overview.healthScore >= 75 ? green : gold}`, color: overview.healthScore >= 75 ? green : gold, fontSize: 13, fontWeight: 600 }}>
              Commission: {overview.healthScore}/100
            </div>
          )}
          {/* FIX 1: Lock button calls handleLock which always clears passInput */}
          <button onClick={handleLock} style={{ padding: "8px 18px", borderRadius: 8, border: `0.5px solid #7f1d1d`, background: "#1f0707", color: "#f87171", fontSize: 13, cursor: "pointer" }}>🔒 Lock</button>
          <a href="/dashboard" style={{ padding: "8px 18px", borderRadius: 8, border: `0.5px solid ${border}`, background: "#0d1017", color: text2, fontSize: 13, textDecoration: "none" }}>← Back to System</a>
        </div>
      </div>

      {/* ── Health bar ───────────────────────────────────────────── */}
      {overview && (
        <div style={{ background: "#0d1017", borderBottom: `0.5px solid ${border}`, padding: "14px 28px", display: "flex", gap: 36, alignItems: "center", overflowX: "auto" }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: overview.healthScore >= 75 ? green : overview.healthScore >= 55 ? gold : red, letterSpacing: "-0.04em", lineHeight: 1 }}>{overview.healthScore}</div>
            <div style={{ fontSize: 10, color: text2, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4, fontWeight: 600 }}>Health</div>
          </div>
          <div style={{ width: "0.5px", height: 44, background: border, flexShrink: 0 }} />
          {[
            { label: "Log rate",    value: `${overview.logRate}%`,       color: overview.logRate >= 70 ? green : gold     },
            { label: "Approvals",   value: `${overview.approvalRate}%`,  color: overview.approvalRate >= 70 ? green : gold },
            { label: "Tasks done",  value: `${overview.taskRate}%`,      color: overview.taskRate >= 70 ? green : gold     },
            { label: "Staff",       value: String(overview.totalStaff),  color: text1 },
            { label: "Pending",     value: String(overview.pendingLogs), color: overview.pendingLogs > 10 ? red : gold },
            { label: "Leave req.",  value: String(overview.pendingLeave),color: text1 },
          ].map((m) => (
            <div key={m.label} style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 10, color: text2, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex" }}>

        {/* ── Side nav ─────────────────────────────────────────── */}
        <div style={{ width: 210, borderRight: `0.5px solid ${border}`, minHeight: "calc(100vh - 130px)", padding: "16px 10px", flexShrink: 0 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => switchTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", borderRadius: 10, marginBottom: 4, fontSize: 14, fontWeight: activeTab === t.id ? 600 : 400, border: `0.5px solid ${activeTab === t.id ? gold : "transparent"}`, background: activeTab === t.id ? "#1c1107" : "transparent", color: activeTab === t.id ? gold : text2, cursor: "pointer", textAlign: "left", position: "relative" }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label}
              {t.id === "notifications" && unreadCount > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: red, color: "#fff" }}>{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Main content ─────────────────────────────────────── */}
        <div style={{ flex: 1, padding: "28px 32px", overflowX: "hidden" }}>

          {msg.text && (
            <div style={{ background: msg.ok ? "#052e16" : "#1f0707", border: `0.5px solid ${msg.ok ? "#14532d" : "#7f1d1d"}`, color: msg.ok ? green : red, borderRadius: 10, padding: "12px 18px", fontSize: 14, marginBottom: 20 }}>
              {msg.text}
            </div>
          )}

          {loading && <div style={{ textAlign: "center", padding: 56, color: text2 }}>Loading data...</div>}

          {/* ════════════ OVERVIEW TAB ════════════ */}
          {!loading && activeTab === "overview" && overview && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: text1, marginBottom: 6 }}>Commission Overview</h2>
              <p style={{ fontSize: 14, color: text2, marginBottom: 28 }}>Live intelligence · Private to EVC · {new Date().toLocaleTimeString("en-GB")}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
                {[
                  { label: "Departments",       value: overview.totalDepts,     color: blue  },
                  { label: "Active staff",       value: overview.totalStaff,     color: green },
                  { label: "Logs this month",    value: overview.logsThisMonth,  color: text1 },
                  { label: "Approved logs",      value: overview.approvedLogs,   color: green },
                  { label: "Awaiting review",    value: overview.pendingLogs,    color: gold  },
                  { label: "Total tasks",        value: overview.totalTasks,     color: text1 },
                  { label: "Tasks completed",    value: overview.completedTasks, color: green },
                  { label: "Pending leave req.", value: overview.pendingLeave,   color: gold  },
                ].map((s) => (
                  <div key={s.label} style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 14, padding: "18px 20px" }}>
                    <div style={{ fontSize: 34, fontWeight: 800, color: s.color, letterSpacing: "-0.03em" }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: text2, marginTop: 6, fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 14, padding: 26 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: text1, marginBottom: 20 }}>Performance indicators</div>
                {[
                  { label: "Log submission rate",  value: overview.logRate,      threshold: 70 },
                  { label: "Log approval rate",    value: overview.approvalRate, threshold: 70 },
                  { label: "Task completion rate", value: overview.taskRate,     threshold: 70 },
                ].map((m) => (
                  <div key={m.label} style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 14, color: text2 }}>{m.label}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: m.value >= m.threshold ? green : m.value >= 50 ? gold : red }}>{m.value}%</span>
                    </div>
                    <div style={{ height: 6, background: "#1a1f2e", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, width: `${m.value}%`, background: m.value >= m.threshold ? green : m.value >= 50 ? gold : red }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════ REVENUE TAB ════════════ */}
          {!loading && activeTab === "revenue" && revenue && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, color: text1, marginBottom: 6 }}>Revenue Intelligence</h2>
                  <p style={{ fontSize: 14, color: text2 }}>Financial data · EVC eyes only · Strictly confidential</p>
                </div>
                <button onClick={() => setShowRevForm(!showRevForm)} style={{ padding: "10px 22px", borderRadius: 10, border: `1.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {showRevForm ? "Cancel" : "+ Record revenue"}
                </button>
              </div>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
                {[
                  { label: "Total revenue",    value: formatNGN(revenue.total),    color: green, desc: "All records" },
                  { label: "EVC approved",     value: formatNGN(revenue.approved), color: blue,  desc: "Cleared for processing" },
                  { label: "Awaiting approval",value: formatNGN(revenue.pending),  color: gold,  desc: `${revenue.pendingApprovals.length} item(s)` },
                ].map((s) => (
                  <div key={s.label} style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 14, padding: "22px 24px" }}>
                    <div style={{ fontSize: 34, fontWeight: 800, color: s.color, letterSpacing: "-0.03em", marginBottom: 6 }}>{s.value}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: text1, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: text2 }}>{s.desc}</div>
                  </div>
                ))}
              </div>

              {/* Revenue form */}
              {showRevForm && (
                <div style={{ background: card, border: `0.5px solid ${gold}`, borderRadius: 14, padding: 28, marginBottom: 24 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: gold, marginBottom: 20, paddingBottom: 14, borderBottom: `0.5px solid ${border}` }}>Record new revenue item</div>
                  <form onSubmit={handleRevSubmit}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Title / description *</label>
                        <input style={inp} value={revForm.title} onChange={(e) => setRevForm({ ...revForm, title: e.target.value })} placeholder="e.g. Administrative fine — Company X" required />
                      </div>
                      <div>
                        <label style={lbl}>Amount (₦) *</label>
                        <input style={inp} type="number" value={revForm.amount} onChange={(e) => setRevForm({ ...revForm, amount: e.target.value })} placeholder="e.g. 50000000" required />
                      </div>
                      <div>
                        <label style={lbl}>Revenue source *</label>
                        <select style={inp} value={revForm.source} onChange={(e) => setRevForm({ ...revForm, source: e.target.value })}>
                          {REVENUE_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Case / reference number</label>
                        <input style={inp} value={revForm.reference} onChange={(e) => setRevForm({ ...revForm, reference: e.target.value })} placeholder="e.g. S&I-2026-0142" />
                      </div>
                      <div>
                        <label style={lbl}>Department responsible</label>
                        <input style={inp} value={revForm.department} onChange={(e) => setRevForm({ ...revForm, department: e.target.value })} placeholder="e.g. Surveillance & Investigation" />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Supporting document (optional)</label>
                        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(e) => setRevFile(e.target.files?.[0] || null)} style={{ ...inp, padding: "10px 14px" }} />
                        {revFile && <div style={{ fontSize: 12, color: green, marginTop: -10, marginBottom: 10 }}>Selected: {revFile.name} ({formatFileSize(revFile.size)})</div>}
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Confidential notes</label>
                        <textarea style={{ ...inp, resize: "none", minHeight: 70 } as any} value={revForm.notes} onChange={(e) => setRevForm({ ...revForm, notes: e.target.value })} placeholder="Additional context..." />
                      </div>
                    </div>
                    <button type="submit" disabled={submitting} style={{ padding: "12px 28px", borderRadius: 10, border: `1.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>
                      {submitting ? "Recording..." : "Record revenue"}
                    </button>
                  </form>
                </div>
              )}

              {/* FIX 3: Revenue filter bar */}
              <FilterBar>
                <input style={{ ...filterInp, minWidth: 200 }} placeholder="🔍 Search title, reference, dept..." value={revSearch} onChange={(e) => setRevSearch(e.target.value)} />
                <select style={filterInp} value={revSourceFilter} onChange={(e) => setRevSourceFilter(e.target.value)}>
                  <option value="ALL">All sources</option>
                  {REVENUE_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select style={filterInp} value={revStatusFilter} onChange={(e) => setRevStatusFilter(e.target.value)}>
                  <option value="ALL">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <input type="date" style={filterInp} value={revDateFrom} onChange={(e) => setRevDateFrom(e.target.value)} title="From date" />
                <span style={{ color: text2, fontSize: 12 }}>to</span>
                <input type="date" style={filterInp} value={revDateTo} onChange={(e) => setRevDateTo(e.target.value)} title="To date" />
                {(revSearch || revSourceFilter !== "ALL" || revStatusFilter !== "ALL" || revDateFrom || revDateTo) && (
                  <button onClick={() => { setRevSearch(""); setRevSourceFilter("ALL"); setRevStatusFilter("ALL"); setRevDateFrom(""); setRevDateTo(""); }} style={{ padding: "8px 14px", borderRadius: 8, border: `0.5px solid #7f1d1d`, background: "#1f0707", color: "#f87171", fontSize: 12, cursor: "pointer" }}>✕ Clear</button>
                )}
                <span style={{ marginLeft: "auto", fontSize: 12, color: text2 }}>{filteredRevItems.length} of {revenue.items.length}</span>
              </FilterBar>

              {/* Pending approvals */}
              {revenue.pendingApprovals.length > 0 && (
                <div style={{ background: card, border: `0.5px solid ${gold}`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: gold, marginBottom: 20 }}>⚡ {revenue.pendingApprovals.length} item(s) awaiting your approval</div>
                  {revenue.pendingApprovals.map((item) => (
                    <div key={item.id} style={{ background: "#0a0c14", border: `0.5px solid ${border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: text1, marginBottom: 4 }}>{item.title}</div>
                          <div style={{ fontSize: 13, color: text2 }}>{item.source}{item.reference && ` · Ref: ${item.reference}`}{item.department && ` · ${item.department}`}</div>
                          {item.documentName && <div style={{ fontSize: 12, color: blue, marginTop: 4 }}>📎 {item.documentName}</div>}
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 800, color: gold, letterSpacing: "-0.03em", flexShrink: 0, marginLeft: 16 }}>{formatNGN(item.amount)}</div>
                      </div>
                      {approvalMsg[item.id] ? (
                        <div style={{ fontSize: 14, fontWeight: 600, color: approvalMsg[item.id].includes("Approved") ? green : red }}>{approvalMsg[item.id]}</div>
                      ) : approvalConfirm === item.id ? (
                        <div>
                          <input type="password" value={approvalPassInput} onChange={(e) => setApprovalPassInput(e.target.value)} placeholder="Enter access code to confirm..." autoComplete="new-password" style={{ ...inp, marginBottom: 8 }} />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={async () => {
                              if (approvalPassInput !== EVC_SUITE_PASSWORD) {
                                setMsg({ text: "Incorrect code. Action cancelled.", ok: false });
                                setApprovalConfirm(null); setApprovalPassInput(""); return;
                              }
                              await handleApproval(item.id, pendingApprovalAction as "approve" | "reject");
                              setApprovalConfirm(null); setApprovalPassInput("");
                            }} style={{ padding: "9px 22px", borderRadius: 9, border: `0.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Confirm</button>
                            <button onClick={() => { setApprovalConfirm(null); setApprovalPassInput(""); }} style={{ padding: "9px 16px", borderRadius: 9, border: `0.5px solid ${border}`, background: "#0a0c14", color: text2, fontSize: 14, cursor: "pointer" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => { setApprovalConfirm(item.id); setPendingApprovalAction("approve"); }} style={{ padding: "9px 22px", borderRadius: 9, border: `0.5px solid #14532d`, background: "#052e16", color: green, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>✓ Approve</button>
                          <button onClick={() => { setApprovalConfirm(item.id); setPendingApprovalAction("reject"); }} style={{ padding: "9px 22px", borderRadius: 9, border: `0.5px solid #7f1d1d`, background: "#1f0707", color: red, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>✗ Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Revenue history (filtered) */}
              {filteredRevItems.length > 0 ? (
                <div style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: text1, marginBottom: 20 }}>Revenue history ({filteredRevItems.length})</div>
                  {filteredRevItems.map((item) => {
                    const sc = item.status === "APPROVED_BY_EVC" ? green : item.status === "REJECTED_BY_EVC" ? red : gold;
                    const sl = item.status === "APPROVED_BY_EVC" ? "Approved" : item.status === "REJECTED_BY_EVC" ? "Rejected" : "Pending";
                    return (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: `0.5px solid ${border}` }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: text1, marginBottom: 3 }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: text2 }}>{item.source} · {new Date(item.createdAt).toLocaleDateString("en-GB")}{item.reference && ` · ${item.reference}`}</div>
                          {item.documentName && <div style={{ fontSize: 11, color: blue, marginTop: 3 }}>📎 {item.documentName}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: text1 }}>{formatNGN(item.amount)}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: sc, marginTop: 3 }}>{sl}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 32, color: text2, fontSize: 14 }}>No revenue records match the current filters.</div>
              )}
            </div>
          )}

          {/* ════════════ TASKS TAB ════════════ */}
          {!loading && activeTab === "tasks" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, color: text1, marginBottom: 6 }}>EVC Task Assignment</h2>
                  <p style={{ fontSize: 14, color: text2 }}>Assign directives to any staff, Director, HR or department</p>
                </div>
                <button onClick={() => setShowTaskForm(!showTaskForm)} style={{ padding: "10px 22px", borderRadius: 10, border: `1.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {showTaskForm ? "Cancel" : "+ Assign task"}
                </button>
              </div>

              {/* FIX 2: Task form with document attachment */}
              {showTaskForm && (
                <div style={{ background: card, border: `0.5px solid ${gold}`, borderRadius: 14, padding: 28, marginBottom: 24 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: gold, marginBottom: 20, paddingBottom: 14, borderBottom: `0.5px solid ${border}` }}>New directive</div>
                  <form onSubmit={handleTaskSubmit}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Task title *</label>
                        <input style={inp} value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="e.g. Conduct enforcement action at XYZ Ltd" required />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Full directive / description *</label>
                        <textarea style={{ ...inp, resize: "none", minHeight: 100 } as any} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Full instructions, location, organisations, expected outcome..." required />
                      </div>
                      <div>
                        <label style={lbl}>Assign to *</label>
                        <select style={inp} value={taskForm.assignedToId} onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })} required>
                          <option value="">Select person...</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} — {s.role.charAt(0) + s.role.slice(1).toLowerCase()}{s.department ? ` (${s.department.name})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Category</label>
                        <select style={inp} value={taskForm.category} onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}>
                          {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Priority</label>
                        <select style={inp} value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="CRITICAL">Critical — Urgent</option>
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Due date</label>
                        <input style={inp} type="date" value={taskForm.dueDate} min={new Date().toISOString().split("T")[0]} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
                      </div>
                      {/* FIX 2: Document attachment field */}
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Attach document (optional — PDF, Word, Excel, image)</label>
                        <input
                          ref={taskFileRef}
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                          onChange={(e) => setTaskFile(e.target.files?.[0] || null)}
                          style={{ ...inp, padding: "10px 14px" }}
                        />
                        {taskFile && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: -10, marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: green }}>📎 {taskFile.name} ({formatFileSize(taskFile.size)})</span>
                            <button type="button" onClick={() => { setTaskFile(null); if (taskFileRef.current) taskFileRef.current.value = ""; }} style={{ background: "none", border: "none", color: red, cursor: "pointer", fontSize: 13 }}>✕ Remove</button>
                          </div>
                        )}
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Additional notes for assignee</label>
                        <textarea style={{ ...inp, resize: "none", minHeight: 60 } as any} value={taskForm.notes} onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })} placeholder="Any extra context..." />
                      </div>
                      <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12 }}>
                        <input type="checkbox" id="confidential" checked={taskForm.isConfidential} onChange={(e) => setTaskForm({ ...taskForm, isConfidential: e.target.checked })} style={{ width: 18, height: 18, accentColor: gold, cursor: "pointer" }} />
                        <label htmlFor="confidential" style={{ fontSize: 14, color: text2, cursor: "pointer" }}>
                          Mark as confidential — recipient will be told this task is from EVC and is strictly confidential
                        </label>
                      </div>
                    </div>
                    <button type="submit" disabled={submitting} style={{ marginTop: 8, padding: "12px 28px", borderRadius: 10, border: `1.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>
                      {submitting ? "Assigning..." : "Assign task"}
                    </button>
                  </form>
                </div>
              )}

              {/* FIX 3: Tasks filter bar */}
              <FilterBar>
                <input style={{ ...filterInp, minWidth: 200 }} placeholder="🔍 Search title, description, person..." value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
                <select style={filterInp} value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value)}>
                  <option value="ALL">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <select style={filterInp} value={taskPriorityFilter} onChange={(e) => setTaskPriorityFilter(e.target.value)}>
                  <option value="ALL">All priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
                <select style={filterInp} value={taskCategoryFilter} onChange={(e) => setTaskCategoryFilter(e.target.value)}>
                  <option value="ALL">All categories</option>
                  {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="date" style={filterInp} value={taskDateFrom} onChange={(e) => setTaskDateFrom(e.target.value)} title="Assigned from" />
                <span style={{ color: text2, fontSize: 12 }}>to</span>
                <input type="date" style={filterInp} value={taskDateTo} onChange={(e) => setTaskDateTo(e.target.value)} title="Assigned to" />
                {(taskSearch || taskStatusFilter !== "ALL" || taskPriorityFilter !== "ALL" || taskCategoryFilter !== "ALL" || taskDateFrom || taskDateTo) && (
                  <button onClick={() => { setTaskSearch(""); setTaskStatusFilter("ALL"); setTaskPriorityFilter("ALL"); setTaskCategoryFilter("ALL"); setTaskDateFrom(""); setTaskDateTo(""); }} style={{ padding: "8px 14px", borderRadius: 8, border: `0.5px solid #7f1d1d`, background: "#1f0707", color: "#f87171", fontSize: 12, cursor: "pointer" }}>✕ Clear</button>
                )}
                <span style={{ marginLeft: "auto", fontSize: 12, color: text2 }}>{filteredTasks.length} of {evcTasks.length}</span>
              </FilterBar>

              {filteredTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: 56, color: text2 }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>📌</div>
                  <div style={{ fontSize: 16, color: text1, marginBottom: 8 }}>{evcTasks.length === 0 ? "No tasks assigned yet" : "No tasks match your filters"}</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredTasks.map((task) => {
                    const prColor = task.priority === "CRITICAL" ? red : task.priority === "HIGH" ? gold : task.priority === "MEDIUM" ? blue : green;
                    const stColor = task.status === "COMPLETED" ? green : task.status === "IN_PROGRESS" ? blue : task.status === "CANCELLED" ? text2 : gold;
                    return (
                      <div key={task.id} style={{ background: card, border: `0.5px solid ${border}`, borderLeft: `3px solid ${prColor}`, borderRadius: 14, padding: "20px 24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                              <div style={{ fontSize: 16, fontWeight: 600, color: text1 }}>{task.title}</div>
                              {task.isConfidential && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "#1f0707", color: red, border: `0.5px solid #7f1d1d` }}>🔒 Confidential</span>}
                              {task.documentName && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "#0c1a2e", color: blue, border: `0.5px solid #1e3a5f` }}>📎 {task.documentName}</span>}
                            </div>
                            <div style={{ fontSize: 13, color: text2 }}>{task.assignedTo.name} — {task.assignedTo.role}{task.assignedTo.department ? ` · ${task.assignedTo.department.name}` : ""}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: `${prColor}22`, color: prColor, border: `0.5px solid ${prColor}44` }}>{task.priority}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, color: stColor, background: `${stColor}22`, border: `0.5px solid ${stColor}44` }}>{task.status}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 14, color: text2, lineHeight: 1.5, marginBottom: 10 }}>{task.description.length > 150 ? task.description.slice(0, 148) + "…" : task.description}</div>
                        <div style={{ display: "flex", gap: 20, fontSize: 12, color: text2 }}>
                          <span>📁 {task.category}</span>
                          {task.dueDate && <span>📅 Due: {new Date(task.dueDate).toLocaleDateString("en-GB")}</span>}
                          <span>🕐 {new Date(task.createdAt).toLocaleDateString("en-GB")}</span>
                          {task.completedAt && <span style={{ color: green }}>✅ Done: {new Date(task.completedAt).toLocaleDateString("en-GB")}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════ VAULT TAB ════════════ */}
          {!loading && activeTab === "vault" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, color: text1, marginBottom: 6 }}>Private Vault</h2>
                  <p style={{ fontSize: 14, color: text2 }}>Documents, books, files, secrets — EVC eyes only · Max 50MB per file</p>
                </div>
                <button onClick={() => setShowVault(!showVault)} style={{ padding: "10px 22px", borderRadius: 10, border: `1.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {showVault ? "Cancel" : "↑ Upload to vault"}
                </button>
              </div>

              {showVault && (
                <div style={{ background: card, border: `0.5px solid ${gold}`, borderRadius: 14, padding: 28, marginBottom: 24 }}>
                  <form onSubmit={handleVaultUpload}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Select file * (max 50MB)</label>
                        <input type="file" onChange={(e) => setVaultFile(e.target.files?.[0] || null)} style={{ ...inp, padding: "10px 14px" }} required />
                        {vaultFile && <div style={{ fontSize: 13, color: green, marginTop: -10, marginBottom: 10 }}>✓ {vaultFile.name} — {formatFileSize(vaultFile.size)}</div>}
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Title *</label>
                        <input style={inp} value={vaultForm.title} onChange={(e) => setVaultForm({ ...vaultForm, title: e.target.value })} placeholder="Give this file a clear title" required />
                      </div>
                      <div>
                        <label style={lbl}>Category *</label>
                        <select style={inp} value={vaultForm.category} onChange={(e) => setVaultForm({ ...vaultForm, category: e.target.value })}>
                          {VAULT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Tags (comma-separated)</label>
                        <input style={inp} value={vaultForm.tags} onChange={(e) => setVaultForm({ ...vaultForm, tags: e.target.value })} placeholder="e.g. budget, 2026, confidential" />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Description / notes</label>
                        <textarea style={{ ...inp, resize: "none", minHeight: 70 } as any} value={vaultForm.description} onChange={(e) => setVaultForm({ ...vaultForm, description: e.target.value })} placeholder="What is this file about..." />
                      </div>
                      <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12 }}>
                        <input type="checkbox" id="encrypt" checked={vaultForm.isEncrypted} onChange={(e) => setVaultForm({ ...vaultForm, isEncrypted: e.target.checked })} style={{ width: 18, height: 18, accentColor: gold, cursor: "pointer" }} />
                        <label htmlFor="encrypt" style={{ fontSize: 14, color: text2, cursor: "pointer" }}>Mark as encrypted / highest sensitivity</label>
                      </div>
                    </div>
                    <button type="submit" disabled={submitting} style={{ padding: "12px 28px", borderRadius: 10, border: `1.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>
                      {submitting ? "Uploading..." : "Save to vault"}
                    </button>
                  </form>
                </div>
              )}

              {/* FIX 3: Vault filter bar */}
              <FilterBar>
                <input style={{ ...filterInp, minWidth: 220 }} placeholder="🔍 Search title, filename, tags..." value={vaultSearch} onChange={(e) => setVaultSearch(e.target.value)} />
                <select style={filterInp} value={vaultCatFilter} onChange={(e) => setVaultCatFilter(e.target.value)}>
                  <option value="ALL">All categories</option>
                  {VAULT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select style={filterInp} value={vaultEncFilter} onChange={(e) => setVaultEncFilter(e.target.value)}>
                  <option value="ALL">All files</option>
                  <option value="ENCRYPTED">🔒 Encrypted only</option>
                  <option value="STANDARD">Standard only</option>
                </select>
                {(vaultSearch || vaultCatFilter !== "ALL" || vaultEncFilter !== "ALL") && (
                  <button onClick={() => { setVaultSearch(""); setVaultCatFilter("ALL"); setVaultEncFilter("ALL"); }} style={{ padding: "8px 14px", borderRadius: 8, border: `0.5px solid #7f1d1d`, background: "#1f0707", color: "#f87171", fontSize: 12, cursor: "pointer" }}>✕ Clear</button>
                )}
                <span style={{ marginLeft: "auto", fontSize: 12, color: text2 }}>{filteredVault.length} of {vaultFiles.length}</span>
              </FilterBar>

              {filteredVault.length === 0 ? (
                <div style={{ textAlign: "center", padding: 64, color: text2 }}>
                  <div style={{ fontSize: 50, marginBottom: 16 }}>🗄</div>
                  <div style={{ fontSize: 18, color: text1, marginBottom: 8 }}>{vaultFiles.length === 0 ? "Vault is empty" : "No files match your filters"}</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {filteredVault.map((file) => {
                    const isImg = file.fileType.startsWith("image/");
                    const icon  = isImg ? "🖼" : file.fileType.includes("pdf") ? "📕" : file.fileType.includes("word") ? "📘" : file.fileType.includes("sheet") || file.fileType.includes("excel") ? "📗" : "📄";
                    return (
                      <div key={file.id} style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 14, padding: "18px 20px" }}>
                        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                          <div style={{ fontSize: 32, flexShrink: 0 }}>{icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: text1, lineHeight: 1.3, marginBottom: 4 }}>{file.title}</div>
                            <div style={{ fontSize: 12, color: text2 }}>{file.fileName}</div>
                          </div>
                          {file.isEncrypted && <span style={{ fontSize: 14 }}>🔒</span>}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: `${gold}22`, color: gold, border: `0.5px solid ${gold}44` }}>{file.category}</span>
                          <span style={{ fontSize: 11, color: text2 }}>{formatFileSize(file.fileSize)}</span>
                          <span style={{ fontSize: 11, color: text2 }}>{new Date(file.createdAt).toLocaleDateString("en-GB")}</span>
                        </div>
                        {file.description && <div style={{ fontSize: 13, color: text2, marginBottom: 12, lineHeight: 1.5 }}>{file.description.length > 80 ? file.description.slice(0, 78) + "…" : file.description}</div>}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => requestDownload(file)} style={{ flex: 1, padding: "9px", borderRadius: 9, border: `0.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🔐 Download</button>
                          <button onClick={() => handleDeleteVault(file.id)} style={{ padding: "9px 14px", borderRadius: 9, border: `0.5px solid #7f1d1d`, background: "#1f0707", color: red, fontSize: 13, cursor: "pointer" }}>🗑</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════ DIRECTORS TAB ════════════ */}
          {!loading && activeTab === "directors" && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: text1, marginBottom: 6 }}>Director Intelligence</h2>
              <p style={{ fontSize: 14, color: text2, marginBottom: 20 }}>Private performance analysis of all department heads</p>

              {/* FIX 3: Directors filter bar */}
              <FilterBar>
                <input style={{ ...filterInp, minWidth: 220 }} placeholder="🔍 Search name or department..." value={dirSearch} onChange={(e) => setDirSearch(e.target.value)} />
                <select style={filterInp} value={dirSortBy} onChange={(e) => setDirSortBy(e.target.value)}>
                  <option value="score">Sort: Performance score</option>
                  <option value="name">Sort: Name A–Z</option>
                  <option value="logs">Sort: Most logs</option>
                  <option value="pending">Sort: Fewest pending</option>
                </select>
                {dirSearch && (
                  <button onClick={() => setDirSearch("")} style={{ padding: "8px 14px", borderRadius: 8, border: `0.5px solid #7f1d1d`, background: "#1f0707", color: "#f87171", fontSize: 12, cursor: "pointer" }}>✕ Clear</button>
                )}
                <span style={{ marginLeft: "auto", fontSize: 12, color: text2 }}>{filteredDirectors.length} of {directors.length}</span>
              </FilterBar>

              {filteredDirectors.length === 0 ? (
                <div style={{ textAlign: "center", padding: 56, color: text2 }}>No directors found</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {filteredDirectors.map((dir, i) => {
                    const ap = dir.deptLogs > 0 ? Math.round((dir.approvedByDir / dir.deptLogs) * 100) : 0;
                    const tp = dir.tasksCreated > 0 ? Math.round((dir.tasksCompleted / dir.tasksCreated) * 100) : 0;
                    const overallScore = Math.round((ap * 0.5) + (tp * 0.3) + (dir.pendingForDir === 0 ? 20 : Math.max(0, 20 - dir.pendingForDir * 2)));
                    const scoreColor = overallScore >= 70 ? green : overallScore >= 50 ? gold : red;
                    return (
                      <div key={dir.id} style={{ background: card, border: `0.5px solid ${border}`, borderRadius: 14, padding: "22px 26px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: text2 }}>#{i + 1}</span>
                              <span style={{ fontSize: 18, fontWeight: 700, color: text1 }}>{dir.name}</span>
                            </div>
                            <div style={{ fontSize: 14, color: text2 }}>{dir.department}</div>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 42, fontWeight: 800, color: scoreColor, letterSpacing: "-0.03em" }}>{overallScore}</div>
                            <div style={{ fontSize: 10, color: text2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Score</div>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
                          {[
                            { label: "Dept logs",      value: dir.deptLogs,       warn: false },
                            { label: "Approved",        value: dir.approvedByDir,  warn: false },
                            { label: "Pending review",  value: dir.pendingForDir,  warn: dir.pendingForDir > 5 },
                            { label: "Tasks created",   value: dir.tasksCreated,   warn: false },
                            { label: "Tasks done",      value: dir.tasksCompleted, warn: false },
                          ].map((m) => (
                            <div key={m.label} style={{ background: "#0a0c14", borderRadius: 10, padding: "12px 14px" }}>
                              <div style={{ fontSize: 24, fontWeight: 700, color: m.warn ? red : text1 }}>{m.value}</div>
                              <div style={{ fontSize: 11, color: text2, marginTop: 4 }}>{m.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════ PROMOTIONS TAB ════════════ */}
          {!loading && activeTab === "promotions" && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: text1, marginBottom: 6 }}>Promotion Intelligence</h2>
              <p style={{ fontSize: 14, color: text2, marginBottom: 20 }}>Data-driven recommendations — private to EVC only</p>

              {/* FIX 3: Promotions filter bar */}
              <FilterBar>
                <input style={{ ...filterInp, minWidth: 200 }} placeholder="🔍 Search name or department..." value={promoSearch} onChange={(e) => setPromoSearch(e.target.value)} />
                <select style={filterInp} value={promoDeptFilter} onChange={(e) => setPromoDeptFilter(e.target.value)}>
                  <option value="ALL">All departments</option>
                  {uniquePromoDepts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select style={filterInp} value={promoRecFilter} onChange={(e) => setPromoRecFilter(e.target.value)}>
                  <option value="ALL">All recommendations</option>
                  <option value="Strongly">Strongly recommend</option>
                  <option value="Recommend">Recommend</option>
                  <option value="Monitor">Monitor</option>
                  <option value="Not">Not recommended</option>
                </select>
                {(promoSearch || promoDeptFilter !== "ALL" || promoRecFilter !== "ALL") && (
                  <button onClick={() => { setPromoSearch(""); setPromoDeptFilter("ALL"); setPromoRecFilter("ALL"); }} style={{ padding: "8px 14px", borderRadius: 8, border: `0.5px solid #7f1d1d`, background: "#1f0707", color: "#f87171", fontSize: 12, cursor: "pointer" }}>✕ Clear</button>
                )}
                <span style={{ marginLeft: "auto", fontSize: 12, color: text2 }}>{filteredPromos.length} of {promotions.length}</span>
              </FilterBar>

              {filteredPromos.length === 0 ? (
                <div style={{ textAlign: "center", padding: 56, color: text2 }}>{promotions.length === 0 ? "No staff data available yet" : "No results match your filters"}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredPromos.map((p, i) => {
                    const recColor = p.recommendation.includes("Strongly") ? green : p.recommendation.includes("Recommend") ? blue : p.recommendation.includes("Monitor") ? gold : red;
                    return (
                      <div key={p.id} style={{ background: card, border: `0.5px solid ${border}`, borderLeft: `3px solid ${recColor}`, borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 20 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: text2, width: 28, flexShrink: 0 }}>#{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: text1, marginBottom: 3 }}>{p.name}</div>
                          <div style={{ fontSize: 13, color: text2 }}>{p.department} · {p.role.charAt(0) + p.role.slice(1).toLowerCase()}</div>
                        </div>
                        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                          <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 600, color: text1 }}>{p.approvalRate}%</div><div style={{ fontSize: 11, color: text2 }}>Approval</div></div>
                          <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 600, color: text1 }}>{p.avgScore}/10</div><div style={{ fontSize: 11, color: text2 }}>Avg score</div></div>
                          <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 600, color: p.examPassed ? green : red }}>{p.examPassed ? "Passed" : "Not taken"}</div><div style={{ fontSize: 11, color: text2 }}>Exam</div></div>
                          <div style={{ textAlign: "center", width: 50 }}><div style={{ fontSize: 30, fontWeight: 800, color: recColor }}>{p.perfScore}</div><div style={{ fontSize: 11, color: text2 }}>Score</div></div>
                          <div style={{ padding: "6px 14px", borderRadius: 8, border: `0.5px solid ${recColor}44`, background: `${recColor}11`, color: recColor, fontSize: 12, fontWeight: 600, maxWidth: 180, textAlign: "center" }}>{p.recommendation}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════ NOTIFICATIONS TAB ════════════ */}
          {!loading && activeTab === "notifications" && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: text1, marginBottom: 6 }}>Notifications</h2>
              <p style={{ fontSize: 14, color: text2, marginBottom: 28 }}>System alerts and updates · {unreadCount} unread</p>
              {notifications.length === 0 ? (
                <div style={{ textAlign: "center", padding: 56, color: text2 }}><div style={{ fontSize: 40, marginBottom: 14 }}>🔔</div><div style={{ fontSize: 16, color: text1, marginBottom: 8 }}>No notifications</div></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {notifications.map((n) => (
                    <div key={n.id} onClick={() => !n.read && markRead(n.id)} style={{ background: card, border: `0.5px solid ${n.read ? border : gold}`, borderRadius: 14, padding: "18px 22px", cursor: n.read ? "default" : "pointer", opacity: n.read ? 0.7 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: n.read ? text2 : text1 }}>{n.title}</div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: gold, display: "inline-block" }} />}
                          <span style={{ fontSize: 12, color: text2 }}>{new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, color: text2, lineHeight: 1.5 }}>{n.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════ PRIVATE NOTES TAB ════════════ */}
          {!loading && activeTab === "annotations" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, color: text1, marginBottom: 6 }}>Private Notes</h2>
                  <p style={{ fontSize: 14, color: text2 }}>Confidential annotations — never visible to any other user</p>
                </div>
                <button onClick={() => setShowNoteForm(!showNoteForm)} style={{ padding: "10px 22px", borderRadius: 10, border: `1.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {showNoteForm ? "Cancel" : "+ Add note"}
                </button>
              </div>

              {showNoteForm && (
                <div style={{ background: card, border: `0.5px solid ${gold}`, borderRadius: 14, padding: 28, marginBottom: 24 }}>
                  <form onSubmit={handleNoteSubmit}>
                    <label style={lbl}>Subject *</label>
                    <input style={inp} value={noteForm.subject} onChange={(e) => setNoteForm({ ...noteForm, subject: e.target.value })} placeholder="Note subject" required />
                    <label style={lbl}>Priority</label>
                    <select style={inp} value={noteForm.priority} onChange={(e) => setNoteForm({ ...noteForm, priority: e.target.value })}>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High priority</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                    <label style={lbl}>Content *</label>
                    <textarea style={{ ...inp, resize: "none", minHeight: 120 } as any} value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })} placeholder="Write your confidential note..." required />
                    <button type="submit" disabled={submitting} style={{ padding: "12px 28px", borderRadius: 10, border: `1.5px solid ${gold}`, background: "#1c1107", color: gold, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>
                      {submitting ? "Saving..." : "Save note"}
                    </button>
                  </form>
                </div>
              )}

              {/* FIX 3: Notes filter bar */}
              <FilterBar>
                <input style={{ ...filterInp, minWidth: 220 }} placeholder="🔍 Search subject or content..." value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} />
                <select style={filterInp} value={notePrioFilter} onChange={(e) => setNotePrioFilter(e.target.value)}>
                  <option value="ALL">All priorities</option>
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="NORMAL">Normal</option>
                </select>
                {(noteSearch || notePrioFilter !== "ALL") && (
                  <button onClick={() => { setNoteSearch(""); setNotePrioFilter("ALL"); }} style={{ padding: "8px 14px", borderRadius: 8, border: `0.5px solid #7f1d1d`, background: "#1f0707", color: "#f87171", fontSize: 12, cursor: "pointer" }}>✕ Clear</button>
                )}
                <span style={{ marginLeft: "auto", fontSize: 12, color: text2 }}>{filteredNotes.length} of {annotations.length}</span>
              </FilterBar>

              {filteredNotes.length === 0 ? (
                <div style={{ textAlign: "center", padding: 64, color: text2 }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
                  <div style={{ fontSize: 16, color: text1, marginBottom: 8 }}>{annotations.length === 0 ? "No private notes" : "No notes match your filters"}</div>
                  {annotations.length === 0 && <div>Your confidential notes appear here — visible to nobody else</div>}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredNotes.map((note) => {
                    const pc = note.priority === "URGENT" ? red : note.priority === "HIGH" ? gold : text2;
                    return (
                      <div key={note.id} style={{ background: card, border: `0.5px solid ${border}`, borderLeft: `3px solid ${pc}`, borderRadius: 14, padding: "20px 24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: text1 }}>{note.subject}</div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 7, color: pc, border: `0.5px solid ${pc}44`, background: `${pc}11` }}>{note.priority}</span>
                            <span style={{ fontSize: 12, color: text2 }}>{new Date(note.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 14, color: text2, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{note.content}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

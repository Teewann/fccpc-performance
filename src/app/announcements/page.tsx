"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, Suspense } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import { useSearchParams, useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────
type Announcement = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  targetDeptId: string | null;
  createdAt: string;
  author: {
    name: string;
    role: string;
    department: { name: string } | null;
  };
};

type Memo = {
  id: string;
  subject: string;
  body: string;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  createdAt: string;
  sender: { id: string; name: string; role: string; department: { name: string } | null };
  recipients: { id: string; read: boolean; readAt: string | null; user: { id: string; name: string } }[];
  _myRecipient?: { id: string; read: boolean } | null;
};

type Department = { id: string; name: string };
type StaffUser  = { id: string; name: string; role: string; department: { name: string } | null };

// ─── Constants ────────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
  EXECUTIVE: "#f59e0b",
  DIRECTOR:  "#60a5fa",
  ADMIN:     "#4ade80",
  HR:        "#a78bfa",
  SUPERVISOR:"#fb923c",
  STAFF:     "#9ca3af",
};

const ROLE_BG: Record<string, { bg: string; color: string; border: string }> = {
  EXECUTIVE:  { bg: "#1c1107", color: "#f59e0b", border: "#78350f" },
  DIRECTOR:   { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
  ADMIN:      { bg: "#052e16", color: "#4ade80", border: "#14532d" },
  HR:         { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95" },
  SUPERVISOR: { bg: "#1c1007", color: "#fb923c", border: "#7c2d12" },
  STAFF:      { bg: "#1a1d28", color: "#9ca3af", border: "#374151" },
};

const ANNOUNCE_EMPTY = { title: "", body: "", targetDeptId: "", isPinned: false };
const MEMO_ROLES = ["DIRECTOR","HR","ADMIN","EXECUTIVE","SUPERVISOR","STAFF"];

// ─── Shared style helpers ─────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-input)",
  border: "0.5px solid var(--border)",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 15,
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 14,
};

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 7,
};

// ─── Main content component (wrapped in Suspense) ────────────────────
function AnnouncementsContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const tabParam     = searchParams.get("tab");

  const [activeTab,     setActiveTab]     = useState<"announcements" | "memos">(
    tabParam === "memos" ? "memos" : "announcements"
  );
  const [userRole,      setUserRole]      = useState("");
  const [userId,        setUserId]        = useState("");
  const [departments,   setDepartments]   = useState<Department[]>([]);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  useEffect(() => {
    fetch("/api/settings/account")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) { setUserRole(d.user.role); setUserId(d.user.id); }
      });
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments || []));
  }, []);

  function switchTab(tab: "announcements" | "memos") {
    setActiveTab(tab);
    router.replace(`/announcements${tab === "memos" ? "?tab=memos" : ""}`);
  }

  const canPost   = ["DIRECTOR","ADMIN","EXECUTIVE","HR"].includes(userRole);
  const canPostAnn = ["DIRECTOR","ADMIN","EXECUTIVE"].includes(userRole);

  // Post announcement handler (lifted to parent so the header button can toggle the form)
  const [showAnnForm, setShowAnnForm] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Communications
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · Announcements & internal memos
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {activeTab === "announcements" && canPostAnn && (
              <button
                onClick={() => setShowAnnForm(!showAnnForm)}
                style={{
                  padding: "10px 22px", borderRadius: 10,
                  border: "1.5px solid #22c55e", background: "#052e16",
                  color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                {showAnnForm ? "Cancel" : "+ Post announcement"}
              </button>
            )}
            <ThemeToggleButton />
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["announcements","memos"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              style={{
                padding: "10px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                border:     activeTab === tab ? "1.5px solid #22c55e" : "0.5px solid var(--border)",
                background: activeTab === tab ? "#052e16" : "var(--bg-card)",
                color:      activeTab === tab ? "#4ade80" : "var(--text-muted)",
                transition: "all 0.15s",
              }}
            >
              {tab === "announcements" ? "📢 Announcements" : "📝 Memos"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "announcements" ? (
          <AnnouncementsTab
            canPost={canPostAnn}
            departments={departments}
            today={today}
            inp={inp}
            lbl={lbl}
            showForm={showAnnForm}
            setShowForm={setShowAnnForm}
          />
        ) : (
          <MemosTab
            canPost={canPost}
            departments={departments}
            userId={userId}
            userRole={userRole}
            inp={inp}
            lbl={lbl}
          />
        )}
      </main>
    </div>
  );
}

// ─── Wrapper with Suspense boundary ──────────────────────────────────
export default function AnnouncementsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-page)", color: "var(--text-muted)" }}>
        Loading communications...
      </div>
    }>
      <AnnouncementsContent />
    </Suspense>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS TAB (unchanged)
// ═══════════════════════════════════════════════════════════════════════
function AnnouncementsTab({
  canPost, departments, today, inp, lbl, showForm, setShowForm,
}: {
  canPost: boolean;
  departments: Department[];
  today: string;
  inp: React.CSSProperties;
  lbl: React.CSSProperties;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [submitting,    setSubmitting]    = useState(false);
  const [msg,           setMsg]           = useState({ text: "", ok: true });
  const [form,          setForm]          = useState(ANNOUNCE_EMPTY);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const res  = await fetch("/api/announcements");
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setMsg({ text: "", ok: true });
    try {
      const res  = await fetch("/api/announcements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "Announcement posted successfully.", ok: true });
        setForm(ANNOUNCE_EMPTY); setShowForm(false); fetchAll();
      } else { setMsg({ text: data.error || "Failed to post.", ok: false }); }
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this announcement? This cannot be undone.")) return;
    await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
    fetchAll();
  }

  return (
    <>
      {showForm && canPost && (
        <div className="card-bg" style={{ borderRadius: 14, padding: 28, marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
            Post new announcement
          </h2>
          {msg.text && (
            <div style={{ background: msg.ok ? "var(--accent-bg)" : "#1f0707", border: `0.5px solid ${msg.ok ? "var(--accent-border)" : "#7f1d1d"}`, color: msg.ok ? "var(--accent-text)" : "#f87171", borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16 }}>
              {msg.text}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <label style={lbl}>Title <span style={{ color: "#f87171" }}>*</span></label>
            <input style={inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Clear, direct announcement title" required />

            <label style={lbl}>Message <span style={{ color: "#f87171" }}>*</span></label>
            <textarea style={{ ...inp, resize: "none", minHeight: 130 } as any} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write your announcement here. Be clear and specific about any actions required." required />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={lbl}>Target audience</label>
                <select style={inp} value={form.targetDeptId} onChange={(e) => setForm({ ...form, targetDeptId: e.target.value })}>
                  <option value="">All staff - entire organisation</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name} only</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 6 }}>
                <input type="checkbox" id="pinned" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} style={{ width: 18, height: 18, accentColor: "#22c55e", cursor: "pointer", flexShrink: 0 }} />
                <label htmlFor="pinned" style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", cursor: "pointer" }}>
                  Pin this announcement
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400, marginTop: 2 }}>Pinned posts stay at the top for all staff</div>
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8, paddingTop: 16, borderTop: "0.5px solid var(--border-soft)" }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: "11px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ padding: "11px 28px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}>
                {submitting ? "Posting..." : "Post announcement"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>📢</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>No announcements yet</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Directors and Executives can post official announcements here</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {announcements.map((ann) => (
            <div key={ann.id} className="card-bg" style={{ borderRadius: 14, padding: "22px 24px", borderLeft: `3px solid ${ann.isPinned ? "#f59e0b" : "var(--border)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    {ann.isPinned && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: "#1c1107", color: "#f59e0b", border: "0.5px solid #78350f" }}>📌 Pinned</span>
                    )}
                    {ann.targetDeptId && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: "#0c1a2e", color: "#60a5fa", border: "0.5px solid #1e3a5f" }}>Department only</span>
                    )}
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{ann.title}</div>
                </div>
                {canPost && (
                  <button onClick={() => handleDelete(ann.id)} title="Delete" style={{ background: "none", border: "none", color: "var(--text-hint)", fontSize: 18, cursor: "pointer", flexShrink: 0, marginLeft: 16, padding: 4 }}>✕</button>
                )}
              </div>
              <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 18, whiteSpace: "pre-wrap" }}>{ann.body}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 14, borderTop: "0.5px solid var(--border-soft)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "var(--accent-bg)", border: "1.5px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--accent-text)" }}>
                  {ann.author.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {ann.author.name}
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: ROLE_COLOR[ann.author.role] || "var(--text-muted)" }}>
                      {ann.author.role.charAt(0) + ann.author.role.slice(1).toLowerCase()}
                    </span>
                    {ann.author.department && (
                      <span style={{ marginLeft: 6, fontSize: 12, color: "var(--text-hint)" }}>· {ann.author.department.name}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 2 }}>
                    {new Date(ann.createdAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MEMOS TAB (with Forward button and ForwardModal)
// ═══════════════════════════════════════════════════════════════════════
function MemosTab({
  canPost, departments, userId, userRole, inp, lbl,
}: {
  canPost: boolean;
  departments: Department[];
  userId: string;
  userRole: string;
  inp: React.CSSProperties;
  lbl: React.CSSProperties;
}) {
  const [memos,        setMemos]        = useState<Memo[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showCompose,  setShowCompose]  = useState(false);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [forwardingMemo, setForwardingMemo] = useState<Memo | null>(null);

  useEffect(() => { fetchMemos(); }, []);

  async function fetchMemos() {
    setLoading(true);
    try {
      const res  = await fetch("/api/memos");
      const data = await res.json();
      setMemos(data.memos || []);
    } finally { setLoading(false); }
  }

  async function markRead(memoId: string) {
    await fetch(`/api/memos/${memoId}`, { method: "PATCH" });
    setMemos((prev) => prev.map((m) =>
      m.id === memoId
        ? { ...m, _myRecipient: m._myRecipient ? { ...m._myRecipient, read: true } : null }
        : m
    ));
  }

  async function deleteMemo(memoId: string) {
    if (!confirm("Delete this memo? This cannot be undone.")) return;
    const res = await fetch(`/api/memos/${memoId}`, { method: "DELETE" });
    if (res.ok) fetchMemos();
    else alert("Failed to delete memo.");
  }

  const unreadCount = memos.filter((m) => m._myRecipient && !m._myRecipient.read).length;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {memos.length} memo{memos.length !== 1 ? "s" : ""}
            {unreadCount > 0 && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "#0c1a2e", color: "#60a5fa", border: "0.5px solid #1e3a5f" }}>
                {unreadCount} unread
              </span>
            )}
          </span>
        </div>
        {canPost && (
          <button
            onClick={() => setShowCompose(true)}
            style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            + New Memo
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>Loading memos...</div>
      ) : memos.length === 0 ? (
        <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>📝</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>No memos yet</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {canPost ? "Compose a memo to send to staff." : "You have no memos in your inbox."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {memos.map((memo) => {
            const isSender  = memo.sender.id === userId;
            const myRec     = memo._myRecipient;
            const isUnread  = myRec && !myRec.read;
            const isExpanded = expandedId === memo.id;
            const rs        = ROLE_BG[memo.sender.role] || ROLE_BG.STAFF;

            return (
              <div
                key={memo.id}
                className="card-bg"
                style={{
                  borderRadius: 14, padding: "18px 22px",
                  borderLeft: `3px solid ${isUnread ? "#3b82f6" : isSender ? "#a78bfa" : "var(--border)"}`,
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}
                  onClick={() => {
                    setExpandedId(isExpanded ? null : memo.id);
                    if (isUnread) markRead(memo.id);
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                      {isUnread && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#0c1a2e", color: "#60a5fa", border: "0.5px solid #1e3a5f" }}>NEW</span>}
                      {isSender && <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "#1a0a2e", color: "#a78bfa", border: "0.5px solid #4c1d95" }}>Sent</span>}
                      {memo.fileName && <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "#1c1107", color: "#f59e0b", border: "0.5px solid #78350f" }}>📎 Attachment</span>}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: isUnread ? 700 : 600, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 4 }}>
                      {memo.subject}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: rs.bg, color: rs.color, border: `0.5px solid ${rs.border}` }}>
                        {memo.sender.role.charAt(0) + memo.sender.role.slice(1).toLowerCase()}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        {isSender ? "You" : memo.sender.name}
                        {memo.sender.department && ` · ${memo.sender.department.name}`}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-hint)" }}>
                        · {new Date(memo.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                    {isSender && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMemo(memo.id); }}
                        title="Delete memo"
                        style={{ background: "none", border: "none", color: "var(--text-hint)", fontSize: 16, cursor: "pointer", padding: 4 }}
                      >✕</button>
                    )}
                    <span style={{ fontSize: 18, color: "var(--text-hint)", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                      ▾
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "0.5px solid var(--border-soft)" }}>
                    <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 16 }}>
                      {memo.body}
                    </div>

                    {memo.fileUrl && memo.fileName && (
                      <a
                        href={memo.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: "#1c1107", border: "0.5px solid #78350f", color: "#f59e0b", fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 16 }}
                      >
                        📎 {memo.fileName}
                      </a>
                    )}

                    {isSender && memo.recipients && memo.recipients.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Recipients ({memo.recipients.length}) - {memo.recipients.filter((r) => r.read).length} read
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {memo.recipients.slice(0, 20).map((r) => (
                            <span key={r.id} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: r.read ? "#052e16" : "var(--bg-input)", color: r.read ? "#4ade80" : "var(--text-hint)", border: `0.5px solid ${r.read ? "#14532d" : "var(--border)"}` }}>
                              {r.user.name}
                            </span>
                          ))}
                          {memo.recipients.length > 20 && (
                            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "var(--bg-input)", color: "var(--text-hint)", border: "0.5px solid var(--border)" }}>
                              +{memo.recipients.length - 20} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ✅ FORWARD BUTTON (only shown for non‑senders) */}
                    {!isSender && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "0.5px solid var(--border-soft)" }}>
                        <button
                          onClick={() => setForwardingMemo(memo)}
                          style={{ padding: "8px 18px", borderRadius: 9, border: "1.5px solid #3b82f6", background: "#0c1a2e", color: "#60a5fa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                        >
                          ↪ Forward this memo
                        </button>
                      </div>
                    )}

                    {myRec && !myRec.read && (
                      <button
                        onClick={() => markRead(memo.id)}
                        style={{ marginTop: 12, padding: "8px 18px", borderRadius: 9, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >
                        ✓ Mark as read
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCompose && (
        <ComposeModal
          departments={departments}
          inp={inp}
          lbl={lbl}
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); fetchMemos(); }}
        />
      )}

      {forwardingMemo && (
        <ForwardModal
          originalMemo={forwardingMemo}
          departments={departments}
          inp={inp}
          lbl={lbl}
          onClose={() => setForwardingMemo(null)}
          onForwarded={() => { setForwardingMemo(null); fetchMemos(); }}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPOSE MODAL (unchanged)
// ═══════════════════════════════════════════════════════════════════════
function ComposeModal({
  departments, inp, lbl, onClose, onSent,
}: {
  departments: Department[];
  inp: React.CSSProperties;
  lbl: React.CSSProperties;
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject,      setSubject]      = useState("");
  const [body,         setBody]         = useState("");
  const [targetType,   setTargetType]   = useState<"all" | "department" | "roles" | "specific">("all");
  const [targetDeptId, setTargetDeptId] = useState("");
  const [targetRoles,  setTargetRoles]  = useState<string[]>([]);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [staffList,    setStaffList]    = useState<StaffUser[]>([]);
  const [staffSearch,  setStaffSearch]  = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [fileUrl,      setFileUrl]      = useState<string | null>(null);
  const [fileName,     setFileName]     = useState<string | null>(null);
  const [fileType,     setFileType]     = useState<string | null>(null);
  const [msg,          setMsg]          = useState({ text: "", ok: true });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (targetType === "specific") {
      fetch("/api/users?limit=500")
        .then((r) => r.json())
        .then((d) => setStaffList(d.users || []));
    }
  }, [targetType]);

  function toggleRole(role: string) {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function toggleRecipient(id: string) {
    setRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/chat/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setFileUrl(data.url);
        setFileName(file.name);
        setFileType(file.type);
      } else {
        setMsg({ text: data.error || "File upload failed.", ok: false });
      }
    } finally { setUploading(false); }
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setMsg({ text: "Subject and body are required.", ok: false }); return;
    }
    if (targetType === "roles" && targetRoles.length === 0) {
      setMsg({ text: "Please select at least one role.", ok: false }); return;
    }
    if (targetType === "specific" && recipientIds.length === 0) {
      setMsg({ text: "Please select at least one recipient.", ok: false }); return;
    }
    if (targetType === "department" && !targetDeptId) {
      setMsg({ text: "Please select a department.", ok: false }); return;
    }

    setSubmitting(true); setMsg({ text: "", ok: true });
    try {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject, body, targetType, targetDeptId, targetRoles, recipientIds,
          fileUrl, fileName, fileType,
        }),
      });
      const data = await res.json();
      if (res.ok) { onSent(); }
      else { setMsg({ text: data.error || "Failed to send memo.", ok: false }); }
    } finally { setSubmitting(false); }
  }

  const filteredStaff = staffList.filter((u) =>
    u.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    (u.department?.name || "").toLowerCase().includes(staffSearch.toLowerCase())
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 660, maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Compose Memo</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {msg.text && (
          <div style={{ background: msg.ok ? "var(--accent-bg)" : "#1f0707", border: `0.5px solid ${msg.ok ? "var(--accent-border)" : "#7f1d1d"}`, color: msg.ok ? "var(--accent-text)" : "#f87171", borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16 }}>
            {msg.text}
          </div>
        )}

        <label style={lbl}>Subject <span style={{ color: "#f87171" }}>*</span></label>
        <input style={inp} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Memo subject line" />

        <label style={lbl}>Message <span style={{ color: "#f87171" }}>*</span></label>
        <textarea
          style={{ ...inp, resize: "none", minHeight: 140 } as any}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your memo here..."
        />

        <label style={lbl}>Attachment (optional)</label>
        <div style={{ marginBottom: 14 }}>
          {fileUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "#1c1107", border: "0.5px solid #78350f" }}>
              <span style={{ fontSize: 13, color: "#f59e0b", flex: 1 }}>📎 {fileName}</span>
              <button onClick={() => { setFileUrl(null); setFileName(null); setFileType(null); if (fileRef.current) fileRef.current.value = ""; }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 15 }}>✕</button>
            </div>
          ) : (
            <div>
              <input ref={fileRef} type="file" id="memo-file" style={{ display: "none" }} onChange={handleFileChange} />
              <label htmlFor="memo-file" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 13, fontWeight: 500, cursor: uploading ? "not-allowed" : "pointer" }}>
                {uploading ? "Uploading..." : "📎 Attach file"}
              </label>
            </div>
          )}
        </div>

        <label style={lbl}>Send to <span style={{ color: "#f87171" }}>*</span></label>
        <select style={inp} value={targetType} onChange={(e) => setTargetType(e.target.value as any)}>
          <option value="all">All staff - entire organisation</option>
          <option value="department">Specific department</option>
          <option value="roles">Specific roles</option>
          <option value="specific">Specific individuals</option>
        </select>

        {targetType === "department" && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Select department</label>
            <select style={inp} value={targetDeptId} onChange={(e) => setTargetDeptId(e.target.value)}>
              <option value="">- Choose department -</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        {targetType === "roles" && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Select roles</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MEMO_ROLES.map((role) => {
                const rs = ROLE_BG[role] || ROLE_BG.STAFF;
                const selected = targetRoles.includes(role);
                return (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    style={{
                      padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      border: selected ? `1.5px solid ${rs.border}` : "0.5px solid var(--border)",
                      background: selected ? rs.bg : "var(--bg-input)",
                      color: selected ? rs.color : "var(--text-muted)",
                    }}
                  >
                    {role.charAt(0) + role.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {targetType === "specific" && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Select recipients ({recipientIds.length} selected)</label>
            <input style={{ ...inp, marginBottom: 8 }} placeholder="Search staff..." value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} />
            <div style={{ maxHeight: 220, overflowY: "auto", border: "0.5px solid var(--border)", borderRadius: 10, padding: 4 }}>
              {filteredStaff.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: "var(--text-hint)", fontSize: 13 }}>No staff found</div>
              ) : (
                filteredStaff.map((u) => {
                  const selected = recipientIds.includes(u.id);
                  return (
                    <div key={u.id} onClick={() => toggleRecipient(u.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", background: selected ? "#052e16" : "transparent" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: selected ? "var(--accent-bg)" : "var(--bg-input)", border: `1.5px solid ${selected ? "var(--accent-border)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: selected ? "var(--accent-text)" : "var(--text-muted)" }}>
                        {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: selected ? "#4ade80" : "var(--text-primary)" }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-hint)" }}>{u.role.charAt(0) + u.role.slice(1).toLowerCase()}{u.department && ` · ${u.department.name}`}</div>
                      </div>
                      {selected && <span style={{ fontSize: 14, color: "#4ade80" }}>✓</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, paddingTop: 16, borderTop: "0.5px solid var(--border-soft)", marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: "11px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={handleSend} disabled={submitting || uploading} style={{ padding: "11px 28px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}>
            {submitting ? "Sending..." : "Send Memo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// FORWARD MODAL (new)
// ═══════════════════════════════════════════════════════════════════════
function ForwardModal({
  originalMemo,
  departments,
  inp,
  lbl,
  onClose,
  onForwarded,
}: {
  originalMemo: Memo;
  departments: Department[];
  inp: React.CSSProperties;
  lbl: React.CSSProperties;
  onClose: () => void;
  onForwarded: () => void;
}) {
  const [forwardNote, setForwardNote] = useState("");
  const [targetType,   setTargetType]   = useState<"all" | "department" | "roles" | "specific">("all");
  const [targetDeptId, setTargetDeptId] = useState("");
  const [targetRoles,  setTargetRoles]  = useState<string[]>([]);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [staffList,    setStaffList]    = useState<StaffUser[]>([]);
  const [staffSearch,  setStaffSearch]  = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [msg,          setMsg]          = useState({ text: "", ok: true });

  useEffect(() => {
    if (targetType === "specific") {
      fetch("/api/users?limit=500")
        .then((r) => r.json())
        .then((d) => setStaffList(d.users || []));
    }
  }, [targetType]);

  function toggleRole(role: string) {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function toggleRecipient(id: string) {
    setRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  async function handleForward() {
    if (!forwardNote.trim()) {
      setMsg({ text: "Please add a forwarding note (your message to the new recipients).", ok: false });
      return;
    }
    if (targetType === "roles" && targetRoles.length === 0) {
      setMsg({ text: "Select at least one role.", ok: false });
      return;
    }
    if (targetType === "specific" && recipientIds.length === 0) {
      setMsg({ text: "Select at least one person.", ok: false });
      return;
    }
    if (targetType === "department" && !targetDeptId) {
      setMsg({ text: "Select a department.", ok: false });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/memos/${originalMemo.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forwardNote,
          targetType,
          targetDeptId:  targetType === "department" ? targetDeptId  : undefined,
          targetRoles:   targetType === "roles"      ? targetRoles   : undefined,
          recipientIds:  targetType === "specific"   ? recipientIds  : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onForwarded();
      } else {
        setMsg({ text: data.error || "Forwarding failed.", ok: false });
      }
    } catch {
      setMsg({ text: "Network error. Please try again.", ok: false });
    } finally {
      setSubmitting(false);
    }
  }

  const filteredStaff = staffList.filter((u) =>
    u.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    (u.department?.name || "").toLowerCase().includes(staffSearch.toLowerCase())
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 660, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Forward Memo</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {msg.text && (
          <div style={{ background: msg.ok ? "var(--accent-bg)" : "#1f0707", border: `0.5px solid ${msg.ok ? "var(--accent-border)" : "#7f1d1d"}`, color: msg.ok ? "var(--accent-text)" : "#f87171", borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16 }}>
            {msg.text}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Original memo subject</label>
          <div style={{ ...inp, background: "var(--bg-input)", opacity: 0.7 }}>
            FWD: {originalMemo.subject}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Your forwarding note / instruction <span style={{ color: "#f87171" }}>*</span></label>
          <textarea
            style={{ ...inp, resize: "none", minHeight: 100 } as any}
            value={forwardNote}
            onChange={(e) => setForwardNote(e.target.value)}
            placeholder="Add your message to the new recipients (e.g., 'Please review the forwarded memo and take action...')"
            required
          />
        </div>

        <details style={{ marginBottom: 16, fontSize: 13, color: "var(--text-muted)" }}>
          <summary style={{ cursor: "pointer" }}>Show original memo</summary>
          <div style={{ background: "var(--bg-input)", borderRadius: 8, padding: 12, marginTop: 8, maxHeight: 150, overflowY: "auto" }}>
            {originalMemo.body}
          </div>
        </details>

        <label style={lbl}>Forward to</label>
        <select style={inp} value={targetType} onChange={(e) => setTargetType(e.target.value as any)}>
          <option value="all">All staff</option>
          <option value="department">Specific department</option>
          <option value="roles">Specific roles</option>
          <option value="specific">Specific individuals</option>
        </select>

        {targetType === "department" && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Department</label>
            <select style={inp} value={targetDeptId} onChange={(e) => setTargetDeptId(e.target.value)}>
              <option value="">- Choose -</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        {targetType === "roles" && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Roles</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MEMO_ROLES.map(role => {
                const rs = ROLE_BG[role] || ROLE_BG.STAFF;
                const selected = targetRoles.includes(role);
                return (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    style={{
                      padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      border: selected ? `1.5px solid ${rs.border}` : "0.5px solid var(--border)",
                      background: selected ? rs.bg : "var(--bg-input)",
                      color: selected ? rs.color : "var(--text-muted)",
                    }}
                  >
                    {role.charAt(0) + role.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {targetType === "specific" && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Select recipients ({recipientIds.length} selected)</label>
            <input style={{ ...inp, marginBottom: 8 }} placeholder="Search staff..." value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} />
            <div style={{ maxHeight: 220, overflowY: "auto", border: "0.5px solid var(--border)", borderRadius: 10, padding: 4 }}>
              {filteredStaff.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: "var(--text-hint)", fontSize: 13 }}>No staff found</div>
              ) : (
                filteredStaff.map(u => {
                  const selected = recipientIds.includes(u.id);
                  return (
                    <div key={u.id} onClick={() => toggleRecipient(u.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", background: selected ? "#052e16" : "transparent" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: selected ? "var(--accent-bg)" : "var(--bg-input)", border: `1.5px solid ${selected ? "var(--accent-border)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                        {u.name.slice(0,2).toUpperCase()}
                      </div>
                      <div><div style={{ fontSize: 13, fontWeight: 600, color: selected ? "#4ade80" : "var(--text-primary)" }}>{u.name}</div><div style={{ fontSize: 11, color: "var(--text-hint)" }}>{u.role} {u.department && `· ${u.department.name}`}</div></div>
                      {selected && <span style={{ fontSize: 14, color: "#4ade80", marginLeft: "auto" }}>✓</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 16, borderTop: "0.5px solid var(--border-soft)", paddingTop: 16 }}>
          <button onClick={onClose} style={{ padding: "11px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={handleForward} disabled={submitting} style={{ padding: "11px 28px", borderRadius: 10, border: "1.5px solid #3b82f6", background: "#0c1a2e", color: "#60a5fa", fontWeight: 600 }}>{submitting ? "Forwarding..." : "Forward Memo"}</button>
        </div>
      </div>
    </div>
  );
}
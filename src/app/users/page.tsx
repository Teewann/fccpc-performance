"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/components/ui/ToastProvider";

type User = {
  id: string; name: string; email: string; phone: string | null;
  role: string; staffId: string | null; jobTitle: string | null;
  gradeLevel: string | null; userIdRef: string | null;
  department: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  createdAt: string;
};
type Department = { id: string; name: string };
type Unit = { id: string; name: string; departmentId: string };

const ROLES = ["STAFF","SUPERVISOR","HR","DIRECTOR","ADMIN","EXECUTIVE","CHIEF","IT_SIWES","CORPER","CONTRACT","CONSULTANT","OTHER","INTERN"];

const ROLE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  STAFF:      { bg: "#1a1d28", color: "#9ca3af", border: "#374151" },
  SUPERVISOR: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
  HR:         { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95" },
  DIRECTOR:   { bg: "#1c1107", color: "#f59e0b", border: "#78350f" },
  ADMIN:      { bg: "#052e16", color: "#4ade80", border: "#14532d" },
  EXECUTIVE:  { bg: "#1f0707", color: "#f87171", border: "#7f1d1d" },
  CHIEF:      { bg: "#0f172a", color: "#e879f9", border: "#701a75" },
  IT_SIWES:   { bg: "#0a1a1a", color: "#2dd4bf", border: "#134e4a" },
  CORPER:     { bg: "#1c1a0a", color: "#facc15", border: "#713f12" },
  CONTRACT:   { bg: "#1a0a2e", color: "#c084fc", border: "#6b21a8" },
  CONSULTANT: { bg: "#0f1a0f", color: "#86efac", border: "#166534" },
  OTHER:      { bg: "#1a1a1a", color: "#d1d5db", border: "#4b5563" },
  INTERN:     { bg: "#0a1020", color: "#93c5fd", border: "#1e40af" },
};

const JOB_TITLES = [
  "Executive Vice Chairman / Chief Executive","Executive Commissioner (Operations)","Executive Commissioner (Corporate Services)",
  "Director","Acting Director (Ag.)","Head of Department","Acting Head of Department (Ag.)","Deputy Director",
  "Assistant Director","Head of Unit","Acting Head of Unit (Ag.)","Senior Officer","Principal Officer",
  "Officer","Junior Officer","Administrative Officer","Executive Officer","Legal Officer","Audit Officer",
  "Finance Officer","HR Officer","Research Officer","Investigation Officer","Enforcement Officer","IT Officer",
  "Support Staff","NYSC Corp Member","IT/SIWES Intern","Consultant","Contract Staff","Other",
];

const inp: React.CSSProperties = {
  width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
  borderRadius: 10, padding: "10px 13px", fontSize: 14, color: "var(--text-primary)",
  outline: "none", boxSizing: "border-box",
};
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label style={lbl}>{label}</label>{children}</div>;
}

/* ─── Pagination control — used twice (top + bottom) ──────────────── */
function Pagination({
  page, pages, total, onPrev, onNext,
}: {
  page: number; pages: number; total: number;
  onPrev: () => void; onNext: () => void;
}) {
  if (pages <= 1) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
        marginBottom: 12,
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "#60a5fa" }}>
        Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total} users
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={onPrev}
          disabled={page === 1}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: page === 1 ? "not-allowed" : "pointer",
            border: page === 1 ? "0.5px solid var(--border)" : "1.5px solid #60a5fa",
            background: page === 1 ? "var(--bg-input)" : "#0c1a2e",
            color: page === 1 ? "var(--text-hint)" : "#60a5fa",
            opacity: page === 1 ? 0.5 : 1,
            transition: "all 0.15s",
          }}
        >
          ← Previous
        </button>
        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, padding: "0 12px" }}>
          Page {page} of {pages}
        </span>
        <button
          onClick={onNext}
          disabled={page === pages}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: page === pages ? "not-allowed" : "pointer",
            border: page === pages ? "0.5px solid var(--border)" : "1.5px solid #60a5fa",
            background: page === pages ? "var(--bg-input)" : "#0c1a2e",
            color: page === pages ? "var(--text-hint)" : "#60a5fa",
            opacity: page === pages ? 0.5 : 1,
            transition: "all 0.15s",
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function EditModal({
  user, departments, units, onClose, onSaved,
}: {
  user: User; departments: Department[]; units: Unit[];
  onClose: () => void; onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: user.name, email: user.email, phone: user.phone || "",
    role: user.role, jobTitle: user.jobTitle || "", staffId: user.staffId || "",
    gradeLevel: user.gradeLevel || "", departmentId: user.department?.id || "",
    unitId: user.unit?.id || "", newPassword: "", confirmPassword: "",
    sendResetEmail: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const filteredUnits = units.filter(u => u.departmentId === form.departmentId);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword && form.newPassword !== form.confirmPassword) { showToast("Passwords don't match", false); return; }
    if (form.newPassword && form.newPassword.length < 8) { showToast("Password needs 8+ characters", false); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...form }),
      });
      const data = await res.json();
      if (res.ok) { showToast("User updated"); onSaved(); onClose(); }
      else showToast(data.error || "Failed", false);
    } finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm(`Delete ${user.name} permanently? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users?id=${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) { showToast("User deleted"); onSaved(); onClose(); }
      else showToast(data.error || "Failed to delete", false);
    } finally { setDeleting(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div style={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 580, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Edit User</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{user.userIdRef}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={save}>
          <div className="edit-form-grid">
            <Field label="Full Name *">
              <input style={inp} value={form.name} onChange={e => set("name", e.target.value)} required />
            </Field>
            <Field label="Email Address *">
              <input type="email" style={inp} value={form.email} onChange={e => set("email", e.target.value)} required />
            </Field>
            <Field label="Phone">
              <input style={inp} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+234..." />
            </Field>
            <Field label="Staff ID">
              <input style={inp} value={form.staffId} onChange={e => set("staffId", e.target.value)} />
            </Field>
            <Field label="Grade Level">
              <input style={inp} value={form.gradeLevel} onChange={e => set("gradeLevel", e.target.value)} placeholder="GL 08, Step 4..." />
            </Field>
            <Field label="Role *">
              <select style={inp} value={form.role} onChange={e => set("role", e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <div style={{ gridColumn: "1/-1" }}>
              <Field label="Job Title">
                <select style={inp} value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)}>
                  <option value="">— Select —</option>
                  {JOB_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Department">
              <select style={inp} value={form.departmentId} onChange={e => set("departmentId", e.target.value)}>
                <option value="">None</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Unit">
              <select style={inp} value={form.unitId} onChange={e => set("unitId", e.target.value)} disabled={!form.departmentId}>
                <option value="">None</option>
                {filteredUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>

            <div style={{ gridColumn: "1/-1", paddingTop: 14, borderTop: "0.5px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12 }}>Password Reset (leave blank to keep current)</div>
              <div className="edit-form-grid">
                <Field label="New Password">
                  <div style={{ position: "relative" }}>
                    <input type={showPw ? "text" : "password"} style={{ ...inp, paddingRight: 40 }} value={form.newPassword} onChange={e => set("newPassword", e.target.value)} placeholder="8+ characters" />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14 }}>
                      {showPw ? "🙈" : "👁"}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm Password">
                  <input type="password" style={{ ...inp, borderColor: form.confirmPassword && form.confirmPassword !== form.newPassword ? "#ef4444" : form.confirmPassword ? "#22c55e" : "var(--border)" }}
                    value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} placeholder="Re-enter" />
                </Field>
              </div>
              {form.newPassword && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.sendResetEmail} onChange={e => set("sendResetEmail", e.target.checked)} />
                  Send email notification to user
                </label>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: "10px 24px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button type="button" onClick={del} disabled={deleting} style={{ marginLeft: "auto", padding: "10px 18px", borderRadius: 10, border: "0.5px solid #7f1d1d", background: "#1f0707", color: "#f87171", fontSize: 14, cursor: "pointer" }}>
              {deleting ? "Deleting…" : "Delete User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateModal({ departments, units, onClose, onCreated }: {
  departments: Department[]; units: Unit[]; onClose: () => void; onCreated: () => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "STAFF", jobTitle: "", staffId: "", phone: "", gradeLevel: "", departmentId: "", unitId: "" });
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const filteredUnits = units.filter(u => u.departmentId === form.departmentId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { showToast("Passwords don't match", false); return; }
    if (form.password.length < 8) { showToast("Password needs 8+ characters", false); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { showToast(`${form.name} created`); onCreated(); onClose(); }
      else showToast(data.error || "Failed", false);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div style={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 580, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Create New User</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="edit-form-grid">
            <Field label="Full Name *"><input style={inp} value={form.name} onChange={e => set("name", e.target.value)} required /></Field>
            <Field label="Email *"><input type="email" style={inp} value={form.email} onChange={e => set("email", e.target.value)} required /></Field>
            <Field label="Phone"><input style={inp} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+234..." /></Field>
            <Field label="Staff ID"><input style={inp} value={form.staffId} onChange={e => set("staffId", e.target.value)} /></Field>
            <Field label="Grade Level"><input style={inp} value={form.gradeLevel} onChange={e => set("gradeLevel", e.target.value)} /></Field>
            <Field label="Role *">
              <select style={inp} value={form.role} onChange={e => set("role", e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <div style={{ gridColumn: "1/-1" }}>
              <Field label="Job Title">
                <select style={inp} value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)}>
                  <option value="">— Select —</option>
                  {JOB_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Department">
              <select style={inp} value={form.departmentId} onChange={e => set("departmentId", e.target.value)}>
                <option value="">None</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Unit">
              <select style={inp} value={form.unitId} onChange={e => set("unitId", e.target.value)} disabled={!form.departmentId}>
                <option value="">None</option>
                {filteredUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Password *">
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} style={{ ...inp, paddingRight: 40 }} value={form.password} onChange={e => set("password", e.target.value)} required placeholder="8+ characters" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>{showPw ? "🙈" : "👁"}</button>
              </div>
            </Field>
            <Field label="Confirm Password *">
              <input type="password" style={{ ...inp, borderColor: form.confirmPassword && form.confirmPassword !== form.password ? "#ef4444" : form.confirmPassword ? "#22c55e" : "var(--border)" }}
                value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} required autoComplete="new-password" />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: "10px 24px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              {saving ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers]           = useState<User[]>([]);
  const [departments, setDepts]     = useState<Department[]>([]);
  const [units, setUnits]           = useState<Unit[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editUser, setEditUser]     = useState<User | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch]         = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [page, setPage]   = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // NEW — force fresh modals each time they open, so form state doesn't
  // leak from the previous create/edit attempt.
  const [createKey, setCreateKey] = useState(0);
  const [editKey,   setEditKey]   = useState(0);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search ? { search } : {}),
        ...(filterRole !== "ALL" ? { role: filterRole } : {}),
      });
      let res = await fetch(`/api/users?${params}`);
      if (!res.ok) {
        await new Promise(r => setTimeout(r, 800));
        res = await fetch(`/api/users?${params}`);
      }
      const data = await res.json();
      setUsers(data.users || []);
      setDepts(data.departments || []);
      setUnits(data.units || []);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch {
      setUsers([]);
    } finally { setLoading(false); }
  }, [search, filterRole, page]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const roleCounts = ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-page)" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "clamp(12px, 3vw, 24px)", minWidth: 0, overflowX: "hidden" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: "clamp(20px, 4vw, 26px)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>User Management</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{total} users registered</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/staff-directory" style={{ padding: "9px 18px", borderRadius: 10, border: "0.5px solid #1e3a5f", background: "#0c1a2e", color: "#60a5fa", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" }}>
              👥 Staff Directory
            </Link>
            <button onClick={() => { setCreateKey(k => k + 1); setShowCreate(true); }} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              + New User
            </button>
            <ThemeToggleButton />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {["ALL", ...ROLES].map(r => {
            const count = r === "ALL" ? total : (roleCounts[r] || 0);
            const rs = ROLE_STYLES[r];
            const active = filterRole === r;
            return (
              <button key={r} onClick={() => { setFilterRole(r); setPage(1); }} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", cursor: "pointer",
                border: `0.5px solid ${active ? (rs?.border || "var(--accent)") : "var(--border)"}`,
                background: active ? (rs?.bg || "var(--accent-bg)") : "var(--bg-card)",
                color: active ? (rs?.color || "var(--accent-text)") : "var(--text-muted)",
              }}>
                {r === "ALL" ? "All" : r.replace("_", "/")} ({count})
              </button>
            );
          })}
        </div>

        <input
          style={{ ...inp, marginBottom: 16 }}
          placeholder="Search name, email, staff ID, job title…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />

        {/* ── Pagination — top of list ── */}
        <Pagination
          page={page}
          pages={pages}
          total={total}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(pages, p + 1))}
        />

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>No users found</div>
        ) : (
          <>
            <div className="users-desktop-table" style={{ borderRadius: 12, overflow: "hidden", border: "0.5px solid var(--border)", overflowX: "auto" }}>
              <div className="users-row-grid" style={{ padding: "10px 16px", background: "var(--bg-input)", borderBottom: "0.5px solid var(--border)", minWidth: 720 }}>
                {["Name & Title", "Email", "Department", "Role", "Grade", "Actions"].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
                ))}
              </div>
              {users.map((u, i) => {
                const rs = ROLE_STYLES[u.role] || ROLE_STYLES.STAFF;
                return (
                  <div key={u.id} className="users-row-grid" style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-input)", minWidth: 720 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <UserAvatar user={{ name: u.name }} userId={u.id} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.jobTitle || u.staffId || "—"}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.department?.name || "—"}</div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 82, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: rs.bg, color: rs.color, border: `0.5px solid ${rs.border}`, whiteSpace: "nowrap" }}>
                        {u.role.replace("_", "/")}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.gradeLevel || "—"}</div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => { setEditKey(k => k + 1); setEditUser(u); }} style={{ padding: "5px 14px", borderRadius: 7, border: "0.5px solid #1e3a5f", background: "#0c1a2e", color: "#60a5fa", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="users-mobile-cards" style={{ flexDirection: "column", gap: 10 }}>
              {users.map(u => {
                const rs = ROLE_STYLES[u.role] || ROLE_STYLES.STAFF;
                return (
                  <div key={u.id} style={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                    <UserAvatar user={{ name: u.name }} userId={u.id} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: rs.bg, color: rs.color, border: `0.5px solid ${rs.border}` }}>{u.role.replace("_", "/")}</span>
                        {u.department && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.department.name}</span>}
                      </div>
                    </div>
                    <button onClick={() => { setEditKey(k => k + 1); setEditUser(u); }} style={{ padding: "7px 14px", borderRadius: 8, border: "0.5px solid #1e3a5f", background: "#0c1a2e", color: "#60a5fa", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Pagination — bottom of list ── */}
        <Pagination
          page={page}
          pages={pages}
          total={total}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(pages, p + 1))}
        />
      </main>

      {showCreate && (
        <CreateModal
          key={createKey}
          departments={departments}
          units={units}
          onClose={() => setShowCreate(false)}
          onCreated={loadUsers}
        />
      )}
      {editUser && (
        <EditModal
          key={editKey}
          user={editUser}
          departments={departments}
          units={units}
          onClose={() => setEditUser(null)}
          onSaved={loadUsers}
        />
      )}

      <style>{`
        .edit-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 560px) {
          .edit-form-grid {
            grid-template-columns: 1fr;
          }
        }

        .users-row-grid {
          display: grid;
          grid-template-columns: 2fr 2fr 2fr 1.2fr 0.9fr 0.8fr;
          align-items: center;
        }

        .users-desktop-table { display: block; }
        .users-mobile-cards  { display: none; }

        @media (max-width: 700px) {
          .users-desktop-table { display: none; }
          .users-mobile-cards  { display: flex; }
        }
      `}</style>
    </div>
  );
}
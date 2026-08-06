"use client";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import UserAvatar from "@/components/UserAvatar";

// ─── Types ────────────────────────────────────────────────────────────
type User = {
  id: string; name: string; email: string; phone: string | null;
  role: string; staffId: string | null;
  jobTitle: string | null;
  gradeLevel: string | null;   // ← added
  userIdRef: string | null;
  department: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  createdAt: string;
};
type Department = { id: string; name: string };
type Unit = { id: string; name: string; departmentId: string };

// ─── Roles (added CHIEF) ──────────────────────────────────────────────
const ROLES = [
  "STAFF","SUPERVISOR","HR","DIRECTOR","ADMIN","EXECUTIVE","CHIEF",
  "IT_SIWES","CORPER","CONTRACT","CONSULTANT","OTHER","INTERN",
];

// ─── Job Titles (unchanged, can be extended) ─────────────────────────
const JOB_TITLE_GROUPS: { group: string; titles: string[] }[] = [
  {
    group: "Executive",
    titles: [
      "Executive Vice Chairman / Chief Executive",
      "Executive Commissioner (Operations)",
      "Executive Commissioner (Corporate Services)",
    ],
  },
  {
    group: "Director Level",
    titles: [
      "Director", "Acting Director (Ag.)", "Consultant/Contract Director", "Director (Special Duties)",
    ],
  },
  {
    group: "Head of Department / Unit",
    titles: [
      "Head of Department", "Acting Head of Department (Ag.)", "Head of Unit", "Acting Head of Unit (Ag.)",
    ],
  },
  {
    group: "Assistant Director",
    titles: [
      "Assistant Director", "Acting Assistant Director (Ag.)",
    ],
  },
  {
    group: "Senior Officers",
    titles: [
      "Deputy Director", "Senior Superintendent", "Principal Officer", "Senior Officer",
      "Senior Special Assistant", "Special Assistant",
    ],
  },
  {
    group: "Officers",
    titles: [
      "Officer", "Junior Officer", "Administrative Officer", "Executive Officer",
      "IT Officer", "Legal Officer", "Audit Officer", "Finance Officer", "HR Officer",
      "Research Officer", "Investigation Officer", "Enforcement Officer",
    ],
  },
  {
    group: "Support / Attachments",
    titles: [
      "Support Staff", "NYSC Corp Member", "IT/SIWES Intern", "Consultant", "Contract Staff", "Other",
    ],
  },
];

const ALL_JOB_TITLES = JOB_TITLE_GROUPS.flatMap((g) => g.titles);

const ROLE_SUGGESTED_TITLES: Record<string, string[]> = {
  EXECUTIVE:  ["Executive Vice Chairman / Chief Executive", "Executive Commissioner (Operations)", "Executive Commissioner (Corporate Services)"],
  DIRECTOR:   ["Director", "Acting Director (Ag.)", "Consultant/Contract Director", "Director (Special Duties)", "Head of Department", "Acting Head of Department (Ag.)", "Deputy Director", "Assistant Director", "Acting Assistant Director (Ag.)"],
  SUPERVISOR: ["Head of Unit", "Acting Head of Unit (Ag.)", "Senior Officer", "Principal Officer", "Senior Superintendent"],
  HR:         ["HR Officer", "Senior Officer", "Principal Officer", "Head of Department", "Head of Unit"],
  STAFF:      ["Officer", "Junior Officer", "Administrative Officer", "Executive Officer", "Legal Officer", "Audit Officer", "Finance Officer", "Research Officer", "Investigation Officer", "Enforcement Officer", "IT Officer", "Senior Officer", "Support Staff"],
  ADMIN:      ["Director", "Head of Department", "Administrative Officer", "Officer"],
  CHIEF:      ["Chief of Staff", "Chief Operating Officer", "Chief Technology Officer", "Chief Financial Officer"],
  CORPER:     ["NYSC Corp Member"],
  IT_SIWES:   ["IT/SIWES Intern"],
  CONTRACT:   ["Contract Staff", "Consultant/Contract Director", "Consultant"],
  CONSULTANT: ["Consultant", "Consultant/Contract Director"],
  INTERN:     ["IT/SIWES Intern", "Support Staff", "Other"],
  OTHER:      ["Other", "Support Staff", "Contract Staff"],
};

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

const emptyForm = {
  name: "", email: "", password: "", confirmPassword: "",
  role: "STAFF", jobTitle: "", staffId: "", departmentId: "", unitId: "", phone: "", gradeLevel: "",
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
  borderRadius: 10, padding: "11px 14px", fontSize: 15, color: "var(--text-primary)",
  outline: "none", boxSizing: "border-box", marginBottom: 12,
};
const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600,
  color: "var(--text-muted)", display: "block", marginBottom: 5,
};

type Toast = { id: number; text: string; ok: boolean };
let _toastId = 0;

function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, minWidth: 300, maxWidth: 420, background: t.ok ? "#052e16" : "#1f0707", border: `1px solid ${t.ok ? "#14532d" : "#7f1d1d"}`, color: t.ok ? "#4ade80" : "#f87171", fontSize: 14, fontWeight: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", pointerEvents: "all", animation: "slideIn 0.2s ease" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{t.ok ? "✓" : "✕"}</span>
          <span style={{ flex: 1 }}>{t.text}</span>
          <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, opacity: 0.7, padding: 0 }}>✕</button>
        </div>
      ))}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }`}</style>
    </div>
  );
}

function FormContent({ data, setData, isEdit = false, departments, units }: any) {
  const filteredUnits = units.filter((u: Unit) => u.departmentId === data.departmentId);
  const suggestedTitles = ROLE_SUGGESTED_TITLES[data.role] || ALL_JOB_TITLES;
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordVal = isEdit ? data.newPassword : data.password;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div><label style={labelStyle}>Full name *</label><input style={inputStyle} value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="e.g. Amaka Okafor" autoComplete="off" required /></div>
      {!isEdit && <div><label style={labelStyle}>Email address *</label><input style={inputStyle} type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="staff@fccpc.gov.ng" autoComplete="off" required /></div>}
      <div><label style={labelStyle}>Phone number</label><input style={inputStyle} value={data.phone || ""} onChange={(e) => setData({ ...data, phone: e.target.value })} placeholder="+234 800 123 4567" /></div>
      <div><label style={labelStyle}>Staff ID</label><input style={inputStyle} value={data.staffId} onChange={(e) => setData({ ...data, staffId: e.target.value })} placeholder="FCCPC/CBE/001" /></div>
      <div><label style={labelStyle}>Grade Level</label><input style={inputStyle} value={data.gradeLevel || ""} onChange={(e) => setData({ ...data, gradeLevel: e.target.value })} placeholder="e.g. GL 08, Step 4, etc." /></div>
      <div>
        <label style={labelStyle}>Role / Access level *</label>
        <select style={inputStyle} value={data.role} onChange={(e) => setData({ ...data, role: e.target.value })} required>
          {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase().replace("_", "/")}</option>)}
        </select>
        <div style={{ fontSize: 11, color: "var(--text-hint)", marginTop: -8, marginBottom: 8 }}>This controls system permissions. Use job title below for display.</div>
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <label style={labelStyle}>Job title / Position *</label>
        <select style={{ ...inputStyle, borderColor: !data.jobTitle ? "#f59e0b" : "var(--border)" }} value={data.jobTitle} onChange={(e) => setData({ ...data, jobTitle: e.target.value })} required>
          <option value="">— Select job title —</option>
          <optgroup label={`— Suggested for ${data.role.charAt(0) + data.role.slice(1).toLowerCase()} —`}>
            {suggestedTitles.map((t: string) => <option key={t} value={t}>{t}</option>)}
          </optgroup>
          <optgroup label="— All other titles —">
            {ALL_JOB_TITLES.filter((t) => !suggestedTitles.includes(t)).map((t) => <option key={t} value={t}>{t}</option>)}
          </optgroup>
        </select>
        {data.jobTitle && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: -6, marginBottom: 10, padding: "8px 12px", background: "var(--accent-bg)", borderRadius: 8, border: "0.5px solid var(--accent-border)" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Will display as:</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-text)" }}>{data.name || "Staff name"} — {data.jobTitle}</span>
          </div>
        )}
      </div>
      <div><label style={labelStyle}>Department</label><select style={inputStyle} value={data.departmentId} onChange={(e) => setData({ ...data, departmentId: e.target.value, unitId: "" })}><option value="">No department</option>{departments.map((d: Department) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      {data.departmentId && <div><label style={labelStyle}>Unit</label><select style={inputStyle} value={data.unitId} onChange={(e) => setData({ ...data, unitId: e.target.value })}><option value="">No unit</option>{filteredUnits.map((u: Unit) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
      <div>
        <label style={labelStyle}>{isEdit ? "New password (leave blank to keep)" : "Password *"}</label>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <input type={showPass ? "text" : "password"} value={passwordVal || ""} onChange={(e) => setData({ ...data, [isEdit ? "newPassword" : "password"]: e.target.value })} placeholder={isEdit ? "Enter to change..." : "Minimum 8 characters"} autoComplete="new-password" required={!isEdit} style={{ ...inputStyle, marginBottom: 0, paddingRight: 48 }} />
          <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 15 }}>{showPass ? "🙈" : "👁"}</button>
        </div>
      </div>
      <div>
        <label style={labelStyle}>{isEdit ? "Confirm new password" : "Confirm password *"}</label>
        <div style={{ position: "relative", marginBottom: 0 }}>
          <input type={showConfirm ? "text" : "password"} value={data.confirmPassword || ""} onChange={(e) => setData({ ...data, confirmPassword: e.target.value })} placeholder="Re-enter password" autoComplete="new-password" required={!isEdit} style={{ ...inputStyle, marginBottom: 0, paddingRight: 48, borderColor: data.confirmPassword && data.confirmPassword !== passwordVal ? "#ef4444" : data.confirmPassword && data.confirmPassword === passwordVal ? "#22c55e" : "var(--border)" }} />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 15 }}>{showConfirm ? "🙈" : "👁"}</button>
        </div>
        {data.confirmPassword && <div style={{ fontSize: 12, marginTop: 4, color: data.confirmPassword === passwordVal ? "#4ade80" : "#f87171", fontWeight: 500 }}>{data.confirmPassword === passwordVal ? "✓ Passwords match" : "✕ Passwords do not match"}</div>}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<User | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ name: "", role: "STAFF", jobTitle: "", staffId: "", departmentId: "", unitId: "", phone: "", gradeLevel: "", newPassword: "", confirmPassword: "" });
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(text: string, ok = true) {
    const id = ++_toastId;
    setToasts((p) => [...p, { id, text, ok }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  }
  function removeToast(id: number) { setToasts((p) => p.filter((t) => t.id !== id)); }

  useEffect(() => { setShowEdit(false); setShowCreate(false); }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(search ? { search } : {}),
        ...(filterRole !== "ALL" ? { role: filterRole } : {}),
      });
      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
      setDepartments(data.departments || []);
      setUnits(data.units || []);
    } finally { setLoading(false); }
  }, [search, filterRole]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function closeCreate() { setShowCreate(false); setForm(emptyForm); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.jobTitle) { showToast("Please select a job title.", false); return; }
    if (form.password !== form.confirmPassword) { showToast("Passwords do not match.", false); return; }
    if (form.password.length < 8) { showToast("Password must be at least 8 characters.", false); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { showToast(`${form.name} created successfully.`); setForm(emptyForm); setShowCreate(false); fetchUsers(); }
      else { showToast(data.error || "Failed to create user.", false); }
    } finally { setSubmitting(false); }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (editForm.newPassword) {
      if (editForm.newPassword !== editForm.confirmPassword) { showToast("Passwords do not match.", false); return; }
      if (editForm.newPassword.length < 8) { showToast("Password must be at least 8 characters.", false); return; }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selected.id, ...editForm }) });
      const data = await res.json();
      if (res.ok) { showToast("User updated successfully."); setShowEdit(false); fetchUsers(); }
      else { showToast(data.error || "Failed.", false); }
    } finally { setSubmitting(false); }
  }

  async function handleDelete(userId: string) {
    const confirmed = window.confirm("⚠️ Delete this user permanently? This action cannot be undone.");
    if (!confirmed) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: "DELETE" });
      if (res.ok) { showToast("User deleted."); fetchUsers(); setSelected(null); setShowEdit(false); }
      else { showToast("Failed to delete user.", false); }
    } finally { setSubmitting(false); }
  }

  function openEdit(user: User) {
    setSelected(user);
    setEditForm({
      name: user.name, role: user.role, jobTitle: user.jobTitle || "",
      staffId: user.staffId || "", departmentId: user.department?.id || "",
      unitId: user.unit?.id || "", phone: user.phone || "", gradeLevel: user.gradeLevel || "",
      newPassword: "", confirmPassword: "",
    });
    setShowEdit(true);
  }

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <ToastContainer toasts={toasts} remove={removeToast} />
      <main className="flex-1 p-6 min-w-0">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>User Management</h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{today} · {users.length} registered users</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={() => { setShowCreate(true); setShowEdit(false); }} style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>+ Create user</button>
            <ThemeToggleButton />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {["ALL", ...ROLES].map((r) => {
            const count = r === "ALL" ? users.length : users.filter((u) => u.role === r).length;
            const rs = ROLE_STYLES[r];
            return (
              <button key={r} onClick={() => setFilterRole(r)} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, border: `0.5px solid ${filterRole === r ? (rs?.border || "var(--accent)") : "var(--border)"}`, background: filterRole === r ? (rs?.bg || "var(--accent-bg)") : "var(--bg-card)", color: filterRole === r ? (rs?.color || "var(--accent-text)") : "var(--text-muted)", cursor: "pointer" }}>
                {r === "ALL" ? "All" : r.charAt(0) + r.slice(1).toLowerCase().replace("_", "/")} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 18 }}>
          <input style={{ ...inputStyle, width: "100%", marginBottom: 0 }} placeholder="Search name, email, staff ID, job title, phone..." value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
        </div>

        {showCreate && (
          <div style={{ borderRadius: 14, padding: 28, marginBottom: 20, background: "var(--bg-card)", border: "0.5px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Create new user</h2>
              <button onClick={closeCreate} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleCreate} autoComplete="off">
              <FormContent data={form} setData={setForm} departments={departments} units={units} />
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button type="button" onClick={closeCreate} style={{ padding: "11px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "11px 28px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{submitting ? "Creating..." : "Create user"}</button>
              </div>
            </form>
          </div>
        )}

        {showEdit && selected && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                <div><h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Edit — {selected.name}</h2>{selected.jobTitle && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>Current title: <strong style={{ color: "var(--text-primary)" }}>{selected.jobTitle}</strong></div>}</div>
                <button onClick={() => setShowEdit(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
              <form onSubmit={handleEdit} autoComplete="off">
                <FormContent data={editForm} setData={setEditForm} isEdit departments={departments} units={units} />
                <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setShowEdit(false)} style={{ padding: "11px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={submitting} style={{ padding: "11px 28px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{submitting ? "Saving..." : "Save changes"}</button>
                  <button type="button" onClick={() => handleDelete(selected.id)} disabled={submitting} style={{ marginLeft: "auto", padding: "11px 20px", borderRadius: 10, border: "0.5px solid #7f1d1d", background: "#1f0707", color: "#f87171", fontSize: 14, cursor: "pointer" }}>Delete user</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div style={{ borderRadius: 14, overflow: "hidden", background: "var(--bg-card)", border: "0.5px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 0.9fr 1.1fr 0.9fr 1fr 0.9fr 0.8fr 0.6fr", padding: "12px 20px", borderBottom: "0.5px solid var(--border-soft)", background: "var(--bg-input)" }}>
            {["Name & Title", "Email", "Phone", "Department", "Unit", "User ID", "Role", "Grade Level", "Actions"].map((h) => <div key={h} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>)}
          </div>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", fontSize: 15, color: "var(--text-muted)" }}>Loading users...</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 56, textAlign: "center" }}><div style={{ fontSize: 36, marginBottom: 12 }}>👥</div><div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)" }}>No users found</div></div>
          ) : (
            users.map((user, i) => {
              const rs = ROLE_STYLES[user.role] || ROLE_STYLES.STAFF;
              const isActing = user.jobTitle?.includes("Acting") || user.jobTitle?.includes("Ag.");
              return (
                <div key={user.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 0.9fr 1.1fr 0.9fr 1fr 0.9fr 0.8fr 0.6fr", padding: "14px 20px", borderBottom: "0.5px solid var(--border-soft)", background: i % 2 === 0 ? "transparent" : "var(--bg-input)", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <UserAvatar user={{ name: user.name, photo: null }} size={34} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{user.name}{isActing && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: "#1c1107", color: "#f59e0b", border: "0.5px solid #78350f" }}>Ag.</span>}</div>
                      <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{user.jobTitle || user.staffId || "No title set"}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.email}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.phone || "—"}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.department?.name || "—"}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.unit?.name || "—"}</div>
                  <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: "bold", color: "#ef4444" }}>{user.userIdRef || "—"}</div>
                  <div><span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, background: rs.bg, color: rs.color, border: `0.5px solid ${rs.border}` }}>{user.role.charAt(0) + user.role.slice(1).toLowerCase().replace("_", "/")}</span></div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.gradeLevel || "—"}</div>
                  <div><button onClick={() => openEdit(user)} style={{ padding: "7px 16px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>Edit</button></div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
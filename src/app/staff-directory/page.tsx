"use client";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import UserAvatar from "@/components/UserAvatar";

// ─── Types ────────────────────────────────────────────────────────────
type StaffMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  staffId: string | null;
  role: string;
  gradeLevel: string | null;
  isActive: boolean;
  userIdRef: string | null;
  photo: string | null;        // ← this is returned from API
  department: { id: string; name: string; shortCode: string } | null;
  unit: { id: string; name: string } | null;
  createdAt: string;
};

type Department = { id: string; name: string };

// ─── Role styles (expanded) ─────────────────────────────────────────
const ROLE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  STAFF:      { bg: "#1a1d28", color: "#9ca3af", border: "#374151" },
  SUPERVISOR: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f" },
  DIRECTOR:   { bg: "#1c1107", color: "#f59e0b", border: "#78350f" },
  HR:         { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95" },
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

const ROLE_LABELS: Record<string, string> = {
  STAFF:      "Staff",
  SUPERVISOR: "Supervisor",
  DIRECTOR:   "Director",
  HR:         "HR Officer",
  ADMIN:      "Administrator",
  EXECUTIVE:  "Executive",
  CHIEF:      "Chief",
  IT_SIWES:   "IT/SIWES",
  CORPER:     "Corps Member",
  CONTRACT:   "Contract",
  CONSULTANT: "Consultant",
  OTHER:      "Other",
  INTERN:     "Intern",
};

// ─── Staff Card (using UserAvatar for actual photo) ─────────────────
function StaffCard({
  person, selected, onSelect,
}: {
  person: StaffMember; selected: boolean; onSelect: () => void;
}) {
  const rs = ROLE_STYLES[person.role] || ROLE_STYLES.STAFF;

  return (
    <div
      onClick={onSelect}
      style={{
        borderRadius: 14, padding: "18px 16px", cursor: "pointer",
        background: "var(--bg-card)",
        outline: `0.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        borderTop: `2.5px solid ${selected ? "var(--accent)" : "transparent"}`,
        opacity: person.isActive ? 1 : 0.55,
        transition: "outline 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <UserAvatar user={{ name: person.name, photo: person.photo, image: person.photo }} size={46} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {person.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {person.jobTitle || person.unit?.name || person.department?.name || "FCCPC"}
          </div>
          <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: "bold", color: "#ef4444", marginTop: 4 }}>
            User ID: {person.userIdRef || "—"}
          </div>
        </div>
      </div>

      <span style={{
        display: "inline-block", fontSize: 11, fontWeight: 600,
        padding: "4px 12px", borderRadius: 8, marginBottom: 10,
        background: rs.bg, color: rs.color, border: `0.5px solid ${rs.border}`,
      }}>
        {ROLE_LABELS[person.role] || person.role}
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {person.department && (
          <div style={{ fontSize: 12, color: "var(--text-hint)", display: "flex", gap: 6 }}>
            <span>🏛</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {person.department.name}
            </span>
          </div>
        )}
        <div style={{ fontSize: 12, color: "var(--text-hint)", display: "flex", gap: 6 }}>
          <span>✉️</span>
          <a href={`mailto:${person.email}`} onClick={(e) => e.stopPropagation()} style={{ color: "inherit", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {person.email}
          </a>
        </div>
        {person.phone && (
          <div style={{ fontSize: 12, color: "var(--text-hint)", display: "flex", gap: 6 }}>
            <span>📞</span>
            <a href={`tel:${person.phone.replace(/[^0-9+]/g, "")}`} onClick={(e) => e.stopPropagation()} style={{ color: "inherit", textDecoration: "none" }}>
              {person.phone}
            </a>
          </div>
        )}
        {person.staffId && (
          <div style={{ fontSize: 11, color: "var(--text-hint)", display: "flex", gap: 6 }}>
            <span>🪪</span><span>{person.staffId}</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-hint)", textAlign: "right" }}>
        {selected ? "Click to close ↑" : "Click for details →"}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────
export default function StaffDirectoryPage() {
  const [staff,       setStaff]       = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<StaffMember | null>(null);
  const [search,      setSearch]      = useState("");
  const [filterRole,  setFilterRole]  = useState("ALL");
  const [filterDept,  setFilterDept]  = useState("ALL");
  const [total,       setTotal]       = useState(0);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ directory: "true" });
      if (search               ) params.set("search", search);
      if (filterRole !== "ALL" ) params.set("role",   filterRole);
      if (filterDept !== "ALL" ) params.set("deptId", filterDept);

      const res  = await fetch(`/api/users?${params}`);
      const data = await res.json();
      setStaff(data.users        || []);
      setDepartments(data.departments || []);
      setTotal(data.total        || 0);
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, filterDept]);

  useEffect(() => {
    const t = setTimeout(fetchStaff, 300);
    return () => clearTimeout(t);
  }, [fetchStaff]);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const inp: React.CSSProperties = {
    background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 10, padding: "10px 14px", fontSize: 14,
    color: "var(--text-primary)", outline: "none",
  };

  const isFiltering = !!(search || filterRole !== "ALL" || filterDept !== "ALL");

  const grouped = staff.reduce((acc, person) => {
    const key = person.department?.name || "No Department";
    if (!acc[key]) acc[key] = [];
    acc[key].push(person);
    return acc;
  }, {} as Record<string, StaffMember[]>);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Staff Directory
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · {total} staff members registered
            </p>
          </div>
          <ThemeToggleButton />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...inp, width: 300 }}
            placeholder="Search name, email, staff ID, job title, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
          <select style={{ ...inp, width: 170 }} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="ALL">All roles</option>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select style={{ ...inp, width: 240 }} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="ALL">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {isFiltering && (
            <button
              onClick={() => { setSearch(""); setFilterRole("ALL"); setFilterDept("ALL"); }}
              style={{ ...inp, cursor: "pointer", color: "#f87171", borderColor: "#7f1d1d", background: "#1f070799" }}
            >
              Clear filters
            </button>
          )}
        </div>

        {isFiltering && !loading && (
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
            Showing {staff.length} result{staff.length !== 1 ? "s" : ""}
          </div>
        )}

        {/* Two‑column layout */}
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 20 }}>

          {/* Staff list */}
          <div>
            {loading ? (
              <div style={{ textAlign: "center", padding: 56, color: "var(--text-muted)", fontSize: 15 }}>
                Loading staff directory...
              </div>
            ) : staff.length === 0 ? (
              <div className="card-bg" style={{ borderRadius: 14, padding: 64, textAlign: "center" }}>
                <div style={{ fontSize: 44, marginBottom: 16 }}>👥</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                  No staff found
                </div>
                <div style={{ fontSize: 15, color: "var(--text-muted)" }}>
                  {isFiltering ? "Try adjusting your search or filters" : "No staff accounts have been created yet"}
                </div>
              </div>
            ) : isFiltering ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {staff.map((person) => (
                  <StaffCard
                    key={person.id}
                    person={person}
                    selected={selected?.id === person.id}
                    onSelect={() => setSelected(selected?.id === person.id ? null : person)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {Object.entries(grouped).map(([deptName, members]) => (
                  <div key={deptName}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{deptName}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 8, background: "var(--accent-bg)", color: "var(--accent-text)", border: "0.5px solid var(--accent-border)" }}>
                        {members.length} staff
                      </div>
                      <div style={{ flex: 1, height: "0.5px", background: "var(--border-soft)" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                      {members.map((person) => (
                        <StaffCard
                          key={person.id}
                          person={person}
                          selected={selected?.id === person.id}
                          onSelect={() => setSelected(selected?.id === person.id ? null : person)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel – scrollable, with UserAvatar */}
          {selected && (
            <div
              className="card-bg"
              style={{
                borderRadius: 14,
                padding: 26,
                alignSelf: "start",
                position: "sticky",
                top: 24,
                maxHeight: "80vh",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>Staff profile</h3>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
              </div>

              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <UserAvatar user={{ name: selected.name, photo: selected.photo, image: selected.photo }} size={80} />
                <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  {selected.name}
                </div>
                {selected.jobTitle && (
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 10 }}>{selected.jobTitle}</div>
                )}
                <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: "bold", color: "#ef4444", marginBottom: 10 }}>
                  User ID: {selected.userIdRef || "—"}
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 8,
                    background: (ROLE_STYLES[selected.role] || ROLE_STYLES.STAFF).bg,
                    color:      (ROLE_STYLES[selected.role] || ROLE_STYLES.STAFF).color,
                    border: `0.5px solid ${(ROLE_STYLES[selected.role] || ROLE_STYLES.STAFF).border}`,
                  }}>
                    {ROLE_LABELS[selected.role] || selected.role}
                  </span>
                  {!selected.isActive && (
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 8, background: "#1f0707", color: "#f87171", border: "0.5px solid #7f1d1d" }}>
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {[
                  { icon: "🏛",  label: "Department",   value: selected.department?.name || "Not assigned" },
                  { icon: "🔹",  label: "Unit",          value: selected.unit?.name       || "Not assigned" },
                  { icon: "✉️",  label: "Email",         value: selected.email, isLink: true, link: `mailto:${selected.email}` },
                  { icon: "📞",  label: "Phone",         value: selected.phone || "Not provided", isLink: selected.phone ? true : false, link: selected.phone ? `tel:${selected.phone.replace(/[^0-9+]/g, "")}` : undefined },
                  { icon: "🪪",  label: "Staff ID",      value: selected.staffId || "Not assigned" },
                  { icon: "📊",  label: "Grade level",   value: selected.gradeLevel || "Not assigned" },
                  {
                    icon: "📅",
                    label: "Member since",
                    value: new Date(selected.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric", month: "long", year: "numeric",
                    }),
                  },
                ].map(({ icon, label, value, isLink, link }) => (
                  <div key={label} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: "0.5px solid var(--border-soft)" }}>
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
                        {label}
                      </div>
                      {isLink && link ? (
                        <a href={link} style={{ fontSize: 14, fontWeight: 500, color: "var(--ca)", textDecoration: "none", wordBreak: "break-word", lineHeight: 1.4 }}>
                          {value}
                        </a>
                      ) : (
                        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", wordBreak: "break-word", lineHeight: 1.4 }}>
                          {value}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <a
                href={`mailto:${selected.email}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 8, marginTop: 20, padding: "12px",
                  borderRadius: 10, border: "1.5px solid var(--accent)",
                  background: "var(--accent-bg)", color: "var(--accent-text)",
                  fontSize: 14, fontWeight: 600, textDecoration: "none",
                }}
              >
                ✉️ Send email
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
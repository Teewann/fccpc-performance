"use client";

import { useState, useEffect } from "react";

type StaffOption = { id: string; name: string; email: string; staffId: string | null; department: { name: string } | null };

export default function StaffPicker({
  value, onChange, callerRole, callerDeptId,
}: {
  value: string | null;
  onChange: (userId: string | null) => void;
  callerRole: string;
  callerDeptId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StaffOption[]>([]);
  const [selected, setSelected] = useState<StaffOption | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/users?search=${encodeURIComponent(query)}&limit=15`)
        .then((r) => r.json())
        .then((d) => {
          let users: StaffOption[] = d.users || [];
          // Directors only ever see their own department, enforced client-side for UX
          // (the server enforces this for real — this just avoids showing options that would be rejected)
          if (callerRole === "DIRECTOR" && callerDeptId) {
            users = users.filter((u: any) => u.departmentId === callerDeptId);
          }
          setResults(users);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [query, callerRole, callerDeptId]);

  function pick(u: StaffOption) {
    setSelected(u);
    setQuery("");
    setOpen(false);
    onChange(u.id);
  }

  function clear() {
    setSelected(null);
    onChange(null);
  }

  if (selected) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{selected.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{selected.email}{selected.department && ` · ${selected.department.name}`}</div>
        </div>
        <button onClick={clear} style={{ fontSize: 12, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>Change</button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search by name, email, or staff ID..."
        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", boxSizing: "border-box" }}
      />
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 10, marginTop: 4, maxHeight: 240, overflowY: "auto", zIndex: 20 }}>
          {results.map((u) => (
            <div key={u.id} onClick={() => pick(u)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "0.5px solid var(--border-soft)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{u.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{u.email}{u.department && ` · ${u.department.name}`}{u.staffId && ` · ID: ${u.staffId}`}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
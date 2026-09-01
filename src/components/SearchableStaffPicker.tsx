// src/components/SearchableStaffPicker.tsx
//
// Debounced search-as-you-type staff picker. Queries only what's typed,
// nothing loads until the user starts typing — no full staff list ever
// pulled into the browser.

"use client";

import { useState, useEffect, useRef } from "react";

type StaffResult = {
  id: string;
  name: string;
  email: string;
  staffId: string | null;
  jobTitle: string | null;
  department: { name: string } | null;
};

export default function SearchableStaffPicker({
  onSelect,
  placeholder = "Search by name, email, or staff ID...",
  restrictToSupervised = false,
}: {
  onSelect: (staff: StaffResult) => void;
  placeholder?: string;
  restrictToSupervised?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StaffResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StaffResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ search: query, limit: "8" });
        if (restrictToSupervised) params.set("supervisedBy", "me");
        const res = await fetch(`/api/users?${params}`);
        const data = await res.json();
        setResults(data.users || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce, as specified

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, restrictToSupervised]);

  function pick(staff: StaffResult) {
    setSelected(staff);
    setQuery("");
    setResults([]);
    setOpen(false);
    onSelect(staff);
  }

  function clear() {
    setSelected(null);
    onSelect(null as any);
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box",
  };

  if (selected) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderRadius: 10, background: "var(--accent-bg)",
        border: "0.5px solid var(--accent-border)",
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-text)" }}>{selected.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {selected.jobTitle || selected.email}{selected.department ? ` · ${selected.department.name}` : ""}
          </div>
        </div>
        <button onClick={clear} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        style={inp}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
          background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 10,
          maxHeight: 260, overflowY: "auto", boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
        }}>
          {loading ? (
            <div style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-muted)" }}>Searching…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-muted)" }}>
              {query.trim().length < 2 ? "Type at least 2 characters" : "No matches found"}
            </div>
          ) : (
            results.map((s) => (
              <div
                key={s.id}
                onClick={() => pick(s)}
                style={{ padding: "10px 16px", cursor: "pointer", borderBottom: "0.5px solid var(--border-soft)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-input)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {s.jobTitle || s.email}{s.department ? ` · ${s.department.name}` : ""}{s.staffId ? ` · ${s.staffId}` : ""}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
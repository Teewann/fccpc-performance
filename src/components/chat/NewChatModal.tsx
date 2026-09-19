"use client";
import { useState, useEffect, useMemo } from "react";
import UserAvatar from "@/components/UserAvatar";
import { CloseIcon, SearchIcon, GroupIcon } from "./Icons";
import type { ChatUser } from "./types";

export function NewChatModal({
  currentUserId,
  onClose,
  onStart,
}: {
  currentUserId: string;
  onClose: () => void;
  onStart: (ids: string[], isGroup: boolean, name?: string) => Promise<void>;
}) {
  const [tab,       setTab]       = useState<"direct" | "group">("direct");
  const [search,    setSearch]    = useState("");
  const [users,     setUsers]     = useState<ChatUser[]>([]);
  const [selected,  setSelected]  = useState<ChatUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading,   setLoading]   = useState(true);
  const [starting,  setStarting]  = useState(false);
  const [error,     setError]     = useState("");

  // KEY FIX: use /api/chat/users not /api/users
  // /api/users restricts by role (directors see dept only, staff see themselves only)
  // /api/chat/users shows ALL active staff to everyone, hides EVC from non-exec
  useEffect(() => {
    setLoading(true);
    fetch("/api/chat/users")
      .then(r => r.json())
      .then(d => {
        const list: ChatUser[] = d.users ?? [];
        setUsers(list.filter(u => u.id !== currentUserId));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError("Could not load staff directory.");
      });
  }, [currentUserId]);

  // Client-side search — zero DB hits per keystroke
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.staffId?.toLowerCase().includes(q) ||
      u.department?.name?.toLowerCase().includes(q)
    );
  }, [search, users]);

  const toggle = (user: ChatUser) => {
    if (tab === "direct") { setSelected([user]); return; }
    setSelected(prev =>
      prev.some(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleStart = async () => {
    if (!selected.length) { setError("Select at least one person."); return; }
    if (tab === "group" && !groupName.trim()) { setError("Enter a group name."); return; }
    setStarting(true); setError("");
    try {
      await onStart(
        selected.map(u => u.id),
        tab === "group",
        tab === "group" ? groupName.trim() : undefined
      );
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Failed to start conversation.");
    } finally {
      setStarting(false);
    }
  };

  const now = Date.now();

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        width: 480, maxHeight: "86vh",
        background: "var(--bg-card)",
        borderRadius: 16, border: "1px solid var(--border)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      }}>

        {/* Header */}
        <div style={{
          padding: "16px 20px 12px",
          borderBottom: "1px solid var(--border-soft)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
              New Conversation
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {loading ? "Loading staff…" : `${users.length} staff members available`}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid var(--border)",
            borderRadius: 8, width: 30, height: 30, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-muted)",
          }}>
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", padding: "10px 20px 0", gap: 6, flexShrink: 0 }}>
          {(["direct", "group"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected([]); setError(""); }}
              style={{
                padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: "none",
                background: tab === t ? "#25D366" : "var(--bg-input)",
                color: tab === t ? "#fff" : "var(--text-muted)",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {t === "direct" ? "Direct Message" : "Group Chat"}
            </button>
          ))}
        </div>

        {/* Group name */}
        {tab === "group" && (
          <div style={{ padding: "10px 20px 0", flexShrink: 0 }}>
            <input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Group name (e.g. Legal Team, Investigation Unit)"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "9px 13px", borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)", fontSize: 13, outline: "none",
              }}
            />
          </div>
        )}

        {/* Search input */}
        <div style={{ padding: "10px 20px 0", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <SearchIcon size={14} color="var(--text-hint)" />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, staff ID, department…"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "9px 12px 9px 32px",
                borderRadius: 10, border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)", fontSize: 13, outline: "none",
              }}
            />
          </div>
        </div>

        {/* Selected chips for group */}
        {tab === "group" && selected.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "8px 20px 0", flexShrink: 0 }}>
            {selected.map(u => (
              <div key={u.id} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "3px 8px 3px 5px", borderRadius: 20,
                background: "rgba(37,211,102,0.12)", border: "1px solid #25D366",
                color: "#25D366", fontSize: 12, fontWeight: 600,
              }}>
                <UserAvatar user={{ name: u.name }} userId={u.id} size={16} />
                {u.name.split(" ")[0]}
                <button onClick={() => toggle(u)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#25D366", fontSize: 14, padding: 0, lineHeight: 1,
                }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* User list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 12px", minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                border: "2.5px solid var(--border)", borderTopColor: "#25D366",
                animation: "spin 0.7s linear infinite",
                margin: "0 auto 12px",
              }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ fontSize: 13, color: "var(--text-hint)" }}>Loading staff directory…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-hint)", fontSize: 13 }}>
              {search ? `No staff found for "${search}"` : "No staff available"}
            </div>
          ) : filtered.map(user => {
            const isSel = selected.some(u => u.id === user.id);
            const isOnline = user.lastSeen
              ? now - new Date(user.lastSeen as string).getTime() < 120_000
              : false;

            return (
              <button
                key={user.id}
                onClick={() => toggle(user)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", borderRadius: 10,
                  background: isSel ? "rgba(37,211,102,0.1)" : "transparent",
                  border: isSel ? "1px solid #25D366" : "1px solid transparent",
                  marginBottom: 2, cursor: "pointer", textAlign: "left",
                  outline: "none", transition: "all 0.1s",
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--bg-input)"; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                <UserAvatar user={{ name: user.name }} userId={user.id} size={38} />                 
                 {isOnline && (
                    <span style={{
                      position: "absolute", bottom: 0, right: 0,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#25D366", border: "2px solid var(--bg-card)",
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: isSel ? "#25D366" : "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                    {user.department?.name ?? user.role ?? user.email}
                  </div>
                </div>
                {isSel && (
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "#25D366",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0,
                  }}>✓</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            margin: "0 20px", padding: "8px 12px", borderRadius: 8,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171", fontSize: 12, flexShrink: 0,
          }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border-soft)",
          display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            padding: "9px 20px", borderRadius: 20,
            border: "1px solid var(--border)", background: "transparent",
            color: "var(--text-muted)", fontSize: 13, cursor: "pointer",
          }}>
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={starting || !selected.length}
            style={{
              padding: "9px 22px", borderRadius: 20, border: "none",
              background: (starting || !selected.length) ? "var(--bg-input)" : "#25D366",
              color: (starting || !selected.length) ? "var(--text-hint)" : "#fff",
              fontSize: 13, fontWeight: 700,
              cursor: (starting || !selected.length) ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {starting
              ? "Starting…"
              : tab === "group"
                ? `Create Group${selected.length > 0 ? ` (${selected.length})` : ""}`
                : "Start Chat"}
          </button>
        </div>
      </div>
    </div>
  );
}

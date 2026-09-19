"use client";
import { useState, useEffect, useMemo } from "react";
import UserAvatar from "@/components/UserAvatar";
import { CloseIcon, SearchIcon, UsersIcon, PinIcon } from "./Icons";
import type { Conversation, ChatUser, Message } from "./types";

// ── MemberPanel ───────────────────────────────────────────────────────
export function MemberPanel({
  conversation, currentUserId, onClose,
}: {
  conversation: Conversation;
  currentUserId: string;
  onClose: () => void;
}) {
  const formatLastSeen = (ts?: string | null) => {
    if (!ts) return "Offline";
    const ms = Date.now() - new Date(ts).getTime();
    if (ms < 120_000) return "Online";
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <div style={{
      width: 240, flexShrink: 0,
      borderLeft: "1px solid var(--border-soft)",
      background: "var(--bg-card)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--border-soft)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UsersIcon size={16} color="var(--text-muted)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            Members ({conversation.participants.length})
          </span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-hint)", display: "flex", padding: 2,
        }}>
          <CloseIcon size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {conversation.participants.map(p => {
          const isMe = p.id === currentUserId;
          const online = p.lastSeen
            ? Date.now() - new Date(p.lastSeen).getTime() < 120_000
            : false;
          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 14px",
            }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
              <UserAvatar user={{ name: p.name }} userId={p.id} size={34} />
                {online && (
                  <span style={{
                    position: "absolute", bottom: 0, right: 0,
                    width: 9, height: 9, borderRadius: "50%",
                    background: "#22c55e", border: "2px solid var(--bg-card)",
                  }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {p.name}{isMe ? " (You)" : ""}
                </div>
                <div style={{ fontSize: 11, color: online ? "#22c55e" : "var(--text-hint)", marginTop: 1 }}>
                  {formatLastSeen(p.lastSeen)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PinnedMessagesBanner ──────────────────────────────────────────────
export function PinnedMessagesBanner({
  messages, onUnpin,
}: {
  messages: Message[];
  onUnpin: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const latest = messages[messages.length - 1];

  if (!latest) return null;

  return (
    <div style={{
      flexShrink: 0,
      borderBottom: "1px solid var(--border-soft)",
      background: "var(--bg-card)",
    }}>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "7px 16px", cursor: "pointer",
          transition: "background 0.1s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.03))"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <PinIcon size={13} color="var(--accent-text)" filled />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-text)" }}>
            {messages.length} pinned {messages.length === 1 ? "message" : "messages"}
          </span>
          {!expanded && (
            <span style={{
              marginLeft: 8, fontSize: 12, color: "var(--text-muted)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              · {latest.content || (latest.fileName ? `📎 ${latest.fileName}` : "Attachment")}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-hint)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border-soft)", maxHeight: 180, overflowY: "auto" }}>
          {messages.map(m => (
            <div key={m.id} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "8px 16px",
              borderBottom: "1px solid var(--border-soft)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>
                  {m.sender.name}
                </div>
                <div style={{
                  fontSize: 12, color: "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {m.content || (m.fileName ? `📎 ${m.fileName}` : "Attachment")}
                </div>
              </div>
              <button onClick={() => onUnpin(m.id)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 11, color: "var(--text-hint)", flexShrink: 0, padding: "2px 0",
              }}>
                Unpin
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NewChatModal ──────────────────────────────────────────────────────
export function NewChatModal({
  currentUserId, onClose, onStart,
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

  useEffect(() => {
    fetch("/api/users?limit=300")
      .then(r => r.json())
      .then(d => {
        const list: ChatUser[] = d.users || d.staff || d.data || d || [];
        setUsers(Array.isArray(list) ? list.filter(u => u.id !== currentUserId) : []);
        setLoading(false);
      })
      .catch(() => { setLoading(false); setError("Could not load staff directory."); });
  }, [currentUserId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
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
      prev.find(u => u.id === user.id) ? prev.filter(u => u.id !== user.id) : [...prev, user]
    );
  };

  const handleStart = async () => {
    if (!selected.length) { setError("Select at least one person."); return; }
    if (tab === "group" && !groupName.trim()) { setError("Enter a group name."); return; }
    setStarting(true); setError("");
    try {
      await onStart(selected.map(u => u.id), tab === "group", tab === "group" ? groupName : undefined);
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to start.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: 480, maxHeight: "82vh",
        background: "var(--bg-card)",
        borderRadius: 16, border: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid var(--border-soft)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>New Conversation</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Start a direct message or group chat
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

        {/* Tabs */}
        <div style={{ display: "flex", padding: "12px 20px 0", gap: 4, flexShrink: 0 }}>
          {(["direct", "group"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected([]); setError(""); }}
              style={{
                padding: "7px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: tab === t ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                background: tab === t ? "var(--accent-bg)" : "transparent",
                color: tab === t ? "var(--accent-text)" : "var(--text-muted)",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {t === "direct" ? "Direct Message" : "Group Chat"}
            </button>
          ))}
        </div>

        {/* Group name */}
        {tab === "group" && (
          <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
            <input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Group name (e.g. Legal Team)"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "9px 13px", borderRadius: 9,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)", fontSize: 13, outline: "none",
              }}
            />
          </div>
        )}

        {/* Search */}
        <div style={{ padding: "10px 20px 0", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
              <SearchIcon size={14} color="var(--text-hint)" />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, staff ID, department…"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "8px 12px 8px 32px", borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)", fontSize: 13, outline: "none",
              }}
            />
          </div>
        </div>

        {/* Selected chips (group) */}
        {tab === "group" && selected.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 5,
            padding: "10px 20px 0", flexShrink: 0,
          }}>
            {selected.map(u => (
              <div key={u.id} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "3px 8px 3px 5px", borderRadius: 20,
                background: "var(--accent-bg)", border: "1px solid var(--accent)",
                color: "var(--accent-text)", fontSize: 12, fontWeight: 600,
              }}>
                <UserAvatar user={{ name: u.name }} userId={u.id} size={16} />
                {u.name.split(" ")[0]}
                <button onClick={() => toggle(u)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--accent-text)", fontSize: 13, padding: 0, lineHeight: 1,
                }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* User list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-hint)", fontSize: 13 }}>
              Loading staff directory…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-hint)", fontSize: 13 }}>
              No staff members found
            </div>
          ) : filtered.map(user => {
            const isSel = selected.some(u => u.id === user.id);
            return (
              <button
                key={user.id}
                onClick={() => toggle(user)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", borderRadius: 9,
                  background: isSel ? "var(--accent-bg)" : "transparent",
                  border: isSel ? "1px solid var(--accent)" : "1px solid transparent",
                  marginBottom: 2, cursor: "pointer", textAlign: "left",
                  transition: "all 0.1s", outline: "none",
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.04))"; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
              >
                <UserAvatar user={{ name: user.name }} userId={user.id} size={36} />
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: isSel ? "var(--accent-text)" : "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                    {user.department?.name || user.role || user.email}
                  </div>
                </div>
                {isSel && (
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "var(--accent)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: "#fff", fontWeight: 700, flexShrink: 0,
                  }}>✓</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            margin: "0 20px", padding: "9px 12px", borderRadius: 8,
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
            padding: "9px 20px", borderRadius: 9,
            border: "1px solid var(--border)", background: "transparent",
            color: "var(--text-muted)", fontSize: 13, cursor: "pointer",
          }}>
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={starting || !selected.length}
            style={{
              padding: "9px 20px", borderRadius: 9,
              border: "1.5px solid var(--accent)",
              background: "var(--accent-bg-strong, #052e16)",
              color: "var(--accent-text)", fontSize: 13, fontWeight: 600,
              cursor: (starting || !selected.length) ? "not-allowed" : "pointer",
              opacity: (starting || !selected.length) ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {starting ? "Starting…" : tab === "group"
              ? `Create Group${selected.length > 0 ? ` (${selected.length})` : ""}`
              : "Start Chat"}
          </button>
        </div>
      </div>
    </div>
  );
}

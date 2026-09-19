"use client";
import { useState, useMemo } from "react";
import UserAvatar from "@/components/UserAvatar";
import { PlusIcon, SearchIcon, GroupIcon } from "./Icons";
import type { Conversation } from "./types";

interface Props {
  conversations: Conversation[];
  activeConvId: string | null;
  currentUserId: string;
  loading: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  /** mobile: hide this panel when a conversation is selected */
  hidden?: boolean;
}

export function ConversationList({ conversations, activeConvId, currentUserId, loading, onSelect, onNewChat, hidden }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? conversations.filter(c => c.name?.toLowerCase().includes(q)) : conversations;
  }, [conversations, search]);

  const fmt = (ts: string) => {
    if (!ts) return "";
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (diff < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  return (
    <div style={{
      width: "100%", maxWidth: 340, flexShrink: 0,
      display: hidden ? "none" : "flex",
      flexDirection: "column",
      borderRight: "1px solid var(--border-soft)",
      background: "var(--bg-sidebar)",
      height: "100%",
      // On mobile, take full width when visible
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px 10px",
        borderBottom: "1px solid var(--border-soft)",
        background: "var(--bg-card)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Chats
          </span>
          <button
            onClick={onNewChat}
            title="New conversation"
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "#25D366", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", boxShadow: "0 2px 8px rgba(37,211,102,0.4)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(37,211,102,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)";    e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,211,102,0.4)"; }}
          >
            <PlusIcon size={18} color="#fff" />
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <SearchIcon size={14} color="var(--text-hint)" />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search or start a new chat"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "9px 12px 9px 34px",
              borderRadius: 20,
              border: "none",
              background: "var(--bg-input)",
              color: "var(--text-primary)", fontSize: 13, outline: "none",
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          [1,2,3,4,5].map(i => <ConvSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-hint)", fontSize: 13 }}>
            {search ? "No chats found" : (
              <>No conversations yet.<br/>
                <button onClick={onNewChat} style={{ marginTop: 10, background: "none", border: "none", color: "#25D366", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Start a new chat →
                </button>
              </>
            )}
          </div>
        ) : filtered.map(conv => {
          const isActive = conv.id === activeConvId;
          const other = conv.isGroup ? null : conv.participants.find(p => p.id !== currentUserId);

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              style={{
                width: "100%", textAlign: "left", border: "none",
                padding: "10px 16px",
                display: "flex", alignItems: "center", gap: 12,
                background: isActive ? "rgba(37,211,102,0.08)" : "transparent",
                borderLeft: `3px solid ${isActive ? "#25D366" : "transparent"}`,
                cursor: "pointer", transition: "background 0.1s",
                borderBottom: "1px solid var(--border-soft)",
                outline: "none", minHeight: 68,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg-hover,rgba(255,255,255,0.03))"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              {/* Avatar with online ring */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                {conv.isGroup ? (
                  <div style={{
                    width: 46, height: 46, borderRadius: "50%",
                    background: "linear-gradient(135deg,#128C7E,#25D366)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: conv.avatarUrl ? "2px solid #25D366" : "none",
                    overflow: "hidden",
                  }}>
                    {conv.avatarUrl
                      ? <img src={conv.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="group" />
                      : <GroupIcon size={22} color="#fff" />
                    }
                  </div>
                ) : (
                  <div style={{
                    borderRadius: "50%",
                    outline: conv.isOnline ? "2.5px solid #25D366" : "none",
                    outlineOffset: 2,
                  }}>
                  <UserAvatar user={{ name: other?.name ?? "?" }} userId={other?.id} size={46} />                  </div>
                )}
                {conv.isOnline && !conv.isGroup && (
                  <span style={{
                    position: "absolute", bottom: 1, right: 1,
                    width: 11, height: 11, borderRadius: "50%",
                    background: "#25D366", border: "2.5px solid var(--bg-sidebar)",
                  }} />
                )}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "baseline", gap: 6, marginBottom: 3,
                }}>
                  <span style={{
                    fontSize: 14, fontWeight: conv.hasUnread ? 700 : 500,
                    color: "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                  }}>
                    {conv.name}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: conv.hasUnread ? "#25D366" : "var(--text-hint)",
                    flexShrink: 0, fontWeight: conv.hasUnread ? 600 : 400,
                  }}>
                    {fmt(conv.lastTime)}
                  </span>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", gap: 6,
                }}>
                  <span style={{
                    fontSize: 12,
                    color: conv.hasUnread ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: conv.hasUnread ? 500 : 400,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                  }}>
                    {conv.lastMessage || "No messages yet"}
                  </span>
                  {conv.hasUnread && (
                    <span style={{
                      minWidth: 20, height: 20, borderRadius: 10,
                      background: "#25D366", color: "#fff",
                      fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 5px", flexShrink: 0,
                    }}>
                      {conv.unreadCount ?? ""}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <style>{`div::-webkit-scrollbar{width:3px}div::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}`}</style>
    </div>
  );
}

function ConvSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border-soft)" }}>
      <div style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--bg-input)", flexShrink: 0, animation: "pulse 1.4s ease-in-out infinite" }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: "55%", height: 12, borderRadius: 6, background: "var(--bg-input)", marginBottom: 8, animation: "pulse 1.4s ease-in-out infinite" }} />
        <div style={{ width: "75%", height: 10, borderRadius: 6, background: "var(--bg-input)", animation: "pulse 1.4s ease-in-out infinite 0.15s" }} />
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.9}}`}</style>
    </div>
  );
}
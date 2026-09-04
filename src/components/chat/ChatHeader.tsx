"use client";
import UserAvatar from "@/components/UserAvatar";
import { SearchIcon, UsersIcon, GroupIcon, VideoIcon, PhoneIcon } from "./Icons";
import type { Conversation } from "./types";

interface Props {
  conversation: Conversation;
  currentUserId: string;
  showMembers: boolean;
  showSearch: boolean;
  onToggleMembers: () => void;
  onToggleSearch: () => void;
}

export function ChatHeader({
  conversation, currentUserId, showMembers, showSearch,
  onToggleMembers, onToggleSearch,
}: Props) {
  const other = conversation.isGroup
    ? null
    : conversation.participants.find(p => p.id !== currentUserId);

  const formatLastSeen = (ts?: string | null) => {
    if (!ts) return "Offline";
    const ms = Date.now() - new Date(ts).getTime();
    if (ms < 120_000) return "Online";
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return `Last seen ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Last seen ${hrs}h ago`;
    return `Last seen ${new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  };

  const isOnline = !conversation.isGroup && conversation.isOnline;
  const subtitle = conversation.isGroup
    ? `${conversation.participants.length} members`
    : formatLastSeen(other?.lastSeen);

  return (
    <div style={{
      height: 58, flexShrink: 0,
      borderBottom: "1px solid var(--border-soft)",
      background: "var(--bg-card)",
      display: "flex", alignItems: "center",
      padding: "0 16px", gap: 12,
    }}>
      {/* Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {conversation.isGroup ? (
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--accent-bg, rgba(34,197,94,0.12))",
            border: "1.5px solid var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GroupIcon size={18} color="var(--accent-text)" />
          </div>
        ) : (
          <UserAvatar user={{ name: other?.name || "?", photo: other?.photo }} size={36} />
        )}
        {isOnline && (
          <span style={{
            position: "absolute", bottom: 0, right: 0,
            width: 9, height: 9, borderRadius: "50%",
            background: "#22c55e",
            border: "2px solid var(--bg-card)",
          }} />
        )}
      </div>

      {/* Name + status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {conversation.name}
        </div>
        <div style={{
          fontSize: 12, color: "var(--text-muted)",
          display: "flex", alignItems: "center", gap: 5, marginTop: 1,
        }}>
          {isOnline && (
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
          )}
          {subtitle}
        </div>
      </div>

      {/* Group avatars strip */}
      {conversation.isGroup && (
        <div style={{ display: "flex", alignItems: "center", marginRight: 4 }}>
          {conversation.participants.slice(0, 4).map((p, i) => (
            <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 4 - i }} title={p.name}>
              <UserAvatar user={{ name: p.name, photo: p.photo }} size={24} />
            </div>
          ))}
          {conversation.participants.length > 4 && (
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "var(--bg-input)", border: "1.5px solid var(--border)",
              marginLeft: -8, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "var(--text-hint)",
            }}>
              +{conversation.participants.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <HeaderBtn
          onClick={onToggleSearch}
          active={showSearch}
          title="Search messages"
          icon={<SearchIcon size={16} color={showSearch ? "var(--accent-text)" : "var(--text-muted)"} />}
        />
        {conversation.isGroup && (
          <HeaderBtn
            onClick={onToggleMembers}
            active={showMembers}
            title="Members"
            icon={<UsersIcon size={16} color={showMembers ? "var(--accent-text)" : "var(--text-muted)"} />}
          />
        )}
      </div>
    </div>
  );
}

function HeaderBtn({ onClick, active, title, icon }: {
  onClick: () => void; active: boolean; title: string; icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: 8,
        border: active ? "1.5px solid var(--accent)" : "1px solid transparent",
        background: active ? "var(--accent-bg, rgba(34,197,94,0.1))" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.06))"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {icon}
    </button>
  );
}

"use client";
import UserAvatar from "@/components/UserAvatar";
import { SearchIcon, UsersIcon, GroupIcon, BackIcon } from "./Icons";
import type { Conversation } from "./types";

interface Props {
  conversation: Conversation;
  currentUserId: string;
  showMembers: boolean;
  showSearch: boolean;
  isMobile?: boolean;
  onBack?: () => void;
  onToggleMembers: () => void;
  onToggleSearch: () => void;
}

export function ChatHeader({
  conversation, currentUserId, showMembers, showSearch,
  isMobile, onBack, onToggleMembers, onToggleSearch,
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
      // KEY FIX: padding tight on mobile, normal on desktop
      padding: isMobile ? "0 10px" : "0 16px",
      gap: 10,
      // Prevent header itself from overflowing
      minWidth: 0, overflow: "hidden",
    }}>
      {/* Back button — mobile only */}
      {isMobile && onBack && (
        <button
          onClick={onBack}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            border: "none", background: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--text-muted)",
          }}
        >
          <BackIcon size={20} color="#25D366" />
        </button>
      )}

      {/* Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {conversation.isGroup ? (
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg,#128C7E,#25D366)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GroupIcon size={18} color="#fff" />
          </div>
        ) : (
        <UserAvatar user={{ name: other?.name || "?" }} userId={other?.id} size={36} />
        )}
        {isOnline && (
          <span style={{
            position: "absolute", bottom: 0, right: 0,
            width: 10, height: 10, borderRadius: "50%",
            background: "#25D366", border: "2px solid var(--bg-card)",
          }} />
        )}
      </div>

      {/* Name + status — flex:1 + minWidth:0 so it shrinks, not overflows */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {conversation.name}
        </div>
        <div style={{
          fontSize: 11, color: isOnline ? "#25D366" : "var(--text-muted)",
          display: "flex", alignItems: "center", gap: 4, marginTop: 1,
        }}>
          {isOnline && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#25D366" }} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </span>
        </div>
      </div>

      {/* Group member avatars — hide on mobile to save space */}
      {conversation.isGroup && !isMobile && (
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {conversation.participants.slice(0, 3).map((p, i) => (
            <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }} title={p.name}>
            <UserAvatar user={{ name: p.name }} userId={p.id} size={24} />
            </div>
          ))}
          {conversation.participants.length > 3 && (
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "var(--bg-input)", border: "1.5px solid var(--border)",
              marginLeft: -8, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "var(--text-hint)",
            }}>
              +{conversation.participants.length - 3}
            </div>
          )}
        </div>
      )}

      {/* Action buttons — flexShrink:0 so they never disappear */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        <HBtn onClick={onToggleSearch} active={showSearch} title="Search">
          <SearchIcon size={17} color={showSearch ? "#25D366" : "var(--text-muted)"} />
        </HBtn>
        {conversation.isGroup && (
          <HBtn onClick={onToggleMembers} active={showMembers} title="Members">
            <UsersIcon size={17} color={showMembers ? "#25D366" : "var(--text-muted)"} />
          </HBtn>
        )}
      </div>
    </div>
  );
}

function HBtn({ onClick, active, title, children }: {
  onClick: () => void; active: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 34, height: 34, borderRadius: 8,
      border: active ? "1.5px solid #25D366" : "1px solid transparent",
      background: active ? "rgba(37,211,102,0.1)" : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", transition: "all 0.15s",
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--bg-input)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}
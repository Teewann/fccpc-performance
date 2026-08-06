"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import UserAvatar from "@/components/UserAvatar";

// ─── Types ────────────────────────────────────────────────────────────
type Message = {
  id: string;
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  createdAt: string;
  sender: { id: string; name: string; photo?: string | null };
};

type Conversation = {
  id: string;
  name: string;
  isGroup: boolean;
  participants: { id: string; name: string; photo?: string | null }[];
  lastMessage: string;
  lastTime: string;
};

type StaffUser = {
  id: string;
  name: string;
  email: string;
  staffId?: string | null;
  photo?: string | null;
  role?: string;
  department?: { name: string } | null;
};

// ─── New Chat Modal ───────────────────────────────────────────────────
function NewChatModal({
  onClose,
  onStart,
  currentUserId,
}: {
  onClose: () => void;
  onStart: (participantIds: string[], isGroup: boolean, groupName?: string) => Promise<void>;
  currentUserId: string;
}) {
  const [tab, setTab] = useState<"direct" | "group">("direct");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [filtered, setFiltered] = useState<StaffUser[]>([]);
  const [selected, setSelected] = useState<StaffUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users?limit=200")
      .then((r) => r.json())
      .then((d) => {
        const list: StaffUser[] = d.users || d.staff || d.data || d || [];
        const others = Array.isArray(list)
          ? list.filter((u: StaffUser) => u.id !== currentUserId)
          : [];
        setUsers(others);
        setFiltered(others);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError("Could not load staff directory.");
      });
  }, [currentUserId]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(users);
    } else {
      const q = search.toLowerCase();
      setFiltered(
        users.filter(
          (u) =>
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.staffId?.toLowerCase().includes(q) ||
            u.department?.name?.toLowerCase().includes(q)
        )
      );
    }
  }, [search, users]);

  const toggleUser = (user: StaffUser) => {
    if (tab === "direct") {
      setSelected([user]);
    } else {
      setSelected((prev) =>
        prev.find((u) => u.id === user.id)
          ? prev.filter((u) => u.id !== user.id)
          : [...prev, user]
      );
    }
  };

  const handleStart = async () => {
    if (selected.length === 0) {
      setError("Please select at least one person.");
      return;
    }
    if (tab === "group" && !groupName.trim()) {
      setError("Please enter a group name.");
      return;
    }
    setStarting(true);
    setError("");
    try {
      await onStart(
        selected.map((u) => u.id),
        tab === "group",
        tab === "group" ? groupName : undefined
      );
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to start conversation.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: 480,
          maxHeight: "80vh",
          background: "var(--bg-card)",
          borderRadius: 16,
          border: "0.5px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "0.5px solid var(--border-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
              New Conversation
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              Start a direct message or group chat
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "0.5px solid var(--border)",
              background: "var(--bg-input)",
              color: "var(--text-muted)",
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", padding: "12px 24px 0", gap: 4, flexShrink: 0 }}>
          {(["direct", "group"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected([]); setError(""); }}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: tab === t ? "1.5px solid var(--accent)" : "0.5px solid var(--border)",
                background: tab === t ? "var(--accent-bg)" : "transparent",
                color: tab === t ? "var(--accent-text)" : "var(--text-muted)",
                fontSize: 14,
                fontWeight: tab === t ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {t === "direct" ? "Direct Message" : "Group Chat"}
            </button>
          ))}
        </div>

        {/* Group name input */}
        {tab === "group" && (
          <div style={{ padding: "12px 24px 0", flexShrink: 0 }}>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (e.g. Legal Team)"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                border: "0.5px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Search */}
        <div style={{ padding: "12px 24px 0", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-hint)",
                fontSize: 15,
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, staff ID..."
              style={{
                width: "100%",
                padding: "10px 14px 10px 36px",
                borderRadius: 10,
                border: "0.5px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Selected chips (group) */}
        {tab === "group" && selected.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              padding: "10px 24px 0",
              flexShrink: 0,
            }}
          >
            {selected.map((u) => (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px 4px 8px",
                  borderRadius: 20,
                  background: "var(--accent-bg)",
                  border: "1px solid var(--accent)",
                  color: "var(--accent-text)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <UserAvatar user={{ name: u.name, photo: u.photo }} size={18} />
                {u.name}
                <button
                  onClick={() => toggleUser(u)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent-text)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1,
                    marginLeft: 2,
                    opacity: 0.7,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Staff list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px", minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-hint)", fontSize: 14 }}>
              Loading staff directory...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-hint)", fontSize: 14 }}>
              No staff members found
            </div>
          ) : (
            filtered.map((user) => {
              const isSelected = selected.some((u) => u.id === user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    background: isSelected ? "var(--accent-bg)" : "transparent",
                    border: isSelected ? "1px solid var(--accent)" : "1px solid transparent",
                    marginBottom: 2,
                    transition: "all 0.1s",
                  }}
                >
                  <UserAvatar user={{ name: user.name, photo: user.photo }} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {user.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {user.department?.name || user.role || user.email}
                    </div>
                  </div>
                  {isSelected && (
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        color: "#fff",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              margin: "0 24px",
              padding: "10px 14px",
              borderRadius: 8,
              background: "#1f0707",
              border: "0.5px solid #7f1d1d",
              color: "#f87171",
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {error}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "0.5px solid var(--border-soft)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              border: "0.5px solid var(--border)",
              background: "var(--bg-input)",
              color: "var(--text-muted)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={starting || selected.length === 0}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              border: "1.5px solid #22c55e",
              background: "#052e16",
              color: "#4ade80",
              fontSize: 14,
              fontWeight: 600,
              cursor: starting || selected.length === 0 ? "not-allowed" : "pointer",
              opacity: starting || selected.length === 0 ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {starting
              ? "Starting..."
              : tab === "group"
              ? `Create Group (${selected.length})`
              : "Start Chat"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FIX #2 & #3: File Preview — inline modal with ✕ close, no new tab ─
function FileAttachment({
  url,
  fileName,
  fileType,
  isMine,
}: {
  url: string;
  fileName?: string | null;
  fileType?: string | null;
  isMine: boolean;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const isImage = fileType?.startsWith("image/");
  const isPdf = fileType === "application/pdf";
  const name = fileName || "Attachment";

  return (
    <>
      {/* Clickable attachment — opens modal instead of new tab */}
      <div
        style={{ marginTop: 4, cursor: "pointer" }}
        onClick={() => setShowPreview(true)}
      >
        {isImage ? (
          <img
            src={url}
            alt={name}
            style={{
              maxWidth: 240,
              maxHeight: 180,
              borderRadius: 8,
              display: "block",
              objectFit: "cover",
              border: "1px solid var(--border)",
            }}
          />
        ) : (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 8,
              background: isMine ? "rgba(255,255,255,0.08)" : "var(--bg-page)",
              border: `1px solid ${isMine ? "rgba(255,255,255,0.12)" : "var(--border)"}`,
              color: isMine ? "#86efac" : "var(--accent-text)",
              fontSize: 13,
              fontWeight: 500,
              maxWidth: 260,
              overflow: "hidden",
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{isPdf ? "📄" : "📎"}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </span>
          </div>
        )}
      </div>

      {/* FIX #3: Full-screen preview modal with ✕ to close back to chat */}
      {showPreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setShowPreview(false)}
        >
          {/* ✕ close button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowPreview(false); }}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "white",
              fontSize: 22,
              width: 42,
              height: 42,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
            }}
            title="Close"
          >
            ✕
          </button>

          {isImage ? (
            <img
              src={url}
              alt={name}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "90vw",
                maxHeight: "90vh",
                objectFit: "contain",
                borderRadius: 10,
                boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
              }}
            />
          ) : (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--bg-card)",
                borderRadius: 16,
                padding: "32px 40px",
                textAlign: "center",
                color: "var(--text-primary)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                minWidth: 280,
              }}
            >
              <span style={{ fontSize: 48 }}>{isPdf ? "📄" : "📎"}</span>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{name}</div>
              <a
                href={url}
                download={name}
                style={{
                  padding: "10px 24px",
                  borderRadius: 10,
                  border: "1.5px solid #22c55e",
                  background: "#052e16",
                  color: "#4ade80",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                ⬇ Download
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--text-hint)",
            animation: "typingBounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Date separator ───────────────────────────────────────────────────
function DateSeparator({ date }: { date: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 8px" }}>
      <div style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-hint)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {date}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 16,
        padding: 40,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: "var(--accent-bg)",
          border: "1.5px solid var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
        }}
      >
        💬
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          Your messages
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 280 }}>
          Send private messages or start a group conversation with colleagues across the organisation.
        </div>
      </div>
      <button
        onClick={onNew}
        style={{
          padding: "11px 28px",
          borderRadius: 10,
          border: "1.5px solid #22c55e",
          background: "#052e16",
          color: "#4ade80",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          transition: "opacity 0.15s",
        }}
      >
        Start a Conversation
      </button>
    </div>
  );
}

// ─── Uploading toast ──────────────────────────────────────────────────
function UploadingToast({ fileName }: { fileName: string }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "10px 20px",
        borderRadius: 10,
        background: "var(--bg-card)",
        border: "0.5px solid var(--border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 13,
        color: "var(--text-muted)",
        zIndex: 100,
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: "2px solid var(--accent)",
          borderTopColor: "transparent",
          animation: "spin 0.8s linear infinite",
          flexShrink: 0,
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      Uploading <strong>{fileName.length > 28 ? fileName.slice(0, 28) + "…" : fileName}</strong>
    </div>
  );
}

// ─── FIX #3: Message context menu ────────────────────────────────────
const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "7px 14px",
  background: "none",
  border: "none",
  color: "var(--text-primary)",
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function MessageMenu({
  messageId,
  isMine,
  content,
  onReply,
  onCopy,
  onDelete,
  onEdit,
}: {
  messageId: string;
  isMine: boolean;
  content?: string | null;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onEdit: (newText: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content || "");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: "relative", display: "inline-block", marginLeft: 6 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Message options"
        style={{
          background: "none",
          border: "none",
          color: "var(--text-hint)",
          fontSize: 16,
          cursor: "pointer",
          padding: "2px 4px",
          borderRadius: 4,
          lineHeight: 1,
          opacity: 0.6,
        }}
      >
        ⋯
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: "100%",
            marginBottom: 4,
            background: "var(--bg-card)",
            border: "0.5px solid var(--border)",
            borderRadius: 10,
            padding: "4px 0",
            minWidth: 140,
            zIndex: 200,
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          }}
        >
          <button onClick={() => { onReply(); setOpen(false); }} style={menuItemStyle}>
            ↩ Reply
          </button>
          <button onClick={() => { onCopy(); setOpen(false); }} style={menuItemStyle}>
            📋 Copy
          </button>
          {isMine && (
            <>
              <button
                onClick={() => { setEditing(true); setOpen(false); }}
                style={menuItemStyle}
              >
                ✏️ Edit
              </button>
              <div style={{ height: "0.5px", background: "var(--border-soft)", margin: "2px 0" }} />
              <button
                onClick={() => { onDelete(); setOpen(false); }}
                style={{ ...menuItemStyle, color: "#f87171" }}
              >
                🗑️ Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Inline edit input */}
      {editing && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            right: 0,
            marginBottom: 4,
            background: "var(--bg-card)",
            border: "0.5px solid var(--border)",
            borderRadius: 10,
            padding: 10,
            zIndex: 201,
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            minWidth: 220,
          }}
        >
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onEdit(editText); setEditing(false); }
              if (e.key === "Escape") setEditing(false);
            }}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 7,
              border: "0.5px solid var(--border)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              onClick={() => { onEdit(editText); setEditing(false); }}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 7,
                border: "1.5px solid #22c55e",
                background: "#052e16",
                color: "#4ade80",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 7,
                border: "0.5px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────
export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [convSearch, setConvSearch] = useState("");

  // FIX #2: file caption state
  const [fileToSend, setFileToSend] = useState<{ url: string; name: string; type: string } | null>(null);

  // FIX #1: smart scroll — ref to the messages container
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const captionInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch current user ─────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings/account")
      .then((r) => r.json())
      .then((d) => { if (d.user) setCurrentUser(d.user); })
      .catch(() => {});
  }, []);

  // ── Fetch conversations ────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      const data = await res.json();
      setConversations(data.conversations || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ── Poll messages for active conversation ──────────────────────────
  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/chat/messages?conversationId=${convId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activeConv) return;
    fetchMessages(activeConv);
    pollRef.current = setInterval(() => fetchMessages(activeConv), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeConv, fetchMessages]);

  // ── FIX #1: Smart auto-scroll — only scroll down if already near bottom ──
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const prevCount = prevMessageCountRef.current;
    const newCount = messages.length;
    prevMessageCountRef.current = newCount;

    // If no new messages, don't scroll
    if (newCount <= prevCount) return;

    // Check if user is near the bottom (within 200px)
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < 200;

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Always scroll to bottom when switching conversations
  useEffect(() => {
    if (activeConv) {
      prevMessageCountRef.current = 0;
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        inputRef.current?.focus();
      }, 50);
    }
  }, [activeConv]);

  // ── Send message ───────────────────────────────────────────────────
  // FIX #2: sendMessage now reads from fileToSend state instead of params
  const sendMessage = useCallback(async () => {
    if (!activeConv) return;
    const content = input.trim();
    const fileInfo = fileToSend;
    if (!content && !fileInfo) return;

    setSending(true);
    const body = {
      conversationId: activeConv,
      content: content || null,
      fileUrl: fileInfo?.url || null,
      fileName: fileInfo?.name || null,
      fileType: fileInfo?.type || null,
    };
    setInput("");
    setFileToSend(null);
    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await fetchMessages(activeConv);
      fetchConversations();
      // Scroll to bottom after sending own message
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally {
      setSending(false);
    }
  }, [activeConv, input, fileToSend, fetchMessages, fetchConversations]);

  // ── FIX #2: File upload — store file, don't auto-send ─────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("File too large. Maximum size is 20 MB.");
      return;
    }
    setUploading(true);
    setUploadingFile(file.name);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        // Store the file — user can add a caption before sending
        setFileToSend({ url: data.url, name: data.fileName || file.name, type: data.fileType || file.type });
        setTimeout(() => captionInputRef.current?.focus(), 50);
      } else {
        alert("Upload failed: " + (data.error || "Unknown error"));
      }
    } finally {
      setUploading(false);
      setUploadingFile("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Start conversation ─────────────────────────────────────────────
  const handleStartConversation = async (
    participantIds: string[],
    isGroup: boolean,
    groupName?: string
  ) => {
    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantIds, isGroup, name: groupName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create conversation");
    await fetchConversations();
    setActiveConv(data.conversation.id);
  };

  // ── FIX #3: Message action handlers ───────────────────────────────
  const handleDeleteMessage = async (messageId: string) => {
    await fetch(`/api/chat/messages?messageId=${messageId}`, { method: "DELETE" });
    if (activeConv) await fetchMessages(activeConv);
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!newContent.trim()) return;
    await fetch("/api/chat/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, content: newContent }),
    });
    if (activeConv) await fetchMessages(activeConv);
  };

  const handleReply = (msg: Message) => {
    setInput(`@${msg.sender.name} `);
    inputRef.current?.focus();
  };

  const handleCopy = (text?: string | null) => {
    if (text) navigator.clipboard.writeText(text).catch(() => {});
  };

  // ── Helpers ────────────────────────────────────────────────────────
  const getOtherParticipants = (conv: Conversation) =>
    conv.participants.filter((p) => p.id !== currentUser?.id);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (isToday) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const isThisWeek = now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
    if (isThisWeek) return d.toLocaleDateString("en-GB", { weekday: "short" });
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  const formatMessageTime = (ts: string) =>
    new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const formatDateLabel = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  };

  // Group messages by date and detect runs for avatar display
  const groupedMessages = (() => {
    const result: Array<{
      dateLabel: string;
      messages: Array<Message & { showAvatar: boolean }>;
    }> = [];
    let currentLabel = "";
    let currentGroup: Array<Message & { showAvatar: boolean }> = [];
    messages.forEach((msg, i) => {
      const label = formatDateLabel(msg.createdAt);
      const nextMsg = messages[i + 1];
      const isLastInRun =
        !nextMsg ||
        nextMsg.sender.id !== msg.sender.id ||
        formatDateLabel(nextMsg.createdAt) !== label;
      const annotated = { ...msg, showAvatar: isLastInRun };
      if (label !== currentLabel) {
        if (currentGroup.length > 0) result.push({ dateLabel: currentLabel, messages: currentGroup });
        currentLabel = label;
        currentGroup = [annotated];
      } else {
        currentGroup.push(annotated);
      }
    });
    if (currentGroup.length > 0) result.push({ dateLabel: currentLabel, messages: currentGroup });
    return result;
  })();

  const activeConvData = conversations.find((c) => c.id === activeConv);
  const filteredConvs = convSearch.trim()
    ? conversations.filter((c) =>
        c.name?.toLowerCase().includes(convSearch.toLowerCase())
      )
    : conversations;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />

      {/* New Chat Modal */}
      {showNewChat && currentUser && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onStart={handleStartConversation}
          currentUserId={currentUser.id}
        />
      )}

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* ── Top bar ──────────────────────────────────────────────── */}
        <div
          style={{
            padding: "0 20px",
            height: 56,
            borderBottom: "0.5px solid var(--border-soft)",
            background: "var(--bg-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              Messaging
            </h1>
            {conversations.length > 0 && (
              <span
                style={{
                  padding: "2px 9px",
                  borderRadius: 6,
                  background: "var(--accent-bg)",
                  color: "var(--accent-text)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {conversations.length}
              </span>
            )}
          </div>
          <ThemeToggleButton />
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

          {/* ── Conversations panel ───────────────────────────────── */}
          <div
            style={{
              width: 300,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              borderRight: "0.5px solid var(--border-soft)",
              background: "var(--bg-card)",
              overflow: "hidden",
            }}
          >
            {/* Panel header */}
            <div
              style={{
                padding: "14px 16px 10px",
                borderBottom: "0.5px solid var(--border-soft)",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setShowNewChat(true)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 10,
                  border: "1.5px solid #22c55e",
                  background: "#052e16",
                  color: "#4ade80",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  transition: "opacity 0.15s",
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                New Conversation
              </button>

              {conversations.length > 5 && (
                <input
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  placeholder="Search conversations..."
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "0.5px solid var(--border)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              )}
            </div>

            {/* Conversation list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--text-hint)", fontSize: 14 }}>
                  Loading...
                </div>
              ) : filteredConvs.length === 0 ? (
                <div
                  style={{
                    padding: "32px 20px",
                    textAlign: "center",
                    color: "var(--text-hint)",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  No conversations yet.
                  <br />
                  Click <strong>New Conversation</strong> to start.
                </div>
              ) : (
                filteredConvs.map((conv) => {
                  const others = getOtherParticipants(conv);
                  const displayName = conv.isGroup ? conv.name : others[0]?.name || "Unknown";
                  const displayPhoto = conv.isGroup ? null : others[0]?.photo;
                  const isActive = activeConv === conv.id;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setActiveConv(conv.id)}
                      style={{
                        padding: "11px 16px",
                        borderBottom: "0.5px solid var(--border-soft)",
                        cursor: "pointer",
                        background: isActive ? "var(--accent-bg)" : "transparent",
                        borderLeft: `3px solid ${isActive ? "var(--accent)" : "transparent"}`,
                        transition: "all 0.1s",
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {conv.isGroup ? (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              background: "var(--accent-bg)",
                              border: "1.5px solid var(--accent)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 18,
                              flexShrink: 0,
                            }}
                          >
                            👥
                          </div>
                        ) : (
                          <UserAvatar user={{ name: displayName, photo: displayPhoto }} size={40} />
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: 4,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: isActive ? 700 : 600,
                                color: isActive ? "var(--accent-text)" : "var(--text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                              }}
                            >
                              {displayName}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-hint)", flexShrink: 0 }}>
                              {formatTime(conv.lastTime)}
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: isActive ? "var(--accent-text)" : "var(--text-muted)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              opacity: isActive ? 0.8 : 1,
                              marginTop: 2,
                            }}
                          >
                            {conv.lastMessage || "No messages yet"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Chat area ─────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
              background: "var(--bg-page)",
            }}
          >
            {activeConv && activeConvData ? (
              <>
                {/* Chat header */}
                <div
                  style={{
                    padding: "0 20px",
                    height: 60,
                    borderBottom: "0.5px solid var(--border-soft)",
                    background: "var(--bg-card)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexShrink: 0,
                  }}
                >
                  {activeConvData.isGroup ? (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "var(--accent-bg)",
                        border: "1.5px solid var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      👥
                    </div>
                  ) : (
                    <UserAvatar
                      user={{
                        name: getOtherParticipants(activeConvData)[0]?.name,
                        photo: getOtherParticipants(activeConvData)[0]?.photo,
                      }}
                      size={36}
                    />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        lineHeight: 1.2,
                      }}
                    >
                      {activeConvData.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                      {activeConvData.isGroup
                        ? `${activeConvData.participants.length} members`
                        : getOtherParticipants(activeConvData)[0]?.name
                        ? "Staff member"
                        : ""}
                    </div>
                  </div>

                  {/* Participant mini-avatars for groups */}
                  {activeConvData.isGroup && (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {activeConvData.participants.slice(0, 4).map((p, i) => (
                        <div
                          key={p.id}
                          style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 4 - i }}
                          title={p.name}
                        >
                          <UserAvatar user={{ name: p.name, photo: p.photo }} size={26} />
                        </div>
                      ))}
                      {activeConvData.participants.length > 4 && (
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: "var(--bg-input)",
                            border: "1.5px solid var(--border)",
                            marginLeft: -10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--text-hint)",
                          }}
                        >
                          +{activeConvData.participants.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── FIX #1: Messages container with ref for smart scroll ── */}
                <div
                  ref={messagesContainerRef}
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "20px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  {messages.length === 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        color: "var(--text-hint)",
                        fontSize: 14,
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 32 }}>💬</span>
                      <span>No messages yet — say hello!</span>
                    </div>
                  ) : (
                    groupedMessages.map(({ dateLabel, messages: dayMsgs }) => (
                      <div key={dateLabel}>
                        <DateSeparator date={dateLabel} />
                        {dayMsgs.map((msg) => {
                          const isMine = msg.sender.id === currentUser?.id;
                          return (
                            <div
                              key={msg.id}
                              style={{
                                display: "flex",
                                justifyContent: isMine ? "flex-end" : "flex-start",
                                alignItems: "flex-end",
                                gap: 8,
                                marginBottom: msg.showAvatar ? 10 : 2,
                              }}
                            >
                              {/* Other person avatar — only on last in run */}
                              {!isMine && (
                                <div style={{ width: 30, flexShrink: 0 }}>
                                  {msg.showAvatar && (
                                    <UserAvatar
                                      user={{ name: msg.sender.name, photo: msg.sender.photo }}
                                      size={28}
                                    />
                                  )}
                                </div>
                              )}

                              <div
                                style={{
                                  maxWidth: "68%",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: isMine ? "flex-end" : "flex-start",
                                }}
                              >
                                {/* Sender name for group chats */}
                                {!isMine && activeConvData.isGroup && msg.showAvatar && (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "var(--text-muted)",
                                      marginBottom: 4,
                                      letterSpacing: "0.02em",
                                    }}
                                  >
                                    {msg.sender.name}
                                  </div>
                                )}

                                {/* Message bubble + context menu side by side */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-end",
                                    gap: 4,
                                    flexDirection: isMine ? "row-reverse" : "row",
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: msg.fileUrl && !msg.content ? "6px" : "10px 14px",
                                      borderRadius: isMine
                                        ? "16px 16px 4px 16px"
                                        : "16px 16px 16px 4px",
                                      background: isMine ? "#052e16" : "var(--bg-card)",
                                      border: `1px solid ${isMine ? "#14532d" : "var(--border)"}`,
                                      color: isMine ? "#86efac" : "var(--text-primary)",
                                      fontSize: 14,
                                      lineHeight: 1.55,
                                      wordBreak: "break-word",
                                      boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                                    }}
                                  >
                                    {msg.content && <div>{msg.content}</div>}
                                    {msg.fileUrl && (
                                      <FileAttachment
                                        url={msg.fileUrl}
                                        fileName={msg.fileName}
                                        fileType={msg.fileType}
                                        isMine={isMine}
                                      />
                                    )}
                                  </div>

                                  {/* FIX #3: Context menu ⋯ button */}
                                  <MessageMenu
                                    messageId={msg.id}
                                    isMine={isMine}
                                    content={msg.content}
                                    onReply={() => handleReply(msg)}
                                    onCopy={() => handleCopy(msg.content)}
                                    onDelete={() => handleDeleteMessage(msg.id)}
                                    onEdit={(newText) => handleEditMessage(msg.id, newText)}
                                  />
                                </div>

                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--text-hint)",
                                    marginTop: 4,
                                    paddingLeft: isMine ? 0 : 4,
                                    paddingRight: isMine ? 4 : 0,
                                  }}
                                >
                                  {formatMessageTime(msg.createdAt)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input */}
                <div
                  style={{
                    padding: "12px 20px",
                    borderTop: "0.5px solid var(--border-soft)",
                    background: "var(--bg-card)",
                    flexShrink: 0,
                    position: "relative",
                  }}
                >
                  {uploading && <UploadingToast fileName={uploadingFile} />}

                  {/* FIX #2: File caption bar — shows after file is picked */}
                  {fileToSend && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                        padding: "8px 14px",
                        borderRadius: 10,
                        background: "var(--bg-input)",
                        border: "0.5px solid var(--border)",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>
                        {fileToSend.type.startsWith("image/") ? "🖼️" : fileToSend.type === "application/pdf" ? "📄" : "📎"}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--text-muted)",
                          maxWidth: 160,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {fileToSend.name}
                      </span>
                      <input
                        ref={captionInputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                        }}
                        placeholder="Add a caption… (optional)"
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "none",
                          color: "var(--text-primary)",
                          fontSize: 14,
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => setFileToSend(null)}
                        title="Remove file"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-hint)",
                          fontSize: 18,
                          cursor: "pointer",
                          flexShrink: 0,
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        ✕
                      </button>
                      <button
                        onClick={sendMessage}
                        disabled={sending}
                        style={{
                          padding: "6px 16px",
                          borderRadius: 8,
                          border: "1.5px solid #22c55e",
                          background: "#052e16",
                          color: "#4ade80",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: sending ? "not-allowed" : "pointer",
                          flexShrink: 0,
                        }}
                      >
                        Send
                      </button>
                    </div>
                  )}

                  {/* Normal text input row — hidden when caption bar is showing */}
                  {!fileToSend && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-end",
                        background: "var(--bg-input)",
                        border: "0.5px solid var(--border)",
                        borderRadius: 14,
                        padding: "4px 4px 4px 16px",
                      }}
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="Write a message… (Enter to send)"
                        disabled={sending || uploading}
                        style={{
                          flex: 1,
                          padding: "10px 0",
                          background: "transparent",
                          border: "none",
                          color: "var(--text-primary)",
                          fontSize: 14,
                          outline: "none",
                          resize: "none",
                        }}
                      />

                      {/* Attach button */}
                      <label
                        title="Attach file (max 20 MB)"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: uploading ? "not-allowed" : "pointer",
                          color: "var(--text-muted)",
                          fontSize: 18,
                          transition: "color 0.15s",
                          flexShrink: 0,
                        }}
                      >
                        📎
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileUpload}
                          disabled={uploading}
                          style={{ display: "none" }}
                        />
                      </label>

                      {/* Send button */}
                      <button
                        onClick={sendMessage}
                        disabled={!input.trim() || sending || uploading}
                        title="Send (Enter)"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          border: "1.5px solid #22c55e",
                          background: "#052e16",
                          color: "#4ade80",
                          fontSize: 17,
                          fontWeight: 700,
                          cursor: !input.trim() || sending || uploading ? "not-allowed" : "pointer",
                          opacity: !input.trim() || sending || uploading ? 0.5 : 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "opacity 0.15s",
                          flexShrink: 0,
                        }}
                      >
                        ➤
                      </button>
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-hint)",
                      marginTop: 6,
                      paddingLeft: 4,
                    }}
                  >
                    Enter to send · Shift+Enter for new line · Max file size 20 MB
                  </div>
                </div>
              </>
            ) : (
              <EmptyState onNew={() => setShowNewChat(true)} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
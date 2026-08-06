"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "ALERT" | "SUCCESS";
  read: boolean;
  actionUrl?: string | null;
  metadata?: { senderDept?: string; [key: string]: any } | null;
  createdAt: string;
};

const typeConfig = {
  SUCCESS: { color: "#4ade80", bg: "#052e16", border: "#14532d", icon: "✓" },
  INFO:    { color: "#60a5fa", bg: "#0c1a2e", border: "#1e3a5f", icon: "ℹ" },
  WARNING: { color: "#f59e0b", bg: "#1c1107", border: "#78350f", icon: "⚠" },
  ALERT:   { color: "#f87171", bg: "#1f0707", border: "#7f1d1d", icon: "!" },
};

function groupByDate(notifications: Notification[]) {
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const groups = [
    { label: "Today",     items: [] as Notification[] },
    { label: "Yesterday", items: [] as Notification[] },
    { label: "Earlier",   items: [] as Notification[] },
  ];
  for (const n of notifications) {
    const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
    if      (d >= today)     groups[0].items.push(n);
    else if (d >= yesterday) groups[1].items.push(n);
    else                     groups[2].items.push(n);
  }
  return groups.filter((g) => g.items.length > 0);
}

export default function NotificationBell() {
  const router = useRouter();
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [muted,         setMuted]         = useState(false);
  const [filter,        setFilter]        = useState<"ALL" | "UNREAD">("ALL");
  const [error,         setError]         = useState<string | null>(null);
  const prevUnread = useRef(-1);
  const audioCtx   = useRef<AudioContext | null>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  const playSound = useCallback(() => {
    if (muted) return;
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx  = audioCtx.current;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } catch {}
  }, [muted]);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) {
        const text = await res.text();
        console.error("[NotificationBell] fetch failed:", res.status, text);
        setError(`API ${res.status}`);
        return;
      }
      const data = await res.json();
      const notifs: Notification[] = data.notifications || [];
      const count: number = data.unreadCount ?? notifs.filter((n) => !n.read).length;
      if (prevUnread.current !== -1 && count > prevUnread.current) playSound();
      prevUnread.current = count;
      setNotifications(notifs);
      setUnreadCount(count);
      setError(null);
    } catch (err) {
      console.error("[NotificationBell] network error:", err);
      setError("network");
    }
  }, [playSound]);

  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifs]);

  useEffect(() => {
    if (open) fetchNotifs();
  }, [open, fetchNotifs]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifId: id }),
    });
    fetchNotifs();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    fetchNotifs();
  }

  async function deleteNotif(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteId: id }),
    });
    fetchNotifs();
  }

  async function clearRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteAll: true }),
    });
    fetchNotifs();
  }

  function handleClick(n: Notification) {
    if (!n.read) markRead(n.id);
    if (n.actionUrl) { setOpen(false); router.push(n.actionUrl); }
  }

  const filtered = filter === "UNREAD" ? notifications.filter((n) => !n.read) : notifications;
  const groups   = groupByDate(filtered);

  return (
    <div style={{ position: "relative" }} ref={panelRef}>

      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        style={{
          position: "relative", background: "none", border: "none",
          cursor: "pointer", padding: "6px 7px", borderRadius: 8,
          color: "var(--text-muted)", fontSize: 18, lineHeight: 1,
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: 1, right: 1,
            minWidth: 15, height: 15, borderRadius: 8,
            background: "#ef4444", color: "#fff",
            fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", lineHeight: 1,
            border: "1.5px solid var(--bg-sidebar)",
          }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {error && unreadCount === 0 && (
          <span style={{
            position: "absolute", top: 1, right: 1,
            width: 8, height: 8, borderRadius: "50%",
            background: "#f59e0b",
            border: "1.5px solid var(--bg-sidebar)",
          }} title="Notification error — check console" />
        )}
      </button>

      {/* Slide-in panel */}
      {open && (
        <div style={{
          position: "fixed", top: 0, left: 232, bottom: 0, width: 360,
          zIndex: 9999,
          background: "var(--bg-card)",
          borderRight: "0.5px solid var(--border)",
          boxShadow: "4px 0 32px rgba(0,0,0,0.3)",
          display: "flex", flexDirection: "column",
          animation: "bellSlideIn 0.18s ease",
        }}>

          {/* Header */}
          <div style={{
            padding: "16px 16px 10px",
            borderBottom: "0.5px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                Notifications
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {unreadCount} unread
                {error && (
                  <span style={{ color: "#f87171", marginLeft: 8 }}>
                    ⚠ {error === "network" ? "Connection issue" : `Error ${error}`}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                onClick={fetchNotifs}
                title="Refresh"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "2px 4px", color: "var(--text-muted)" }}
              >
                ↻
              </button>
              <button
                onClick={() => setMuted((m) => !m)}
                title={muted ? "Unmute" : "Mute sounds"}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, opacity: muted ? 0.35 : 1, padding: "2px 4px" }}
              >
                {muted ? "🔕" : "🔔"}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", cursor: "pointer" }}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-muted)", lineHeight: 1, padding: "0 2px" }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: "0.5px solid var(--border-soft)" }}>
            {(["ALL", "UNREAD"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "5px 14px", borderRadius: 6, fontSize: 12,
                fontWeight: filter === f ? 600 : 400,
                background: filter === f ? "var(--accent-bg)" : "transparent",
                border: filter === f ? "0.5px solid var(--accent-border)" : "none",
                color: filter === f ? "var(--accent-text)" : "var(--text-muted)",
                cursor: "pointer",
              }}>
                {f === "ALL" ? `All (${notifications.length})` : `Unread (${unreadCount})`}
              </button>
            ))}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {error ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
                <div style={{ color: "#f87171", marginBottom: 12 }}>
                  {error === "network" ? "Connection issue" : "Database error — run: npx prisma db push"}
                </div>
                <button
                  onClick={fetchNotifs}
                  style={{ fontSize: 12, padding: "6px 16px", borderRadius: 8, border: "0.5px solid #60a5fa", background: "#0c1a2e", color: "#60a5fa", cursor: "pointer" }}
                >
                  Retry
                </button>
              </div>
            ) : groups.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 13 }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>🔔</div>
                No {filter === "UNREAD" ? "unread " : ""}notifications
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.label}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: "var(--text-hint)",
                    padding: "10px 16px 4px",
                  }}>
                    {group.label}
                  </div>
                  {group.items.map((n) => {
                    const tc         = typeConfig[n.type] || typeConfig.INFO;
                    const senderDept = (n.metadata as any)?.senderDept;
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleClick(n)}
                        style={{
                          display: "flex", gap: 10, padding: "10px 14px",
                          cursor: n.actionUrl ? "pointer" : "default",
                          background: n.read ? "transparent" : "rgba(99,102,241,0.05)",
                          borderLeft: `3px solid ${n.read ? "transparent" : tc.color}`,
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-bg)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = n.read ? "transparent" : "rgba(99,102,241,0.05)"; }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                          background: tc.bg, border: `0.5px solid ${tc.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: tc.color,
                        }}>
                          {tc.icon}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: "var(--text-primary)", lineHeight: 1.3, paddingRight: 8 }}>
                              {n.title}
                              {!n.read && (
                                <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#22c55e", marginLeft: 5, verticalAlign: "middle" }} />
                              )}
                            </div>
                            <button
                              onClick={(e) => deleteNotif(e, n.id)}
                              title="Dismiss"
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-hint)", padding: "0 2px", flexShrink: 0 }}
                            >
                              ×
                            </button>
                          </div>

                          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4, marginTop: 2 }}>
                            {n.message}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, color: "var(--text-hint)" }}>
                              {new Date(n.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {senderDept && (
                              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--bg-input)", color: "var(--text-muted)", fontWeight: 600, border: "0.5px solid var(--border)" }}>
                                {senderDept}
                              </span>
                            )}
                            {n.actionUrl && (
                              <span style={{ fontSize: 10, color: tc.color, fontWeight: 700 }}>
                                View →
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "10px 14px", borderTop: "0.5px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              onClick={() => { setOpen(false); router.push("/notifications"); }}
              style={{ fontSize: 12, color: "var(--accent-text)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              View all →
            </button>
            <button
              onClick={clearRead}
              style={{ fontSize: 11, color: "var(--text-hint)", background: "none", border: "none", cursor: "pointer" }}
            >
              Clear read
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bellSlideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
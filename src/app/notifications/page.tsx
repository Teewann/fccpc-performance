"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "ALERT" | "SUCCESS";
  read: boolean;
  createdAt: string;
};

const typeConfig = {
  SUCCESS: { bg: "#052e16", color: "#4ade80", border: "#14532d", icon: "✓" },
  INFO:    { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", icon: "ℹ" },
  WARNING: { bg: "#1c1107", color: "#f59e0b", border: "#78350f", icon: "⚠" },
  ALERT:   { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", icon: "!" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState<"ALL" | "UNREAD">("ALL");

  useEffect(() => { fetchNotifications(); }, []);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res  = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(notifId: string) {
    await fetch("/api/notifications", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ notifId }),
    });
    fetchNotifications();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ markAllRead: true }),
    });
    fetchNotifications();
  }

  const filtered = filter === "UNREAD"
    ? notifications.filter((n) => !n.read)
    : notifications;

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Notifications
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{today}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 500,
                  border: "0.5px solid var(--border)", background: "var(--bg-card)",
                  color: "var(--text-muted)", cursor: "pointer",
                }}
              >
                Mark all read
              </button>
            )}
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
              borderRadius: 10, border: "1.5px solid #22c55e",
              background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600,
            }}>
              {unreadCount} unread
            </div>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 12, padding: 4, width: "fit-content" }}>
          {(["ALL", "UNREAD"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "9px 24px", borderRadius: 9, fontSize: 14, fontWeight: 500,
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
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>
            Loading notifications...
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔔</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
              All caught up
            </div>
            <div style={{ fontSize: 15, color: "var(--text-muted)" }}>
              No {filter === "UNREAD" ? "unread " : ""}notifications yet
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((n) => {
              const tc = typeConfig[n.type] || typeConfig.INFO;
              return (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className="card-bg"
                  style={{
                    borderRadius: 14, padding: "18px 20px",
                    cursor: n.read ? "default" : "pointer",
                    opacity: n.read ? 0.7 : 1,
                    borderLeft: `3px solid ${n.read ? "transparent" : tc.color}`,
                    transition: "opacity 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    {/* Icon */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: tc.bg, border: `0.5px solid ${tc.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontWeight: 700, color: tc.color,
                    }}>
                      {tc.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                          {n.title}
                          {!n.read && (
                            <span style={{
                              display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                              background: "#22c55e", marginLeft: 8, verticalAlign: "middle",
                            }} />
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-hint)", flexShrink: 0, marginLeft: 12 }}>
                          {new Date(n.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {n.message}
                      </div>
                      {!n.read && (
                        <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 8 }}>
                          Click to mark as read
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

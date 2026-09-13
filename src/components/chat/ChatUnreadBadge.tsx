"use client";
import { useEffect, useState, useCallback } from "react";

/**
 * Renders a green badge with total unread chat message count.
 * Place inside a position:relative wrapper on the chat icon in Sidebar.tsx.
 *
 * Usage in Sidebar.tsx:
 *   import { ChatUnreadBadge } from "@/components/chat/ChatUnreadBadge";
 *
 *   <Link href="/chat" style={{ position: "relative", ... }}>
 *     💬
 *     <ChatUnreadBadge />
 *   </Link>
 */
export function ChatUnreadBadge() {
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/conversations");
      if (!r.ok) return;
      const d = await r.json();
      const sum = (d.conversations ?? []).reduce(
        (acc: number, c: any) => acc + (c.unreadCount ?? 0), 0
      );
      setTotal(sum);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 30s — lightweight since conversations API is cached
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  if (total === 0) return null;

  return (
    <span style={{
      position: "absolute",
      top: -5, right: -5,
      minWidth: 18, height: 18,
      borderRadius: 9,
      background: "#25D366",
      color: "#fff",
      fontSize: 10, fontWeight: 800,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 4px", lineHeight: 1,
      border: "2px solid var(--bg-sidebar)",
      zIndex: 5,
      pointerEvents: "none",
    }}>
      {total > 99 ? "99+" : total}
    </span>
  );
}

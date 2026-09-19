"use client";
import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import { MessageBubble } from "./MessageBubble";
import type { Message, ChatUser, Conversation } from "./types";

interface Props {
  messages: Message[];
  currentUser: ChatUser;
  conversation: Conversation;
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onReply: (msg: Message) => void;
  onReact: (id: string, emoji: string) => Promise<void>;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onPin: (id: string, pinned: boolean) => void;
}

export function MessageArea({
  messages, currentUser, conversation, loading,
  loadingMore = false, hasMore = false, onLoadMore,
  onReply, onReact, onDelete, onEdit, onPin,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const prevLenRef   = useRef(0);
  const [showJump, setShowJump] = useState(false);
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Smart scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const len = messages.length;
    if (len === prevLenRef.current) return;
    const grew = len > prevLenRef.current;
    prevLenRef.current = len;
    if (!grew) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = dist < 220;
    const lastIsMine = messages[messages.length - 1]?.sender?.id === currentUser.id;
    if (nearBottom || lastIsMine) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    }
  }, [messages, currentUser.id]);

  // Jump to bottom on conv switch
  useEffect(() => {
    prevLenRef.current = 0;
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 60);
  }, [conversation.id]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop < 100 && hasMore && !loadingMore && onLoadMore) onLoadMore();
    setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 300);
  }, [hasMore, loadingMore, onLoadMore]);

  const jumpToMessage = useCallback((id: string) => {
    const el = msgRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.background = "rgba(37,211,102,0.15)";
    setTimeout(() => { el.style.background = ""; }, 1200);
  }, []);

  // Annotate messages with avatar/name display rules
  const annotated = useMemo(() => messages.map((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const sameAsPrev = prev && prev.sender.id === msg.sender.id
      && new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 3 * 60_000;
    const sameAsNext = next && next.sender.id === msg.sender.id
      && new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime() < 3 * 60_000;
    return {
      ...msg,
      showAvatar: !sameAsNext,
      showName: !sameAsPrev && conversation.isGroup && msg.sender.id !== currentUser.id,
    };
  }), [messages, conversation.isGroup, currentUser.id]);

  const grouped = useMemo(() => {
    const groups: { date: string; msgs: typeof annotated }[] = [];
    let cur = "";
    annotated.forEach(m => {
      const d = fmtDate(m.createdAt);
      if (d !== cur) { cur = d; groups.push({ date: d, msgs: [] }); }
      groups[groups.length - 1].msgs.push(m);
    });
    return groups;
  }, [annotated]);

  if (loading) return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--chat-bg)",
    }}>
      <Spinner />
    </div>
  );

  return (
    <div style={{ flex: 1, position: "relative", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="chat-message-area"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "12px 0 8px",
          // ✅ Background now driven by CSS class + var(--chat-bg)
          display: "flex",
          flexDirection: "column",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {loadingMore && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
            <Spinner />
          </div>
        )}
        {hasMore && !loadingMore && (
          <button onClick={onLoadMore} className="chat-load-more" style={{
            display: "block", margin: "4px auto 8px",
            padding: "5px 16px", borderRadius: 12,
            fontSize: 12, cursor: "pointer",
          }}>
            Load earlier messages
          </button>
        )}

        {messages.length === 0 ? (
          <EmptyConv conversation={conversation} currentUserId={currentUser.id} />
        ) : (
          grouped.map(({ date, msgs }) => (
            <div key={date} style={{ width: "100%" }}>
              <DateSep label={date} />
              {msgs.map(msg => (
                <div
                  key={msg.id}
                  ref={el => { if (el) msgRefs.current.set(msg.id, el); else msgRefs.current.delete(msg.id); }}
                  style={{ transition: "background 0.4s", borderRadius: 4, width: "100%", boxSizing: "border-box" }}
                >
                  <MessageBubble
                    message={msg}
                    isMine={msg.sender.id === currentUser.id}
                    currentUserId={currentUser.id}
                    isGroup={conversation.isGroup}
                    showAvatar={msg.showAvatar}
                    showName={msg.showName}
                    onReply={onReply}
                    onReact={onReact}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onPin={onPin}
                    onJumpTo={jumpToMessage}
                  />
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} style={{ height: 4 }} />
      </div>

      {showJump && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          style={{
            position: "absolute", bottom: 14, right: 16,
            width: 38, height: 38, borderRadius: "50%",
            background: "var(--bg-card)", border: "1px solid var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 10, fontSize: 16, color: "var(--text-muted)",
          }}
        >↓</button>
      )}
    </div>
  );
}

function DateSep({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 16px 8px" }}>
      <div className="chat-date-line" style={{ flex: 1, height: 1 }} />
      <span
        className="chat-date-label"
        style={{
          fontSize: 11, fontWeight: 600,
          padding: "3px 12px",
          borderRadius: 10, whiteSpace: "nowrap", letterSpacing: "0.04em",
        }}
      >{label}</span>
      <div className="chat-date-line" style={{ flex: 1, height: 1 }} />
    </div>
  );
}

function EmptyConv({ conversation, currentUserId }: { conversation: Conversation; currentUserId: string }) {
  const other = conversation.participants.find(p => p.id !== currentUserId);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40 }}>
      {conversation.isGroup ? (
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#128C7E,#25D366)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>
          👥
        </div>
      ) : (
      <UserAvatar user={{ name: other?.name ?? "?" }} userId={other?.id} size={64} />
      )}
      <div style={{ textAlign: "center" }}>
        <div className="chat-empty-title" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          {conversation.isGroup ? `Welcome to ${conversation.name}` : `Start chatting with ${other?.name ?? "this person"}`}
        </div>
        <div className="chat-empty-subtitle" style={{ fontSize: 13 }}>
          Messages are internal to FCCPC.
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <>
      <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2.5px solid var(--border)", borderTopColor: "#25D366", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

function fmtDate(ts: string) {
  const d = new Date(ts), now = new Date();
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diff < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
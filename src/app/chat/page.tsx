"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Sidebar from "@/components/layout/Sidebar";
import {
  ConversationList,
  ChatHeader,
  MessageArea,
  MessageInput,
  MemberPanel,
  PinnedMessagesBanner,
} from "@/components/chat";
import { NewChatModal } from "@/components/chat/NewChatModal";
import type { Conversation, Message, ChatUser } from "@/components/chat/types";

// ── mobile breakpoint ──────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return mobile;
}

export default function ChatPage() {
  const isMobile = useIsMobile();

  const [currentUser,    setCurrentUser]    = useState<ChatUser | null>(null);
  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [activeConvId,   setActiveConvId]   = useState<string | null>(null);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [loadingConvs,   setLoadingConvs]   = useState(true);
  const [loadingMsgs,    setLoadingMsgs]    = useState(false);
  const [showNewChat,    setShowNewChat]    = useState(false);
  const [showMembers,    setShowMembers]    = useState(false);
  const [showSearch,     setShowSearch]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [replyingTo,     setReplyingTo]     = useState<Message | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);

  // mobile: which pane is visible
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const sseRef    = useRef<EventSource | null>(null);
  const convIdRef = useRef<string | null>(null);

  // ── Current user ────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings/account")
      .then(r => r.json())
      .then(d => { if (d.user) setCurrentUser(d.user); })
      .catch(() => {});
  }, []);

  // ── Conversations ───────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/conversations");
      const d = await r.json();
      setConversations(d.conversations || []);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── SSE real-time ───────────────────────────────────────────────
  useEffect(() => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    if (!activeConvId) { setMessages([]); return; }

    convIdRef.current = activeConvId;
    setLoadingMsgs(true);

    fetch(`/api/chat/messages?conversationId=${activeConvId}`)
      .then(r => r.json())
      .then(d => {
        if (convIdRef.current !== activeConvId) return;
        const msgs = d.messages || [];
        setMessages(msgs);
        setPinnedMessages(msgs.filter((m: Message) => m.pinned));
        setLoadingMsgs(false);
      })
      .catch(() => setLoadingMsgs(false));

    const sse = new EventSource(`/api/chat/stream?conversationId=${activeConvId}`);
    sseRef.current = sse;

    sse.onmessage = (e) => {
      if (convIdRef.current !== activeConvId) return;
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === "new_message") {
          setMessages(prev => {
            if (prev.find(m => m.id === ev.message.id)) return prev;
            return [...prev.filter(m => !m.id.startsWith("opt_")), ev.message];
          });
          loadConversations();
        } else if (ev.type === "message_edited") {
          setMessages(prev => prev.map(m => m.id === ev.message.id ? { ...m, ...ev.message } : m));
        } else if (ev.type === "message_deleted") {
          setMessages(prev => prev.filter(m => m.id !== ev.messageId));
        } else if (ev.type === "reaction_update") {
          setMessages(prev => prev.map(m => m.id === ev.messageId ? { ...m, reactions: ev.reactions } : m));
        } else if (ev.type === "pin_update") {
          setMessages(prev => prev.map(m => m.id === ev.messageId ? { ...m, pinned: ev.pinned } : m));
          // FIX: use functional update so we don't need messages in dep array
          setPinnedMessages(prev =>
            ev.pinned
              ? [...prev.filter(m => m.id !== ev.messageId), ev.message]
              : prev.filter(m => m.id !== ev.messageId)
          );
        }
      } catch {}
    };

    sse.onerror = () => {
      sse.close();
      const iv = setInterval(() => {
        if (convIdRef.current !== activeConvId) { clearInterval(iv); return; }
        fetch(`/api/chat/messages?conversationId=${activeConvId}`)
          .then(r => r.json())
          .then(d => { if (convIdRef.current === activeConvId) setMessages(d.messages || []); })
          .catch(() => {});
      }, 5000);
    };

    return () => { sse.close(); };
  }, [activeConvId, loadConversations]);

  // ── Send message ────────────────────────────────────────────────
  const sendMessage = useCallback(async (params: {
    content?: string; fileUrl?: string; fileName?: string; fileType?: string;
  }) => {
    if (!activeConvId || !currentUser) return;
    const { content, fileUrl, fileName, fileType } = params;
    if (!content?.trim() && !fileUrl) return;

    const optId = `opt_${Date.now()}`;
    const optMsg: Message = {
      id: optId, conversationId: activeConvId,
      content: content || null, fileUrl: fileUrl || null,
      fileName: fileName || null, fileType: fileType || null,
      edited: false, pinned: false,
      createdAt: new Date().toISOString(),
      sender: { id: currentUser.id, name: currentUser.name, photo: currentUser.photo },
      replyTo: replyingTo ? {
        id: replyingTo.id, content: replyingTo.content,
        fileName: replyingTo.fileName, sender: { name: replyingTo.sender.name },
      } : null,
      reactions: [],
    };
    setMessages(prev => [...prev, optMsg]);
    setReplyingTo(null);

    try {
      const r = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          content: content || null, fileUrl: fileUrl || null,
          fileName: fileName || null, fileType: fileType || null,
          replyToId: replyingTo?.id || null,
        }),
      });
      const d = await r.json();
      setMessages(prev => prev.map(m => m.id === optId ? d.message : m));
      loadConversations();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optId));
    }
  }, [activeConvId, currentUser, replyingTo, loadConversations]);

  // ── Message actions ─────────────────────────────────────────────
  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const rs = m.reactions || [];
      const mine = rs.find(r => r.userId === currentUser.id);
      if (mine?.emoji === emoji) return { ...m, reactions: rs.filter(r => r.userId !== currentUser.id) };
      return { ...m, reactions: [...rs.filter(r => r.userId !== currentUser.id), { id: "opt", emoji, userId: currentUser.id, user: { name: currentUser.name } }] };
    }));
    await fetch("/api/chat/reactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, emoji }),
    }).catch(() => {});
  }, [currentUser]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    await fetch(`/api/chat/messages?messageId=${messageId}`, { method: "DELETE" }).catch(() => {});
    loadConversations();
  }, [loadConversations]);

  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, edited: true } : m));
    await fetch("/api/chat/messages", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, content: newContent }),
    }).catch(() => {});
  }, []);

  const handlePinMessage = useCallback(async (messageId: string, pinned: boolean) => {
    // FIX: update both states independently, no dependency on messages array
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pinned } : m));
    setPinnedMessages(prev => {
      if (pinned) {
        // Find message in current messages state via closure won't work reliably
        // We'll update it from SSE or re-fetch — optimistically add placeholder
        return prev.some(m => m.id === messageId) ? prev : prev; // SSE will handle add
      }
      return prev.filter(m => m.id !== messageId);
    });
    await fetch("/api/chat/messages", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, pinned }),
    }).catch(() => {});
  }, []);

  const handleStartConversation = useCallback(async (
    participantIds: string[], isGroup: boolean, groupName?: string
  ) => {
    const r = await fetch("/api/chat/conversations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantIds, isGroup, name: groupName }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Failed");
    await loadConversations();
    setActiveConvId(d.conversation.id);
    if (isMobile) setMobileView("chat");
  }, [loadConversations, isMobile]);

  const handleSelectConv = useCallback((id: string) => {
    setActiveConvId(id);
    setShowMembers(false);
    setReplyingTo(null);
    setSearchQuery("");
    setShowSearch(false);
    if (isMobile) setMobileView("chat");
  }, [isMobile]);

  const handleBackToList = useCallback(() => {
    setMobileView("list");
    setActiveConvId(null);
  }, []);

  const activeConv = useMemo(
    () => conversations.find(c => c.id === activeConvId) || null,
    [conversations, activeConvId]
  );

  // ── Search filtered messages ────────────────────────────────────
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.content?.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  // ── LAYOUT ─────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", height: "100vh",
      background: "var(--bg-page)", overflow: "hidden",
      // Critical: constrain total width so nothing overflows right
      maxWidth: "100vw",
    }}>
      {/* Hide sidebar on mobile */}
      {!isMobile && <Sidebar />}

      {showNewChat && currentUser && (
        <NewChatModal
          currentUserId={currentUser.id}
          onClose={() => setShowNewChat(false)}
          onStart={handleStartConversation}
        />
      )}

      {/* Main chat layout — fills remaining space, never overflows */}
      <div style={{
        flex: 1, display: "flex", minWidth: 0,
        overflow: "hidden", position: "relative",
      }}>

        {/* ── Conversation list panel ─────────────────────────── */}
        {/* Desktop: always visible. Mobile: visible only on "list" view */}
        <div style={{
          width: isMobile ? "100%" : 300,
          maxWidth: isMobile ? "100%" : 300,
          flexShrink: 0,
          display: (isMobile && mobileView === "chat") ? "none" : "flex",
          flexDirection: "column",
          borderRight: isMobile ? "none" : "1px solid var(--border-soft)",
          background: "var(--bg-card)",
          height: "100%",
        }}>
          <ConversationList
            conversations={conversations}
            activeConvId={activeConvId}
            currentUserId={currentUser?.id || ""}
            loading={loadingConvs}
            onSelect={handleSelectConv}
            onNewChat={() => setShowNewChat(true)}
          />
        </div>

        {/* ── Chat area ───────────────────────────────────────── */}
        {/* Desktop: flex:1 beside list. Mobile: full screen when chat view */}
        <div style={{
          flex: 1,
          display: (!isMobile || mobileView === "chat") ? "flex" : "none",
          flexDirection: "column",
          // KEY FIX: minWidth:0 prevents flex children from overflowing
          minWidth: 0,
          overflow: "hidden",
          height: "100%",
        }}>
          {activeConv && currentUser ? (
            <>
              <ChatHeader
                conversation={activeConv}
                currentUserId={currentUser.id}
                showMembers={showMembers}
                showSearch={showSearch}
                isMobile={isMobile}
                onBack={handleBackToList}
                onToggleMembers={() => setShowMembers(v => !v)}
                onToggleSearch={() => {
                  setShowSearch(v => !v);
                  setSearchQuery("");
                }}
              />

              {/* Search bar (slides in under header) */}
              {showSearch && (
                <div style={{
                  padding: "8px 16px", flexShrink: 0,
                  borderBottom: "1px solid var(--border-soft)",
                  background: "var(--bg-card)",
                }}>
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search messages in this conversation…"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "9px 14px", borderRadius: 20,
                      border: "1px solid var(--border)",
                      background: "var(--bg-input)",
                      color: "var(--text-primary)", fontSize: 13, outline: "none",
                    }}
                  />
                  {searchQuery && (
                    <div style={{ fontSize: 11, color: "var(--text-hint)", marginTop: 5, paddingLeft: 4 }}>
                      {filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              )}

              {/* Pinned messages banner */}
              {pinnedMessages.length > 0 && (
                <PinnedMessagesBanner
                  messages={pinnedMessages}
                  onUnpin={id => handlePinMessage(id, false)}
                />
              )}

              <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
                  <MessageArea
                    messages={showSearch && searchQuery ? filteredMessages : messages}
                    currentUser={currentUser}
                    conversation={activeConv}
                    loading={loadingMsgs}
                    onReply={setReplyingTo}
                    onReact={handleReact}
                    onDelete={handleDeleteMessage}
                    onEdit={handleEditMessage}
                    onPin={handlePinMessage}
                  />
                  <MessageInput
                    conversationId={activeConvId!}
                    replyingTo={replyingTo}
                    onCancelReply={() => setReplyingTo(null)}
                    onSend={sendMessage}
                  />
                </div>

                {showMembers && !isMobile && (
                  <MemberPanel
                    conversation={activeConv}
                    currentUserId={currentUser.id}
                    onClose={() => setShowMembers(false)}
                  />
                )}
              </div>
            </>
          ) : (
            !isMobile && <EmptyState onNewChat={() => setShowNewChat(true)} />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg-page)", gap: 20, padding: 24,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: "linear-gradient(135deg,#128C7E,#25D366)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          FCCPC Messaging
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 280, lineHeight: 1.6 }}>
          Select a conversation or start a new one to begin messaging colleagues.
        </div>
      </div>
      <button onClick={onNewChat} style={{
        padding: "11px 28px", borderRadius: 22,
        border: "none", background: "#25D366",
        color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
        boxShadow: "0 4px 14px rgba(37,211,102,0.4)",
      }}>
        Start a Conversation
      </button>
    </div>
  );
}
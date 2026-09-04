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
  NewChatModal,
  PinnedMessagesBanner,
} from "@/components/chat";
import type { Conversation, Message, ChatUser } from "@/components/chat/types";

export default function ChatPage() {
  const [currentUser, setCurrentUser]       = useState<ChatUser | null>(null);
  const [conversations, setConversations]   = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId]     = useState<string | null>(null);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs]     = useState(true);
  const [loadingMsgs, setLoadingMsgs]       = useState(false);
  const [showNewChat, setShowNewChat]       = useState(false);
  const [showMembers, setShowMembers]       = useState(false);
  const [showSearch, setShowSearch]         = useState(false);
  const [replyingTo, setReplyingTo]         = useState<Message | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);

  const sseRef    = useRef<EventSource | null>(null);
  const convIdRef = useRef<string | null>(null);

  // ── Current user ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings/account")
      .then(r => r.json())
      .then(d => { if (d.user) setCurrentUser(d.user); })
      .catch(() => {});
  }, []);

  // ── Conversations (initial + refresh) ───────────────────────────────
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

  // ── SSE: real-time messages ──────────────────────────────────────────
  useEffect(() => {
    // Close previous SSE
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    if (!activeConvId) { setMessages([]); return; }

    convIdRef.current = activeConvId;
    setLoadingMsgs(true);

    // Load messages via REST first (fast initial load)
    fetch(`/api/chat/messages?conversationId=${activeConvId}`)
      .then(r => r.json())
      .then(d => {
        if (convIdRef.current !== activeConvId) return;
        setMessages(d.messages || []);
        setPinnedMessages((d.messages || []).filter((m: Message) => m.pinned));
        setLoadingMsgs(false);
      })
      .catch(() => setLoadingMsgs(false));

    // Open SSE for live updates
    const sse = new EventSource(`/api/chat/stream?conversationId=${activeConvId}`);
    sseRef.current = sse;

    sse.onmessage = (e) => {
      if (convIdRef.current !== activeConvId) return;
      try {
        const event = JSON.parse(e.data);
        if (event.type === "new_message") {
          setMessages(prev => {
            // Replace optimistic or append
            const exists = prev.find(m => m.id === event.message.id);
            if (exists) return prev;
            const withoutOptimistic = prev.filter(m => !m.id.startsWith("opt_"));
            return [...withoutOptimistic, event.message];
          });
          loadConversations(); // refresh sidebar preview
        } else if (event.type === "message_edited") {
          setMessages(prev => prev.map(m =>
            m.id === event.message.id ? { ...m, ...event.message } : m
          ));
        } else if (event.type === "message_deleted") {
          setMessages(prev => prev.filter(m => m.id !== event.messageId));
        } else if (event.type === "reaction_update") {
          setMessages(prev => prev.map(m =>
            m.id === event.messageId ? { ...m, reactions: event.reactions } : m
          ));
        } else if (event.type === "pin_update") {
          setMessages(prev => prev.map(m =>
            m.id === event.messageId ? { ...m, pinned: event.pinned } : m
          ));
          setPinnedMessages(prev =>
            event.pinned
              ? [...prev, event.message].filter((v,i,a) => a.findIndex(x=>x.id===v.id)===i)
              : prev.filter(m => m.id !== event.messageId)
          );
        }
      } catch {}
    };

    sse.onerror = () => {
      // On SSE error, fall back to polling every 5s
      sse.close();
      const interval = setInterval(() => {
        if (convIdRef.current !== activeConvId) { clearInterval(interval); return; }
        fetch(`/api/chat/messages?conversationId=${activeConvId}`)
          .then(r => r.json())
          .then(d => {
            if (convIdRef.current === activeConvId) {
              setMessages(d.messages || []);
            }
          })
          .catch(() => {});
      }, 5000);
      return () => clearInterval(interval);
    };

    return () => { sse.close(); };
  }, [activeConvId, loadConversations]);

  // ── Send message (optimistic) ────────────────────────────────────────
  const sendMessage = useCallback(async (params: {
    content?: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
  }) => {
    if (!activeConvId || !currentUser) return;
    const { content, fileUrl, fileName, fileType } = params;
    if (!content?.trim() && !fileUrl) return;

    // Optimistic append
    const optId = `opt_${Date.now()}`;
    const optMsg: Message = {
      id: optId,
      conversationId: activeConvId,
      content: content || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
      edited: false,
      pinned: false,
      createdAt: new Date().toISOString(),
      sender: { id: currentUser.id, name: currentUser.name, photo: currentUser.photo },
      replyTo: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        fileName: replyingTo.fileName,
        sender: { name: replyingTo.sender.name },
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
          content: content || null,
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          fileType: fileType || null,
          replyToId: replyingTo?.id || null,
        }),
      });
      const d = await r.json();
      // Replace optimistic with real
      setMessages(prev => prev.map(m => m.id === optId ? d.message : m));
      loadConversations();
    } catch {
      // Remove optimistic on failure
      setMessages(prev => prev.filter(m => m.id !== optId));
    }
  }, [activeConvId, currentUser, replyingTo, loadConversations]);

  // ── Message actions ──────────────────────────────────────────────────
  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    // Optimistic
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions = m.reactions || [];
      const myReaction = reactions.find(r => r.userId === currentUser.id);
      if (myReaction?.emoji === emoji) {
        return { ...m, reactions: reactions.filter(r => r.userId !== currentUser.id) };
      }
      const others = reactions.filter(r => r.userId !== currentUser.id);
      return { ...m, reactions: [...others, { id: "opt", emoji, userId: currentUser.id, user: { name: currentUser.name } }] };
    }));
    await fetch("/api/chat/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, emoji }),
    }).catch(() => {});
  }, [currentUser]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    await fetch(`/api/chat/messages?messageId=${messageId}`, { method: "DELETE" }).catch(() => {});
    loadConversations();
  }, [loadConversations]);

  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, content: newContent, edited: true } : m
    ));
    await fetch("/api/chat/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, content: newContent }),
    }).catch(() => {});
  }, []);

  const handlePinMessage = useCallback(async (messageId: string, pinned: boolean) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, pinned } : m
    ));
    setPinnedMessages(prev =>
      pinned
        ? [...prev, messages.find(m => m.id === messageId)!].filter(Boolean)
        : prev.filter(m => m.id !== messageId)
    );
    await fetch("/api/chat/messages/pin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, pinned }),
    }).catch(() => {});
  }, [messages]);

  const handleStartConversation = useCallback(async (
    participantIds: string[], isGroup: boolean, groupName?: string
  ) => {
    const r = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantIds, isGroup, name: groupName }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Failed");
    await loadConversations();
    setActiveConvId(d.conversation.id);
  }, [loadConversations]);

  const activeConv = useMemo(
    () => conversations.find(c => c.id === activeConvId) || null,
    [conversations, activeConvId]
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-page)", overflow: "hidden" }}>
      <Sidebar />

      {/* ── New Chat Modal ── */}
      {showNewChat && currentUser && (
        <NewChatModal
          currentUserId={currentUser.id}
          onClose={() => setShowNewChat(false)}
          onStart={handleStartConversation}
        />
      )}

      {/* ── Main chat layout ── */}
      <div style={{ flex: 1, display: "flex", minWidth: 0, overflow: "hidden" }}>

        {/* Conversation sidebar */}
        <ConversationList
          conversations={conversations}
          activeConvId={activeConvId}
          currentUserId={currentUser?.id || ""}
          loading={loadingConvs}
          onSelect={id => { setActiveConvId(id); setShowMembers(false); setReplyingTo(null); }}
          onNewChat={() => setShowNewChat(true)}
        />

        {/* Chat area */}
        {activeConv && currentUser ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
            <ChatHeader
              conversation={activeConv}
              currentUserId={currentUser.id}
              showMembers={showMembers}
              showSearch={showSearch}
              onToggleMembers={() => setShowMembers(v => !v)}
              onToggleSearch={() => setShowSearch(v => !v)}
            />

            {pinnedMessages.length > 0 && (
              <PinnedMessagesBanner
                messages={pinnedMessages}
                onUnpin={id => handlePinMessage(id, false)}
              />
            )}

            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <MessageArea
                  messages={messages}
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

              {showMembers && (
                <MemberPanel
                  conversation={activeConv}
                  currentUserId={currentUser.id}
                  onClose={() => setShowMembers(false)}
                />
              )}
            </div>
          </div>
        ) : (
          <EmptyState onNewChat={() => setShowNewChat(true)} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg-page)", gap: 20,
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <ChatBubbleIcon size={36} color="var(--text-hint)" />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          FCCPC Messaging
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 300, lineHeight: 1.6 }}>
          Connect with colleagues across the organisation. Select a conversation or start a new one.
        </div>
      </div>
      <button onClick={onNewChat} style={{
        padding: "11px 28px", borderRadius: 10,
        border: "1.5px solid var(--accent)",
        background: "var(--accent-bg-strong, #052e16)",
        color: "var(--accent-text)", fontSize: 14, fontWeight: 600,
        cursor: "pointer",
      }}>
        Start a Conversation
      </button>
    </div>
  );
}

function ChatBubbleIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

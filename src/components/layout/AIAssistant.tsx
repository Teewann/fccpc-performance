"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
};

// ─── Quick suggestions ────────────────────────────────────────────────
const QUICK_CHIPS = [
  "How am I performing this month?",
  "How many logs did I submit this week?",
  "What is the leave policy?",
  "Show me my pending reviews",
  "Who are the top performers?",
  "What tasks are assigned to me?",
];

// ─── Unique ID ────────────────────────────────────────────────────────
let msgId = 0;
function uid() { return String(++msgId); }

// ─── Helper: clamp a value between min and max ───────────────────────
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// ─── Component ────────────────────────────────────────────────────────
export default function AIAssistant() {
  const [open,        setOpen]        = useState(false);
  const [messages,    setMessages]    = useState<Message[]>([
    {
      id:      uid(),
      role:    "assistant",
      content: "Hello! I am your FCCPC performance assistant. I can answer questions about your logs, performance score, leave, tasks, and how to use the system. What do you need?",
    },
  ]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [unread,      setUnread]      = useState(0);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  // ─── Dragging state ────────────────────────────────────────────────
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, startLeft: 0, startTop: 0 });
  const fabRef = useRef<HTMLButtonElement>(null);

  // Load saved position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("ai_assistant_pos");
    if (saved) {
      try {
        const { x, y } = JSON.parse(saved);
        setPosition({ x, y });
      } catch {}
    } else {
      // Default: bottom 24, right 24 (relative to viewport)
      setPosition({ x: window.innerWidth - 76, y: window.innerHeight - 76 });
    }
  }, []);

  // Save position when changed
  useEffect(() => {
    localStorage.setItem("ai_assistant_pos", JSON.stringify(position));
  }, [position]);

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      startLeft: position.x,
      startTop: position.y,
    };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    let newLeft = dragStart.current.startLeft + dx;
    let newTop  = dragStart.current.startTop + dy;

    // Clamp to viewport (leave 20px margin)
    const maxX = window.innerWidth - (fabRef.current?.offsetWidth || 52) - 20;
    const maxY = window.innerHeight - (fabRef.current?.offsetHeight || 52) - 20;
    newLeft = clamp(newLeft, 20, maxX);
    newTop  = clamp(newTop, 20, maxY);

    setPosition({ x: newLeft, y: newTop });
  }, [isDragging]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
const onTouchStart = (e: React.TouchEvent) => {
  const touch = e.touches[0];
  setIsDragging(true);
  dragStart.current = {
    x: touch.clientX,
    y: touch.clientY,
    startLeft: position.x,
    startTop: position.y,
  };
};

const onTouchMove = useCallback((e: TouchEvent) => {
  if (!isDragging) return;
  const touch = e.touches[0];
  const dx = touch.clientX - dragStart.current.x;
  const dy = touch.clientY - dragStart.current.y;
  let newLeft = dragStart.current.startLeft + dx;
  let newTop  = dragStart.current.startTop + dy;

  const maxX = window.innerWidth - (fabRef.current?.offsetWidth || 52) - 20;
  const maxY = window.innerHeight - (fabRef.current?.offsetHeight || 52) - 20;
  newLeft = clamp(newLeft, 20, maxX);
  newTop  = clamp(newTop, 20, maxY);

  setPosition({ x: newLeft, y: newTop });
}, [isDragging]);

const onTouchEnd = useCallback(() => {
  setIsDragging(false);
}, []);


  useEffect(() => {
  if (isDragging) {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  } else {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
  }
  return () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
  };
}, [isDragging, onMouseMove, onMouseUp, onTouchMove, onTouchEnd]);

  // ─── Chat logic ────────────────────────────────────────────────────
  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");

    // Add user message
    const userMsg: Message = { id: uid(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // Add loading placeholder
    const loadingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: loadingId, role: "assistant", content: "", loading: true },
    ]);

    try {
      // Build history for API (exclude loading placeholder)
      const history = [...messages, userMsg].map((m) => ({
        role:    m.role,
        content: m.content,
      }));

      const res  = await fetch("/api/ai-assistant", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ messages: history }),
      });

      const data = await res.json();
      const reply = res.ok
        ? (data.reply || "I could not generate a response.")
        : "Sorry, I encountered an error. Please try again.";

      // Replace loading placeholder with real reply
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { id: loadingId, role: "assistant", content: reply }
            : m
        )
      );

      // Increment unread if panel is closed
      if (!open) setUnread((p) => p + 1);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { id: loadingId, role: "assistant", content: "Network error. Please check your connection and try again." }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [loading, messages, open]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearChat() {
    setMessages([{
      id:      uid(),
      role:    "assistant",
      content: "Chat cleared. How can I help you?",
    }]);
  }

  // ── Styles ────────────────────────────────────────────────────────
  const fabStyle: React.CSSProperties = {
    position:     "fixed",
    left:         position.x,
    top:          position.y,
    width:        52,
    height:       52,
    borderRadius: "50%",
    background:   "#052e16",
    border:       "1.5px solid #22c55e",
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    cursor:       "grab",
    zIndex:       9999,
    boxShadow:    "none",
    transition:   isDragging ? "none" : "transform 0.15s",
    userSelect:   "none",
  };

  const panelStyle: React.CSSProperties = {
    position:      "fixed",
    bottom:        88,
    right:         24,
    width:         370,
    height:        540,
    background:    "var(--bg-card)",
    border:        "0.5px solid var(--border)",
    borderRadius:  16,
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
    zIndex:        9998,
    opacity:       open ? 1 : 0,
    pointerEvents: open ? "all" : "none",
    transform:     open ? "translateY(0)" : "translateY(10px)",
    transition:    "opacity 0.2s, transform 0.2s",
  };

  return (
    <>
      {/* ── Draggable floating button ───────────────────────────────── */}
      <button
  ref={fabRef}
  onClick={() => !isDragging && setOpen((p) => !p)}
  onMouseDown={onMouseDown}
  onTouchStart={onTouchStart}
  style={fabStyle}
  aria-label="Open AI assistant"
  title="Drag to move · Click to open"
>
        <span style={{ fontSize: 22, color: "#4ade80" }}>
          {open ? "✕" : "✦"}
        </span>
        {unread > 0 && !open && (
          <span style={{
            position:      "absolute",
            top:           -4,
            right:         -4,
            width:         18,
            height:        18,
            borderRadius:  "50%",
            background:    "#22c55e",
            border:        "2px solid var(--bg-page)",
            display:       "flex",
            alignItems:    "center",
            justifyContent: "center",
            fontSize:      10,
            fontWeight:    700,
            color:         "#052e16",
          }}>
            {unread}
          </span>
        )}
      </button>

      {/* ── Panel (unchanged) ───────────────────────────────────────── */}
      <div style={panelStyle} role="dialog" aria-label="FCCPC AI assistant">

        {/* Header */}
        <div style={{ padding: "14px 16px", background: "#052e16", borderBottom: "0.5px solid #14532d", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#14532d", border: "1.5px solid #22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#4ade80", flexShrink: 0 }}>
            ✦
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f0fdf4" }}>FCCPC Assistant</div>
            <div style={{ fontSize: 11, color: "#86efac", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              AI-powered · knows your data
            </div>
          </div>
          <button onClick={clearChat} title="Clear chat" style={{ background: "none", border: "none", color: "#86efac", fontSize: 13, cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}>
            Clear
          </button>
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "#86efac", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 4 }}>
            ✕
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>

              {/* Avatar */}
              <div style={{
                width:          26,
                height:         26,
                borderRadius:   "50%",
                flexShrink:     0,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                fontSize:       msg.role === "user" ? 10 : 13,
                fontWeight:     600,
                background:     msg.role === "user" ? "var(--bg-input)" : "#052e16",
                border:         `1px solid ${msg.role === "user" ? "var(--border)" : "#14532d"}`,
                color:          msg.role === "user" ? "var(--text-muted)" : "#4ade80",
              }}>
                {msg.role === "user" ? "ME" : "✦"}
              </div>

              {/* Bubble */}
              <div style={{
                maxWidth:     "78%",
                padding:      "9px 12px",
                borderRadius: 14,
                fontSize:     13,
                lineHeight:   1.55,
                whiteSpace:   "pre-wrap",
                wordBreak:    "break-word",
                ...(msg.role === "user" ? {
                  background:            "#052e16",
                  border:                "0.5px solid #14532d",
                  color:                 "#d1fae5",
                  borderBottomRightRadius: 4,
                } : {
                  background:           "var(--bg-input)",
                  border:               "0.5px solid var(--border)",
                  color:                "var(--text-primary)",
                  borderBottomLeftRadius: 4,
                }),
              }}>
                {msg.loading ? (
                  <span style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{
                        width:     7,
                        height:    7,
                        borderRadius: "50%",
                        background: "var(--text-hint)",
                        display:   "inline-block",
                        animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </span>
                ) : msg.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick chips — show only on first message */}
        {messages.length <= 1 && (
          <div style={{ padding: "8px 14px 4px", display: "flex", gap: 6, flexWrap: "wrap", borderTop: "0.5px solid var(--border-soft)", flexShrink: 0 }}>
            {QUICK_CHIPS.slice(0, 4).map((chip) => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                style={{
                  fontSize:   11,
                  padding:    "5px 10px",
                  borderRadius: 20,
                  border:     "0.5px solid var(--border)",
                  background: "var(--bg-input)",
                  color:      "var(--text-muted)",
                  cursor:     "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "10px 14px 14px", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0, borderTop: "0.5px solid var(--border-soft)" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
            }}
            onKeyDown={handleKey}
            placeholder="Ask about your performance, logs, leave..."
            rows={1}
            disabled={loading}
            style={{
              flex:        1,
              resize:      "none",
              fontSize:    13,
              padding:     "8px 12px",
              borderRadius: 10,
              maxHeight:   80,
              fontFamily:  "inherit",
              lineHeight:  1.4,
              background:  "var(--bg-input)",
              border:      "0.5px solid var(--border)",
              color:       "var(--text-primary)",
              outline:     "none",
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            aria-label="Send"
            style={{
              width:          36,
              height:         36,
              borderRadius:   "50%",
              flexShrink:     0,
              background:     loading || !input.trim() ? "var(--bg-input)" : "#052e16",
              border:         `1.5px solid ${loading || !input.trim() ? "var(--border)" : "#22c55e"}`,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              cursor:         loading || !input.trim() ? "not-allowed" : "pointer",
              fontSize:       16,
              color:          loading || !input.trim() ? "var(--text-hint)" : "#4ade80",
              transition:     "all 0.15s",
            }}
          >
            ➤
          </button>
        </div>
      </div>

      {/* Pulse animation for typing dots */}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
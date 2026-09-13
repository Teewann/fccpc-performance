"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  SendIcon, AttachIcon, MicIcon, MicOffIcon, EmojiIcon, CloseIcon,
  FileIcon, ImageIcon,
} from "./Icons";
import type { Message, UploadedFile } from "./types";

interface Props {
  conversationId: string;
  replyingTo: Message | null;
  onCancelReply: () => void;
  onSend: (params: { content?: string; fileUrl?: string; fileName?: string; fileType?: string }) => Promise<void>;
}

// ── Grouped emoji palette — 96 emojis organized by category ───────
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥳"],
  },
  {
    label: "Gestures",
    emojis: ["👍","👎","👌","✌️","🤞","🤝","🙏","👏","🙌","💪","🤙","👋","✋","🖐","☝️","👆","👇","👈","👉","✊","👊","🤛","🤜"],
  },
  {
    label: "Hearts",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖","💘","💝"],
  },
  {
    label: "Office",
    emojis: ["📋","📝","📌","📍","📎","🖇️","📁","📂","🗂️","📊","📈","📉","📅","📆","🗓️","💼","💻","🖥️","⌨️","🖱️","🖨️","📱","☎️","📞","📠","🔌","🔋"],
  },
  {
    label: "Symbols",
    emojis: ["✅","❌","⚠️","💡","🔥","⭐","🌟","✨","⚡","🎯","🚀","🏆","🎉","🎊","🎁","🔔","🔕","✔️","✖️","➕","➖","➡️","⬅️","⬆️","⬇️","🔄","🔃","♻️"],
  },
  {
    label: "Reactions",
    emojis: ["🤔","🤨","😐","😑","😶","🙄","😏","😒","😔","😞","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱"],
  },
];

const ALL_EMOJIS = EMOJI_GROUPS.flatMap(g => g.emojis);

export function MessageInput({ conversationId, replyingTo, onCancelReply, onSend }: Props) {
  const [text,            setText]            = useState("");
  const [sending,         setSending]         = useState(false);
  const [uploading,       setUploading]       = useState(false);
  const [uploadName,      setUploadName]      = useState("");
  const [filePending,     setFilePending]     = useState<UploadedFile | null>(null);
  const [isRecording,     setIsRecording]     = useState(false);
  const [recSeconds,      setRecSeconds]      = useState(0);
  const [showEmoji,       setShowEmoji]       = useState(false);
  const [emojiGroup,      setEmojiGroup]      = useState(0);

  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const recorderRef    = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<Blob[]>([]);
  const recTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const resizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, []);

  useEffect(() => { resizeTextarea(); }, [text, resizeTextarea]);

  useEffect(() => {
    if (replyingTo) setTimeout(() => inputRef.current?.focus(), 50);
  }, [replyingTo]);

  const handleSend = useCallback(async () => {
    if (sending || uploading) return;
    const content = text.trim();
    if (!content && !filePending) return;

    setSending(true);
    try {
      await onSend({
        content: content || undefined,
        fileUrl:   filePending?.url,
        fileName:  filePending?.name,
        fileType:  filePending?.type,
      });
      setText("");
      setFilePending(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setSending(false);
    }
  }, [sending, uploading, text, filePending, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      alert("File too large — max 100 MB");
      return;
    }
    setUploading(true);
    setUploadName(file.name);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/chat/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d.url) {
        setFilePending({ url: d.url, name: d.fileName || file.name, type: d.fileType || file.type });
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        alert("Upload failed: " + (d.error || "Unknown error"));
      }
    } finally {
      setUploading(false);
      setUploadName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => stream.getTracks().forEach(t => t.stop());
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      alert("Microphone access denied.");
    }
  };

  const cancelRecording = () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recorderRef.current?.stop();
    chunksRef.current = [];
    setIsRecording(false);
    setRecSeconds(0);
  };

  const sendRecording = async () => {
    if (!recorderRef.current) return;
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setIsRecording(false);
    const recorder = recorderRef.current;
    await new Promise<void>(res => { recorder.onstop = () => res(); recorder.stop(); });

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    setRecSeconds(0);
    if (!blob.size) return;

    setUploading(true);
    setUploadName("Voice note");
    const fd = new FormData();
    fd.append("file", blob, `voice-${Date.now()}.webm`);
    try {
      const r = await fetch("/api/chat/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d.url) {
        await onSend({ fileUrl: d.url, fileName: "Voice note", fileType: "audio/webm" });
      }
    } finally {
      setUploading(false);
      setUploadName("");
    }
  };

  const fmt = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;

  // Blue accent colors for controls
  const BLUE      = "#60a5fa";
  const BLUE_BG   = "#0c1a2e";
  const BLUE_BDR  = "#1e3a5f";
  const BLUE_SOFT = "rgba(96,165,250,0.15)";

  return (
    <div style={{
      flexShrink: 0,
      borderTop: "1px solid var(--border-soft)",
      background: "var(--bg-card)",
      padding: "10px 16px 12px",
      position: "relative",
    }}>
      {uploading && (
        <div style={{
          position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
          marginBottom: 8, padding: "8px 16px", borderRadius: 8,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap",
          zIndex: 10,
        }}>
          <Spinner />
          Uploading <strong>{uploadName.length > 30 ? uploadName.slice(0,30)+"…" : uploadName}</strong>
        </div>
      )}

      {/* Emoji palette — grouped, 96 emojis */}
      {showEmoji && (
        <div style={{
          position: "absolute", bottom: "100%", left: 16,
          marginBottom: 6,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, overflow: "hidden",
          width: 340, zIndex: 50,
          boxShadow: "0 8px 28px rgba(0,0,0,0.3)",
        }}>
          {/* Category tabs */}
          <div style={{
            display: "flex", gap: 2, padding: "6px 6px 4px",
            borderBottom: "1px solid var(--border-soft)",
            overflowX: "auto",
          }}>
            {EMOJI_GROUPS.map((g, i) => (
              <button
                key={g.label}
                onClick={() => setEmojiGroup(i)}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11,
                  fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                  border: emojiGroup === i ? `1px solid ${BLUE_BDR}` : "1px solid transparent",
                  background: emojiGroup === i ? BLUE_BG : "transparent",
                  color: emojiGroup === i ? BLUE : "var(--text-muted)",
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
          {/* Emoji grid */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 2,
            padding: 10, maxHeight: 220, overflowY: "auto",
          }}>
            {EMOJI_GROUPS[emojiGroup].emojis.map(em => (
              <button
                key={em}
                onClick={() => { setText(t => t + em); inputRef.current?.focus(); }}
                style={{
                  fontSize: 20, background: "none", border: "none", cursor: "pointer",
                  padding: "4px", borderRadius: 6, lineHeight: 1,
                  transition: "transform 0.1s, background 0.1s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.25)"; e.currentTarget.style.background = BLUE_SOFT; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "none"; }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      {replyingTo && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 8, padding: "7px 12px",
          borderRadius: 8,
          background: BLUE_BG,
          border: `1px solid ${BLUE_BDR}`,
          borderLeft: `3px solid ${BLUE}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, marginBottom: 1 }}>
              Replying to {replyingTo.sender.name}
            </div>
            <div style={{
              fontSize: 12, color: "var(--text-muted)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {replyingTo.content || (replyingTo.fileName ? `📎 ${replyingTo.fileName}` : "Attachment")}
            </div>
          </div>
          <button onClick={onCancelReply} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 2, display: "flex", color: "var(--text-hint)",
          }}>
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {filePending && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 8, padding: "7px 12px",
          borderRadius: 8,
          background: BLUE_BG,
          border: `1px solid ${BLUE_BDR}`,
        }}>
          {filePending.type.startsWith("image/") ? (
            <img src={filePending.url} alt="preview" style={{
              width: 40, height: 40, objectFit: "cover", borderRadius: 6,
              border: `1px solid ${BLUE_BDR}`, flexShrink: 0,
            }} />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: BLUE_BG, border: `1px solid ${BLUE}`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <FileIcon size={18} color={BLUE} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {filePending.name}
            </div>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
              placeholder="Add a caption… (optional)"
              style={{
                marginTop: 4, width: "100%", boxSizing: "border-box",
                background: "transparent", border: "none",
                color: "var(--text-primary)", fontSize: 13, outline: "none",
              }}
            />
          </div>
          <button onClick={() => setFilePending(null)} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 2, color: "var(--text-hint)", flexShrink: 0,
          }}>
            <CloseIcon size={14} />
          </button>
          <button onClick={handleSend} disabled={sending} style={{
            padding: "6px 14px", borderRadius: 8, flexShrink: 0,
            border: `1.5px solid ${BLUE}`,
            background: BLUE_BG,
            color: BLUE, fontSize: 12, fontWeight: 600,
            cursor: sending ? "not-allowed" : "pointer",
            opacity: sending ? 0.6 : 1,
          }}>
            Send
          </button>
        </div>
      )}

      {isRecording ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: BLUE_BG, border: `1px solid ${BLUE_BDR}`,
          borderRadius: 12, padding: "8px 14px",
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: "50%", background: "#ef4444",
            flexShrink: 0, animation: "blink 1s ease-in-out infinite",
          }} />
          <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
            Recording · {fmt(recSeconds)}
          </span>
          <button onClick={cancelRecording} style={{
            padding: "6px 14px", borderRadius: 8, border: `1px solid ${BLUE_BDR}`,
            background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={sendRecording} style={{
            padding: "6px 14px", borderRadius: 8,
            border: `1.5px solid ${BLUE}`,
            background: BLUE_BG,
            color: BLUE, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Send
          </button>
        </div>
      ) : !filePending ? (
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 6,
          background: BLUE_BG,
          border: `1px solid ${BLUE_BDR}`,
          borderRadius: 14,
          padding: "4px 6px 4px 14px",
          transition: "border-color 0.15s",
        }}
          onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = BLUE; }}
          onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = BLUE_BDR; }}
        >
          {/* Emoji toggle */}
          <button
            onClick={() => setShowEmoji(v => !v)}
            title="Emoji"
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: showEmoji ? BLUE_SOFT : "transparent",
              border: "none", cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
          >
            <EmojiIcon size={18} color={showEmoji ? BLUE : "#60a5fa"} />
          </button>

          <textarea
  ref={inputRef}
  value={text}
  onChange={e => { setText(e.target.value); resizeTextarea(); }}
  onKeyDown={handleKeyDown}
  placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
  disabled={sending || uploading}
  rows={1}
  style={{
    flex: 1, resize: "none", overflow: "hidden",
    background: "transparent", border: "none",
    color: "#e9edef", fontSize: 14, outline: "none",
    padding: "7px 0", lineHeight: 1.5,
    fontFamily: "inherit",
    caretColor: "#60a5fa",
  }}
/>

          {/* Attach — colored blue */}
          <label title="Attach file (max 100 MB)" style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.4 : 1,
            background: BLUE_SOFT,
            transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.28)"}
            onMouseLeave={e => e.currentTarget.style.background = BLUE_SOFT}
          >
            <AttachIcon size={18} color={BLUE} />
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
              style={{ display: "none" }}
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            />
          </label>

          {text.trim() || filePending ? (
            <button
              onClick={handleSend}
              disabled={sending || uploading}
              title="Send (Enter)"
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                border: `1.5px solid ${BLUE}`,
                background: BLUE_BG,
                color: BLUE,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: (sending || uploading) ? "not-allowed" : "pointer",
                opacity: (sending || uploading) ? 0.5 : 1,
                transition: "all 0.15s",
              }}
            >
              {sending ? <Spinner size={14} /> : <SendIcon size={15} color={BLUE} />}
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={uploading}
              title="Record voice note"
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                border: `1px solid ${BLUE_BDR}`,
                background: BLUE_SOFT,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: uploading ? "not-allowed" : "pointer",
                opacity: uploading ? 0.4 : 1,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.28)"}
              onMouseLeave={e => e.currentTarget.style.background = BLUE_SOFT}
            >
              <MicIcon size={16} color={BLUE} />
            </button>
          )}
        </div>
      ) : null}

      {!isRecording && !filePending && (
        <div style={{
          fontSize: 10, color: "var(--text-hint)",
          marginTop: 5, paddingLeft: 2,
        }}>
          Enter to send · Shift+Enter for new line · Max file size 100 MB
        </div>
      )}
    </div>
  );
}

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid rgba(96,165,250,0.25)`,
      borderTopColor: "#60a5fa",
      animation: "spin 0.7s linear infinite",
      flexShrink: 0,
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
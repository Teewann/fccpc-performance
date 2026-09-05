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

const EMOJI_PALETTE = [
  "😀","😂","😊","😍","🥰","😎","🤔","😅","😭","😤",
  "👍","👎","❤️","🔥","🎉","✅","⚠️","📌","🙏","👏",
  "💪","🤝","📋","📊","💡","🎯","🚀","⚡","🔑","📝",
];

export function MessageInput({ conversationId, replyingTo, onCancelReply, onSend }: Props) {
  const [text,            setText]            = useState("");
  const [sending,         setSending]         = useState(false);
  const [uploading,       setUploading]       = useState(false);
  const [uploadName,      setUploadName]      = useState("");
  const [filePending,     setFilePending]     = useState<UploadedFile | null>(null);
  const [isRecording,     setIsRecording]     = useState(false);
  const [recSeconds,      setRecSeconds]      = useState(0);
  const [showEmoji,       setShowEmoji]       = useState(false);

  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const recorderRef    = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<Blob[]>([]);
  const recTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, []);

  useEffect(() => { resizeTextarea(); }, [text, resizeTextarea]);

  // Focus input on reply change
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

  return (
    <div style={{
      flexShrink: 0,
      borderTop: "1px solid var(--border-soft)",
      background: "var(--bg-card)",
      padding: "10px 16px 12px",
      position: "relative",
    }}>
      {/* Upload progress */}
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

      {/* Emoji palette */}
      {showEmoji && (
        <div style={{
          position: "absolute", bottom: "100%", left: 16,
          marginBottom: 6,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 12,
          display: "flex", flexWrap: "wrap", gap: 4, width: 280,
          zIndex: 50, boxShadow: "0 8px 28px rgba(0,0,0,0.3)",
        }}>
          {EMOJI_PALETTE.map(em => (
            <button
              key={em}
              onClick={() => { setText(t => t + em); setShowEmoji(false); inputRef.current?.focus(); }}
              style={{
                fontSize: 20, background: "none", border: "none", cursor: "pointer",
                padding: "4px", borderRadius: 6, lineHeight: 1,
                transition: "transform 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.25)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Reply bar */}
      {replyingTo && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 8, padding: "7px 12px",
          borderRadius: 8,
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-text)", marginBottom: 1 }}>
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

      {/* File preview bar */}
      {filePending && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 8, padding: "7px 12px",
          borderRadius: 8,
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
        }}>
          {filePending.type.startsWith("image/") ? (
            <img src={filePending.url} alt="preview" style={{
              width: 40, height: 40, objectFit: "cover", borderRadius: 6,
              border: "1px solid var(--border)", flexShrink: 0,
            }} />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: "var(--accent-bg)", border: "1px solid var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <FileIcon size={18} color="var(--accent-text)" />
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
            border: "1.5px solid var(--accent)",
            background: "var(--accent-bg-strong, #052e16)",
            color: "var(--accent-text)", fontSize: 12, fontWeight: 600,
            cursor: sending ? "not-allowed" : "pointer",
            opacity: sending ? 0.6 : 1,
          }}>
            Send
          </button>
        </div>
      )}

      {/* Recording bar */}
      {isRecording ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--bg-input)", border: "1px solid var(--border)",
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
            padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={sendRecording} style={{
            padding: "6px 14px", borderRadius: 8,
            border: "1.5px solid var(--accent)",
            background: "var(--accent-bg-strong, #052e16)",
            color: "var(--accent-text)", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Send
          </button>
        </div>
      ) : !filePending ? (
        /* Main input row */
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 6,
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "4px 6px 4px 14px",
          transition: "border-color 0.15s",
        }}
          onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"; }}
          onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}
        >
          {/* Emoji toggle */}
          <button
            onClick={() => setShowEmoji(v => !v)}
            title="Emoji"
            style={{
              width: 34, height: 34, borderRadius: 8, background: "none",
              border: "none", cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: showEmoji ? 1 : 0.6, transition: "opacity 0.15s",
            }}
          >
            <EmojiIcon size={18} color={showEmoji ? "var(--accent-text)" : "var(--text-muted)"} />
          </button>

          {/* Textarea */}
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
              color: "var(--text-primary)", fontSize: 14, outline: "none",
              padding: "7px 0", lineHeight: 1.5,
              fontFamily: "inherit",
            }}
          />

          {/* Attach */}
          <label title="Attach file (max 100 MB)" style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.4 : 0.7,
            transition: "opacity 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
            onMouseLeave={e => e.currentTarget.style.opacity = uploading ? "0.4" : "0.7"}
          >
            <AttachIcon size={18} color="var(--text-muted)" />
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
              style={{ display: "none" }}
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            />
          </label>

          {/* Send / Mic */}
          {text.trim() || filePending ? (
            <button
              onClick={handleSend}
              disabled={sending || uploading}
              title="Send (Enter)"
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                border: "1.5px solid var(--accent)",
                background: "var(--accent-bg-strong, #052e16)",
                color: "var(--accent-text)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: (sending || uploading) ? "not-allowed" : "pointer",
                opacity: (sending || uploading) ? 0.5 : 1,
                transition: "all 0.15s",
              }}
            >
              {sending ? <Spinner size={14} /> : <SendIcon size={15} color="var(--accent-text)" />}
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={uploading}
              title="Record voice note"
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                border: "1px solid var(--border)",
                background: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: uploading ? "not-allowed" : "pointer",
                opacity: uploading ? 0.4 : 0.7,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "1"}
              onMouseLeave={e => e.currentTarget.style.opacity = uploading ? "0.4" : "0.7"}
            >
              <MicIcon size={16} color="var(--text-muted)" />
            </button>
          )}
        </div>
      ) : null}

      {/* Hint */}
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
      border: `2px solid rgba(255,255,255,0.2)`,
      borderTopColor: "var(--accent-text)",
      animation: "spin 0.7s linear infinite",
      flexShrink: 0,
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

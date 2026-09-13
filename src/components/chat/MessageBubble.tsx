"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import UserAvatar from "@/components/UserAvatar";
import { ReplyIcon, EditIcon, TrashIcon, CopyIcon, PinIcon, EmojiIcon, DownloadIcon, FileIcon, CheckIcon, CheckCheckIcon } from "./Icons";
import type { Message } from "./types";

const QUICK_REACTIONS = ["👍","❤️","😂","😮","🙏","🔥","😢","👏","🎉","✅","💯","🙌"];

interface Props {
  message: Message;
  showAvatar: boolean;
  showName: boolean;
  isMine: boolean;
  currentUserId: string;
  isGroup: boolean;
  onReply: (msg: Message) => void;
  onReact: (id: string, emoji: string) => Promise<void>;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onJumpTo?: (id: string) => void;
}

export function MessageBubble({
  message, showAvatar, showName, isMine, currentUserId, isGroup,
  onReply, onReact, onDelete, onEdit, onPin, onJumpTo,
}: Props) {
  const [hovered,     setHovered]     = useState(false);
  const [showMenu,    setShowMenu]    = useState(false);
  const [showReacts,  setShowReacts]  = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [editText,    setEditText]    = useState(message.content ?? "");
  const [imgPreview,  setImgPreview]  = useState(false);
  const [reactUp, setReactUp]         = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const menuRef   = useRef<HTMLDivElement>(null);
  const editRef   = useRef<HTMLInputElement>(null);

  const isOpt   = message.id.startsWith("opt_");
  const isImage = message.fileType?.startsWith("image/");

  const computeReactDirection = useCallback(() => {
    if (!bubbleRef.current) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    setReactUp(rect.top < 180);
  }, []);

  useEffect(() => {
    if (!showMenu && !showReacts) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false); setShowReacts(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMenu, showReacts]);

  useEffect(() => { if (editing) editRef.current?.focus(); }, [editing]);

  const doEdit = useCallback(() => {
    const t = editText.trim();
    if (t && t !== message.content) onEdit(message.id, t);
    setEditing(false);
  }, [editText, message.content, message.id, onEdit]);

  const reactionGroups = (message.reactions ?? []).reduce(
    (acc, r) => { (acc[r.emoji] ??= []).push(r); return acc; },
    {} as Record<string, typeof message.reactions>
  );

  const time = new Date(message.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  // ✅ Uses CSS variables — switches with theme
  const bubbleBg   = isMine ? "var(--chat-bubble-mine)"        : "var(--chat-bubble-other)";
  const bubbleText = isMine ? "var(--chat-bubble-mine-txt)"    : "var(--chat-bubble-other-txt)";
  const bubbleBdr  = isMine ? "var(--chat-bubble-mine-bdr)"    : "var(--chat-bubble-other-bdr)";
  const timeColor  = isMine ? "var(--chat-time-mine)"          : "var(--chat-time-other)";

  const showChevron = hovered && !editing;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
      style={{
        display: "flex",
        flexDirection: isMine ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 6,
        marginBottom: showAvatar ? 8 : 2,
        padding: "0 8px",
        width: "100%",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {!isMine && (
        <div style={{ width: 28, flexShrink: 0, alignSelf: "flex-end" }}>
          {showAvatar
            ? <UserAvatar user={{ name: message.sender.name, photo: message.sender.photo }} size={26} />
            : null}
        </div>
      )}

      <div style={{
        maxWidth: "68%",
        minWidth: 0,
        display: "flex", flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
      }}>
        {showName && (
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: senderColor(message.sender.id),
            marginBottom: 2, paddingLeft: 2,
          }}>
            {message.sender.name}
          </div>
        )}

        <div style={{
          display: "flex", alignItems: "flex-start", gap: 2,
          flexDirection: isMine ? "row-reverse" : "row",
          position: "relative",
          maxWidth: "100%",
        }}>
          <div ref={bubbleRef} style={{ position: "relative", maxWidth: "100%", minWidth: 0 }}>

            {editing ? (
              <div style={{
                display: "flex", gap: 6, alignItems: "center",
                padding: "8px 12px", borderRadius: 10,
                background: bubbleBg, border: `1px solid ${bubbleBdr}`,
                minWidth: 180,
              }}>
                <input ref={editRef} value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") doEdit(); if (e.key === "Escape") setEditing(false); }}
                  style={{ flex: 1, background: "transparent", border: "none", color: bubbleText, fontSize: 14, outline: "none" }}
                />
                <button onClick={doEdit} style={{ padding: "3px 10px", borderRadius: 6, background: "#25D366", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓</button>
                <button onClick={() => setEditing(false)} style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.1)", border: "none", color: bubbleText, fontSize: 12, cursor: "pointer" }}>✕</button>
              </div>
            ) : (
              <div style={{
                background: bubbleBg, color: bubbleText,
                borderRadius: isMine ? "10px 2px 10px 10px" : "2px 10px 10px 10px",
                border: `1px solid ${bubbleBdr}`,
                padding: message.fileUrl && !message.content ? "4px" : "7px 10px 4px 10px",
                wordBreak: "break-word", fontSize: 14, lineHeight: 1.5,
                opacity: isOpt ? 0.6 : 1, transition: "opacity 0.3s",
                boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                maxWidth: "100%", boxSizing: "border-box",
              }}>
                {message.replyTo && (
                  <div onClick={() => onJumpTo?.(message.replyTo!.id)} style={{
                    borderLeft: "3px solid #25D366",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 6, padding: "4px 8px", marginBottom: 6,
                    cursor: onJumpTo ? "pointer" : "default",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#25D366", marginBottom: 1 }}>{message.replyTo.sender.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {message.replyTo.content ?? (message.replyTo.fileName ? `📎 ${message.replyTo.fileName}` : "Attachment")}
                    </div>
                  </div>
                )}

                {message.fileUrl && (
                  <FileBubble url={message.fileUrl} name={message.fileName} type={message.fileType} isMine={isMine} onPreview={() => setImgPreview(true)} />
                )}

                {message.content && (
                  <div style={{ marginTop: message.fileUrl ? 6 : 0 }}>{message.content}</div>
                )}

                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "flex-end",
                  gap: 3, marginTop: 4, paddingLeft: 20,
                }}>
                  {message.edited && <span style={{ fontSize: 9, color: timeColor }}>edited</span>}
                  <span style={{ fontSize: 10, color: timeColor, whiteSpace: "nowrap", flexShrink: 0 }}>{time}</span>
                  {isMine && (
                    <span style={{ color: isOpt ? "rgba(233,255,250,0.3)" : "#53BDEB", flexShrink: 0, display: "flex" }}>
                      {isOpt ? <CheckIcon size={11} color="currentColor" /> : <CheckCheckIcon size={11} color="currentColor" />}
                    </span>
                  )}
                </div>
              </div>
            )}

            {showReacts && (
              <div ref={menuRef} style={{
                position: "absolute",
                ...(reactUp ? { top: "calc(100% + 4px)" } : { bottom: "calc(100% + 4px)" }),
                [isMine ? "right" : "left"]: 0,
                background: "#233138",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 28, padding: "6px 10px",
                display: "flex", gap: 2, zIndex: 400,
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                flexWrap: "wrap", maxWidth: 300, justifyContent: "center",
              }}>
                {QUICK_REACTIONS.map(em => (
                  <button key={em}
                    onClick={async () => { await onReact(message.id, em); setShowReacts(false); }}
                    style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", padding: "2px 4px", lineHeight: 1, borderRadius: 6, transition: "transform 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.4)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                  >{em}</button>
                ))}
              </div>
            )}

            {showMenu && (
              <div ref={menuRef} style={{
                position: "absolute",
                ...(reactUp ? { top: "calc(100% + 4px)" } : { bottom: "calc(100% + 4px)" }),
                [isMine ? "right" : "left"]: 0,
                background: "#233138",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "4px 0",
                minWidth: 168, zIndex: 400,
                boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
              }}>
                <MI icon={<ReplyIcon size={14}/>} label="Reply" onClick={() => { onReply(message); setShowMenu(false); }} />
                <MI icon={<EmojiIcon size={14}/>} label="React" onClick={() => { setShowMenu(false); setShowReacts(true); }} />
                {message.content && (
                  <MI icon={<CopyIcon size={14}/>} label="Copy" onClick={() => { navigator.clipboard.writeText(message.content!).catch(()=>{}); setShowMenu(false); }} />
                )}
                <MI icon={<PinIcon size={14} filled={message.pinned}/>} label={message.pinned ? "Unpin" : "Pin"} onClick={() => { onPin(message.id, !message.pinned); setShowMenu(false); }} />
                {isMine && message.content && (
                  <MI icon={<EditIcon size={14}/>} label="Edit" onClick={() => { setEditing(true); setShowMenu(false); }} />
                )}
                {isMine && (
                  <>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "3px 0" }} />
                    <MI icon={<TrashIcon size={14}/>} label="Delete" danger onClick={() => { onDelete(message.id); setShowMenu(false); }} />
                  </>
                )}
              </div>
            )}
          </div>

          {showChevron && (
            <button
              onClick={() => { computeReactDirection(); setShowMenu(v => !v); setShowReacts(false); }}
              title="Message options"
              style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "rgba(255,255,255,0.7)",
                flexShrink: 0, alignSelf: "flex-start",
                marginTop: 6,
                transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.18)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            >
              ▾
            </button>
          )}
        </div>

        {Object.keys(reactionGroups).length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4,
            justifyContent: isMine ? "flex-end" : "flex-start",
          }}>
            {Object.entries(reactionGroups).map(([em, users]) => {
              const mine = users.some(u => u.userId === currentUserId);
              return (
                <button key={em} title={users.map(u => u.user.name).join(", ")}
                  onClick={() => onReact(message.id, em)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 12,
                    background: mine ? "rgba(37,211,102,0.2)" : "rgba(255,255,255,0.08)",
                    border: `1px solid ${mine ? "#25D366" : "rgba(255,255,255,0.12)"}`,
                    fontSize: 12, cursor: "pointer", lineHeight: 1.6,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{em}</span>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {imgPreview && message.fileUrl && isImage && (
        <div onClick={() => setImgPreview(false)} style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.96)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <button onClick={() => setImgPreview(false)} style={{
            position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.12)", border: "none",
            color: "#fff", fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
          <a href={message.fileUrl} download={message.fileName ?? "image"} onClick={e => e.stopPropagation()}
            style={{ position: "absolute", top: 16, right: 64, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <DownloadIcon size={16} color="#fff" />
          </a>
          <img src={message.fileUrl} alt={message.fileName ?? ""} onClick={e => e.stopPropagation()}
            style={{ maxWidth: "92vw", maxHeight: "92vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 8px 48px rgba(0,0,0,0.8)" }} />
        </div>
      )}
    </div>
  );
}

function FileBubble({ url, name, type, isMine, onPreview }: {
  url: string; name?: string | null; type?: string | null; isMine: boolean; onPreview: () => void;
}) {
  const isImg = type?.startsWith("image/");
  const isAudio = type?.startsWith("audio/");
  const label = name ?? "Attachment";
  const textCol = isMine ? "var(--chat-bubble-mine-txt)" : "var(--chat-bubble-other-txt)";

  if (isAudio) return <audio controls src={url} style={{ maxWidth: 240, height: 36, display: "block" }} />;
  if (isImg) return (
    <img src={url} alt={label} onClick={onPreview} style={{
      maxWidth: 240, maxHeight: 200, borderRadius: 8,
      display: "block", objectFit: "cover", cursor: "zoom-in",
    }} />
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.2)", maxWidth: 240 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <FileIcon size={18} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: textCol, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{type?.split("/")[1]?.toUpperCase() ?? "FILE"}</div>
      </div>
      <a href={url} download={label} onClick={e => e.stopPropagation()}
        style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.1)", textDecoration: "none" }}>
        <DownloadIcon size={14} color={textCol} />
      </a>
    </div>
  );
}

function MI({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 14px",
      background: "none", border: "none", color: danger ? "#ef4444" : "#e9edef",
      fontSize: 13, cursor: "pointer", textAlign: "left",
    }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.06)"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}
    >
      <span style={{ opacity: 0.75 }}>{icon}</span>{label}
    </button>
  );
}

function senderColor(id: string) {
  const colors = ["#00BCD4","#E91E63","#9C27B0","#FF9800","#4CAF50","#2196F3","#F44336","#FF5722"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % colors.length;
  return colors[Math.abs(h)];
}
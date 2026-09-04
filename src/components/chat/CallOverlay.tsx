"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import UserAvatar from "@/components/UserAvatar";
import { PhoneIcon, PhoneOffIcon, VideoIcon, VideoOffIcon, MicIcon, MicOffIcon, CameraIcon } from "./Icons";
import type { CallState } from "./types";

interface Props {
  call: CallState;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  localStream:  MediaStream | null;
  remoteStream: MediaStream | null;
}

export function CallOverlay({ call, onAccept, onReject, onHangup, onToggleMute, onToggleCamera, localStream, remoteStream }: Props) {
  const localVid  = useRef<HTMLVideoElement>(null);
  const remoteVid = useRef<HTMLVideoElement>(null);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (localVid.current && localStream)  localVid.current.srcObject  = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVid.current && remoteStream) remoteVid.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Timer
  useEffect(() => {
    if (call.status !== "active") { setCallDuration(0); return; }
    const t = setInterval(() => setCallDuration(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [call.status]);

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
  };

  if (call.status === "idle") return null;

  const isVideo = call.callType === "video";
  const user    = call.remoteUser;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: isVideo && call.status === "active"
        ? "rgba(0,0,0,0.95)"
        : "linear-gradient(160deg, #0a1628 0%, #1a3a2a 60%, #0d2818 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      transition: "background 0.5s",
    }}>
      {/* Remote video (full screen when active) */}
      {isVideo && call.status === "active" && (
        <video ref={remoteVid} autoPlay playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {/* Content over video */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%", maxWidth: 360, padding: 24 }}>

        {/* Avatar / Name */}
        <div style={{ position: "relative" }}>
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            border: call.status === "active" ? "3px solid #25D366" : "3px solid rgba(255,255,255,0.2)",
            transition: "border-color 0.4s",
          }}>
            <UserAvatar user={{ name: user?.name ?? "?", photo: user?.photo }} size={96} />
          </div>
          {call.status === "active" && (
            <span style={{
              position: "absolute", bottom: 4, right: 4,
              width: 14, height: 14, borderRadius: "50%",
              background: "#25D366", border: "2.5px solid #0a1628",
              animation: "pulse-ring 1.5s ease-in-out infinite",
            }} />
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
            {user?.name ?? "Unknown"}
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
            {call.status === "calling"  && `Calling… (${isVideo ? "video" : "voice"})`}
            {call.status === "incoming" && `Incoming ${isVideo ? "video" : "voice"} call`}
            {call.status === "active"   && fmtDuration(callDuration)}
            {call.status === "ended"    && "Call ended"}
          </div>
        </div>

        {/* Ringing animation */}
        {(call.status === "calling" || call.status === "incoming") && (
          <div style={{ display: "flex", gap: 5, marginTop: -4 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: "50%", background: "#25D366",
                animation: `bounce 1.2s ease-in-out infinite ${i * 0.2}s`,
              }} />
            ))}
          </div>
        )}

        {/* Control buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 24 }}>
          {/* INCOMING: accept / reject */}
          {call.status === "incoming" && <>
            <CallBtn onClick={onReject} bg="#ef4444" title="Decline">
              <PhoneOffIcon size={26} color="#fff" />
            </CallBtn>
            <CallBtn onClick={onAccept} bg="#25D366" title="Accept" large>
              <PhoneIcon size={26} color="#fff" />
            </CallBtn>
          </>}

          {/* CALLING / ACTIVE */}
          {(call.status === "calling" || call.status === "active") && <>
            {call.status === "active" && (
              <CallBtn onClick={onToggleMute} bg={call.isMuted ? "#ef4444" : "rgba(255,255,255,0.15)"} title={call.isMuted ? "Unmute" : "Mute"}>
                {call.isMuted ? <MicOffIcon size={22} color="#fff" /> : <MicIcon size={22} color="#fff" />}
              </CallBtn>
            )}
            {isVideo && call.status === "active" && (
              <CallBtn onClick={onToggleCamera} bg={call.isCameraOff ? "#ef4444" : "rgba(255,255,255,0.15)"} title="Toggle camera">
                {call.isCameraOff ? <VideoOffIcon size={22} color="#fff" /> : <VideoIcon size={22} color="#fff" />}
              </CallBtn>
            )}
            <CallBtn onClick={onHangup} bg="#ef4444" title="Hang up" large>
              <PhoneOffIcon size={26} color="#fff" />
            </CallBtn>
          </>}

          {call.status === "ended" && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: -8 }}>
              Closing…
            </div>
          )}
        </div>
      </div>

      {/* Local video (PiP) */}
      {isVideo && call.status === "active" && (
        <div style={{
          position: "absolute", bottom: 90, right: 20,
          width: 100, height: 140, borderRadius: 12,
          overflow: "hidden", border: "2px solid rgba(255,255,255,0.3)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          background: "#000",
          zIndex: 2,
        }}>
          <video ref={localVid} autoPlay playsInline muted
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
          />
          {call.isCameraOff && (
            <div style={{
              position: "absolute", inset: 0, background: "#111",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CameraIcon size={28} color="rgba(255,255,255,0.3)" />
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse-ring { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
      `}</style>
    </div>
  );
}

function CallBtn({ onClick, bg, title, large, children }: { onClick: () => void; bg: string; title: string; large?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: large ? 64 : 52, height: large ? 64 : 52,
      borderRadius: "50%", border: "none",
      background: bg, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 4px 16px rgba(0,0,0,0.3)`,
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
    >{children}</button>
  );
}
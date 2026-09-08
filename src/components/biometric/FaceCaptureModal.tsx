"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import { loadModels } from "@/lib/biometric/face-client";

interface FaceCaptureModalProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const FILL_RATE_MS = 1600;   // how long continuous good positioning takes to fill the ring
const DRAIN_RATE_MS = 900;   // how long continuous bad positioning takes to fully drain it
const HARD_LIMIT_MS = 5000;  // absolute cap before handing off to manual

type Phase = "loading" | "positioning" | "capturing" | "error";

export default function FaceCaptureModal({ onCapture, onCancel, isOpen }: FaceCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const startTimeRef = useRef(0);
  const lastTickRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0); // 0–100
  const [hint, setHint] = useState("Position your face in the oval");
  const [errorMsg, setErrorMsg] = useState("");
  const [timedOut, setTimedOut] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  function measureBrightness(video: HTMLVideoElement): number {
    const c = document.createElement("canvas");
    c.width = 48; c.height = 48;
    const ctx = c.getContext("2d");
    if (!ctx) return 255;
    ctx.drawImage(video, 0, 0, 48, 48);
    const data = ctx.getImageData(0, 0, 48, 48).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    return sum / (data.length / 4);
  }

  const tick = useCallback(async (now: number) => {
    if (!mountedRef.current) return;

    if (Date.now() - startTimeRef.current > HARD_LIMIT_MS) {
      setTimedOut(true);
      setHint("Tap below to capture manually");
      return; // stop the loop entirely — hand off to the manual button
    }

    if (busyRef.current) { rafRef.current = requestAnimationFrame(tick); return; }
    const video = videoRef.current;
    if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }

    const dt = lastTickRef.current ? now - lastTickRef.current : 0;
    lastTickRef.current = now;

    busyRef.current = true;
    try {
      const brightness = measureBrightness(video);
      let good = false;
      let currentHint = "Position your face in the oval";

      if (brightness < 50) {
        currentHint = "Too dark ; move to better lighting";
      } else {
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }));
        if (!mountedRef.current) return;

        if (detection && detection.score >= 0.6) {
          const box = detection.box;
          const sizeRatio = box.width / video.videoWidth;
          const offX = Math.abs(box.x + box.width / 2 - video.videoWidth / 2) / video.videoWidth;
          const offY = Math.abs(box.y + box.height / 2 - video.videoHeight / 2) / video.videoHeight;

          if (sizeRatio < 0.24) currentHint = "Move closer";
          else if (sizeRatio > 0.75) currentHint = "Move back a little";
          else if (offX > 0.32 || offY > 0.34) currentHint = "Center your face in the oval";
          else { good = true; currentHint = "Hold still..."; }
        }
      }

      setHint(currentHint);
      setProgress((p) => {
        if (good) return Math.min(100, p + (dt / FILL_RATE_MS) * 100);
        return Math.max(0, p - (dt / DRAIN_RATE_MS) * 100);
      });
    } catch (err) {
      console.error("Face detection error:", err);
    }
    busyRef.current = false;
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Watch progress separately so capture triggers reliably at 100
  useEffect(() => {
    if (progress >= 100 && phase === "positioning") {
      capture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  useEffect(() => {
    mountedRef.current = true;
    if (!isOpen) { stopCamera(); return; }

    setPhase("loading"); setProgress(0); setErrorMsg(""); setTimedOut(false);
    lastTickRef.current = 0;

    (async () => {
      try {
        await loadModels();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        });
        if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        if (!mountedRef.current) return;

        setPhase("positioning");
        startTimeRef.current = Date.now();
        rafRef.current = requestAnimationFrame(tick);
      } catch (err: any) {
        if (!mountedRef.current) return;
        setPhase("error");
        setErrorMsg(
          err.name === "NotAllowedError" ? "Camera access was denied. Please allow camera access and try again." :
          err.name === "NotFoundError" ? "No camera found on this device." :
          "Could not start the camera. Please try again."
        );
      }
    })();

    return () => { mountedRef.current = false; stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function capture() {
    if (!mountedRef.current) return;
    setPhase("capturing");
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) { setPhase("error"); setErrorMsg("Camera not ready."); return; }
    try {
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg", 0.9);
      stopCamera();
      setTimeout(() => { if (mountedRef.current) onCapture(imageData); }, 150);
    } catch {
      setPhase("error"); setErrorMsg("Failed to capture image. Please try again.");
    }
  }

  async function handleManualCapture() {
    const video = videoRef.current;
    if (!video) return;
    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
        .withFaceLandmarks();
      if (!detection) {
        setErrorMsg("No face detected. Please face the camera and try again.");
        return;
      }
      const left = detection.landmarks.getLeftEye();
      const right = detection.landmarks.getRightEye();
      const lc = { x: (left[0].x + left[3].x) / 2, y: (left[0].y + left[3].y) / 2 };
      const rc = { x: (right[0].x + right[3].x) / 2, y: (right[0].y + right[3].y) / 2 };
      const eyeDist = Math.hypot(lc.x - rc.x, lc.y - rc.y);
      const ratio = eyeDist / detection.detection.box.width;
      if (ratio < 0.22 || ratio > 0.65) {
        setErrorMsg("Your face isn't fully visible. Remove anything covering it and try again.");
        return;
      }
      capture();
    } catch (err) {
      console.error(err);
      setErrorMsg("Could not verify your face. Please try again.");
    }
  }

  function handleCancel() { stopCamera(); onCancel(); }
  function handleRetry() {
    stopCamera(); setPhase("loading"); setErrorMsg(""); setProgress(0); setTimedOut(false);
    lastTickRef.current = 0;
    (async () => {
      try {
        await loadModels();
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } } });
        if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        setPhase("positioning");
        startTimeRef.current = Date.now();
        rafRef.current = requestAnimationFrame(tick);
      } catch { setPhase("error"); setErrorMsg("Still unable to access the camera."); }
    })();
  }

  if (!isOpen) return null;

  const radius = 46, circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px, 4vw, 32px)", overflowY: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 420, maxHeight: "100dvh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <h2 style={{ fontSize: "clamp(17px, 4vw, 20px)", fontWeight: 600, color: "#fff", marginBottom: 4, textAlign: "center" }}>Face Verification</h2>
        <div style={{ fontSize: "clamp(13px, 3.5vw, 15px)", fontWeight: 600, color: phase === "error" ? "#f87171" : "#4ade80", textAlign: "center", minHeight: 20, margin: "8px 0 16px" }}>
          {errorMsg || (timedOut ? "Tap below to capture manually" : hint)}
        </div>

        <div style={{ position: "relative", width: "min(62vw, 62dvh, 300px)", aspectRatio: "1 / 1" }}>
          <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", transform: "scaleX(-1)", display: phase === "error" ? "none" : "block" }} />
          {(phase === "loading" || phase === "capturing") && (
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
              <span style={{ fontSize: 28, color: "#9ca3af", animation: "spin 1s linear infinite" }}>⟳</span>
            </div>
          )}
          {/* Progress ring */}
          <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", pointerEvents: "none" }}>
            <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
            <circle
              cx="50" cy="50" r={radius} fill="none" stroke="#22c55e" strokeWidth="4"
              strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10, width: "100%", alignItems: "center" }}>
          {timedOut && phase === "positioning" && (
            <button onClick={handleManualCapture} style={{ padding: "10px 24px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%", maxWidth: 240 }}>
              📸 Capture manually
            </button>
          )}
          {phase === "error" && (
            <button onClick={handleRetry} style={{ padding: "10px 24px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%", maxWidth: 240 }}>
              🔄 Retry
            </button>
          )}
          <button onClick={handleCancel} style={{ padding: "10px 24px", borderRadius: 10, border: "0.5px solid #444", background: "transparent", color: "#9ca3af", fontSize: 14, cursor: "pointer", width: "100%", maxWidth: 240 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
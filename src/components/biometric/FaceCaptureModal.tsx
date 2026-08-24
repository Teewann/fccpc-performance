"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import { loadModels } from "@/lib/biometric/face-client";

interface FaceCaptureModalProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

type GuideState = "loading" | "searching" | "too_dark" | "too_far" | "off_center" | "good" | "capturing" | "error";

const GUIDE_TEXT: Record<GuideState, string> = {
  loading:    "Starting camera...",
  searching:  "Position your face in the oval",
  too_dark:   "Too dark — move to better lighting",
  too_far:    "Move closer",
  off_center: "Center your face in the oval",
  good:       "Hold still...",
  capturing:  "Captured!",
  error:      "Something went wrong",
};

const GUIDE_COLOR: Record<GuideState, string> = {
  loading: "#6b7280", searching: "#6b7280", too_dark: "#f59e0b",
  too_far: "#f59e0b", off_center: "#f59e0b", good: "#22c55e",
  capturing: "#22c55e", error: "#f87171",
};

const HOLD_MS = 900;
const MANUAL_FALLBACK_AFTER_MS = 8000; // show manual button if auto-capture hasn't happened yet

export default function FaceCaptureModal({ onCapture, onCancel, isOpen }: FaceCaptureModalProps) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const loopRef       = useRef<number | null>(null);
  const goodSinceRef  = useRef<number | null>(null);
  const processingRef = useRef(false);   // prevents overlapping detection calls
  const mountedRef    = useRef(true);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<GuideState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [showManualFallback, setShowManualFallback] = useState(false);

  const log = (...args: any[]) => { if (process.env.NODE_ENV === "development") console.log(...args); };

  const stopCamera = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!isOpen) { stopCamera(); return; }

    setState("loading");
    setErrorMsg("");
    setShowManualFallback(false);
    goodSinceRef.current = null;
    processingRef.current = false;

    (async () => {
      try {
        await loadModels();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        });
        if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!mountedRef.current) return;

        setState("searching");
        fallbackTimerRef.current = setTimeout(() => {
          if (mountedRef.current) setShowManualFallback(true);
        }, MANUAL_FALLBACK_AFTER_MS);
        runDetectionLoop();
      } catch (err: any) {
        if (!mountedRef.current) return;
        log("Camera error:", err);
        setState("error");
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setErrorMsg("Camera access was denied. Please allow camera access and try again.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setErrorMsg("No camera found on this device.");
        } else {
          setErrorMsg("Could not start the camera. Please try again.");
        }
      }
    })();

    return () => { mountedRef.current = false; stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function measureBrightness(video: HTMLVideoElement): number {
    const c = document.createElement("canvas");
    c.width = 48; c.height = 48;
    const ctx = c.getContext("2d");
    if (!ctx) return 255; // fail open rather than falsely reporting darkness
    ctx.drawImage(video, 0, 0, 48, 48);
    const data = ctx.getImageData(0, 0, 48, 48).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / (data.length / 4);
  }

  function runDetectionLoop() {
    const tick = async () => {
      if (!mountedRef.current) return;
      const video = videoRef.current;

      if (!video || video.readyState < 2 || processingRef.current) {
        loopRef.current = requestAnimationFrame(tick);
        return;
      }

      processingRef.current = true;
      try {
        const brightness = measureBrightness(video);
        if (brightness < 50) {
          if (mountedRef.current) { setState("too_dark"); goodSinceRef.current = null; }
        } else {
          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }));

          if (!mountedRef.current) return;

          if (!detection) {
            setState("searching");
            goodSinceRef.current = null;
          } else {
            const box = detection.box;
            const vw = video.videoWidth, vh = video.videoHeight;
            const faceCenterX = box.x + box.width / 2;
            const faceCenterY = box.y + box.height / 2;
            const offCenterX = Math.abs(faceCenterX - vw / 2) / vw;
            const offCenterY = Math.abs(faceCenterY - vh / 2) / vh;
            const faceSizeRatio = box.width / vw;

            if (faceSizeRatio < 0.28) {
              setState("too_far"); goodSinceRef.current = null;
            } else if (offCenterX > 0.18 || offCenterY > 0.18) {
              setState("off_center"); goodSinceRef.current = null;
            } else {
              setState("good");
              if (!goodSinceRef.current) goodSinceRef.current = Date.now();
              if (Date.now() - goodSinceRef.current > HOLD_MS) {
                processingRef.current = false;
                capture();
                return;
              }
            }
          }
        }
      } catch (err) {
        // A single bad frame should never crash the check-in flow — log it and keep trying.
        log("Detection frame error (recovered):", err);
      }
      processingRef.current = false;
      loopRef.current = requestAnimationFrame(tick);
    };
    loopRef.current = requestAnimationFrame(tick);
  }

  function capture() {
    if (!mountedRef.current) return;
    setState("capturing");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      setState("error");
      setErrorMsg("Camera not ready. Please try again.");
      return;
    }
    try {
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height); // raw frame — not mirrored
      const imageData = canvas.toDataURL("image/jpeg", 0.9);
      stopCamera();
      setTimeout(() => { if (mountedRef.current) onCapture(imageData); }, 200);
    } catch (err) {
      log("Capture error:", err);
      setState("error");
      setErrorMsg("Failed to capture image. Please try again.");
    }
  }

  function handleCancel() {
    stopCamera();
    onCancel();
  }

  function handleRetry() {
    stopCamera();
    setState("loading");
    setErrorMsg("");
    setShowManualFallback(false);
    goodSinceRef.current = null;
    // Re-trigger the effect by toggling isOpen would require parent control,
    // so we restart the camera setup directly here instead.
    (async () => {
      try {
        await loadModels();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        });
        if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        setState("searching");
        fallbackTimerRef.current = setTimeout(() => { if (mountedRef.current) setShowManualFallback(true); }, MANUAL_FALLBACK_AFTER_MS);
        runDetectionLoop();
      } catch {
        setState("error");
        setErrorMsg("Still unable to access the camera.");
      }
    })();
  }

  if (!isOpen) return null;

  const isBusy = state === "loading" || state === "capturing";

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 2000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "clamp(12px, 4vw, 32px)",
        overflowY: "auto", // safety net only — layout below is sized to avoid needing it
      }}
    >
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          width: "100%", maxWidth: 420,
          maxHeight: "100dvh",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <h2 style={{ fontSize: "clamp(17px, 4vw, 20px)", fontWeight: 600, color: "#fff", marginBottom: 4, textAlign: "center" }}>
          Face Verification
        </h2>

        {/* Status/error text — always directly above the oval, never scrolls out of view since the whole modal fits one viewport */}
        <div
          role="status"
          aria-live="polite"
          style={{
            fontSize: "clamp(13px, 3.5vw, 15px)", fontWeight: 600,
            color: GUIDE_COLOR[state], textAlign: "center",
            minHeight: 20, margin: "8px 0 16px", padding: "0 12px",
          }}
        >
          {errorMsg || GUIDE_TEXT[state]}
        </div>

        <div
          style={{
            position: "relative",
            width: "min(62vw, 62dvh, 300px)",
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            overflow: "hidden",
            background: "#0a0c12",
            flexShrink: 0,
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              transform: "scaleX(-1)", // mirrored for natural self-view only — captured frame is not mirrored
              display: state === "error" ? "none" : "block",
            }}
          />
          {isBusy && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
              <span style={{ fontSize: 28, color: "#9ca3af", animation: "spin 1s linear infinite" }}>⟳</span>
            </div>
          )}
          <div
            style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: `4px solid ${GUIDE_COLOR[state]}`,
              boxShadow: state === "good" || state === "capturing" ? `0 0 20px ${GUIDE_COLOR[state]}` : "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
              pointerEvents: "none",
            }}
          />
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10, width: "100%", alignItems: "center" }}>
          {!errorMsg && state !== "capturing" && (
            <div style={{ fontSize: "clamp(11px, 3vw, 12px)", color: "#9ca3af", textAlign: "center", padding: "0 16px" }}>
              Capture happens automatically once your face is clearly framed.
            </div>
          )}

          {(showManualFallback || state === "error") && state !== "capturing" && (
            <button
              onClick={state === "error" ? handleRetry : capture}
              style={{
                padding: "10px 24px", borderRadius: 10, border: "1.5px solid #22c55e",
                background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer",
                width: "100%", maxWidth: 240,
              }}
            >
              {state === "error" ? "🔄 Retry" : "📸 Capture manually"}
            </button>
          )}

          <button
            onClick={handleCancel}
            style={{
              padding: "10px 24px", borderRadius: 10, border: "0.5px solid #444",
              background: "transparent", color: "#9ca3af", fontSize: 14, cursor: "pointer",
              width: "100%", maxWidth: 240,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
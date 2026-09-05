"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import { loadModels } from "@/lib/biometric/face-client";

interface Props {
  isOpen: boolean;
  onCapture: (imageData: string) => void; // called once, with the CENTER frame, after all 5 steps pass
  onCancel: () => void;
}

type StepId = "center" | "right" | "left" | "up" | "down";

const STEPS: { id: StepId; label: string; voice: string }[] = [
  { id: "center", label: "Look straight at the camera", voice: "Please look straight at the camera." },
  { id: "right", label: "Turn your head to the right", voice: "Now, slowly turn your head to your right." },
  { id: "left", label: "Turn your head to the left", voice: "Now, slowly turn your head to your left." },
  { id: "up", label: "Tilt your head up slightly", voice: "Now, tilt your head up a little." },
  { id: "down", label: "Tilt your head down slightly", voice: "Now, tilt your head down a little." },
];

const HOLD_MS = 3000;
const DRAIN_MS = 1200; // how fast a lost pose drains progress — tolerant of brief blips, not instant reset

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    // Speech isn't available on this device/browser — fine, text guidance still shows.
  }
}

export default function GuidedFaceEnrollment({ isOpen, onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const lastTickRef = useRef(0);
  const centerFrameRef = useRef<string | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "running" | "done" | "error">("loading");
  const [hint, setHint] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch {}
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

  function grabFrame(video: HTMLVideoElement): string {
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  // Returns which of the 5 poses the current landmarks best match, or null if none clearly.
  function classifyPose(landmarks: faceapi.FaceLandmarks68, box: faceapi.Box, videoW: number): { pose: StepId | null; ok: boolean } {
    const leftEyePts = landmarks.getLeftEye();
    const rightEyePts = landmarks.getRightEye();
    const jaw = landmarks.getJawOutline();
    const nose = landmarks.getNose();

    const leftEye = { x: leftEyePts.reduce((s, p) => s + p.x, 0) / leftEyePts.length, y: leftEyePts.reduce((s, p) => s + p.y, 0) / leftEyePts.length };
    const rightEye = { x: rightEyePts.reduce((s, p) => s + p.x, 0) / rightEyePts.length, y: rightEyePts.reduce((s, p) => s + p.y, 0) / rightEyePts.length };
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const noseTip = nose[nose.length - 1]; // bottom of nose
    const chin = jaw[8]; // bottom-center of jaw

    const faceWidth = box.width;
    const faceHeight = Math.abs(chin.y - eyeMidY) || box.height;

    // Yaw (left/right): raw video is unmirrored — the user's own RIGHT appears toward
    // smaller raw x. If this ever feels backwards in testing, flip the sign here.
    const yawOffset = (noseTip.x - eyeMidX) / faceWidth;

    // Pitch (up/down): nose vertical position relative to the eye-to-chin span.
    const pitchRatio = (noseTip.y - eyeMidY) / faceHeight;

    const YAW_THRESHOLD = 0.12;
    const PITCH_UP_MAX = 0.38;   // looking up: nose sits higher (smaller ratio) than baseline (~0.5)
    const PITCH_DOWN_MIN = 0.62; // looking down: nose sits lower (larger ratio) than baseline

    if (Math.abs(yawOffset) < 0.06 && pitchRatio > 0.42 && pitchRatio < 0.58) return { pose: "center", ok: true };
    if (yawOffset < -YAW_THRESHOLD) return { pose: "right", ok: true };
    if (yawOffset > YAW_THRESHOLD) return { pose: "left", ok: true };
    if (pitchRatio < PITCH_UP_MAX) return { pose: "up", ok: true };
    if (pitchRatio > PITCH_DOWN_MIN) return { pose: "down", ok: true };

    return { pose: null, ok: false };
  }

  const tick = useCallback(async (now: number) => {
    if (!mountedRef.current) return;
    if (busyRef.current) { rafRef.current = requestAnimationFrame(tick); return; }
    const video = videoRef.current;
    if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }

    const dt = lastTickRef.current ? now - lastTickRef.current : 0;
    lastTickRef.current = now;

    busyRef.current = true;
    try {
      const brightness = measureBrightness(video);
      if (brightness < 45) {
        setHint("Too dark — move to better lighting");
        setProgress((p) => Math.max(0, p - (dt / DRAIN_MS) * 100));
        busyRef.current = false;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.5 }))
        .withFaceLandmarks();

      if (!mountedRef.current) return;

      const currentStep = STEPS[stepIndex]?.id;
      
      if (!detection || detection.detection.score < 0.6) {        setHint("Position your face in the oval");
        setProgress((p) => Math.max(0, p - (dt / DRAIN_MS) * 100));
      } else {
        const { pose, ok } = classifyPose(detection.landmarks, detection.detection.box, video.videoWidth);
        if (ok && pose === currentStep) {
          setHint(STEPS[stepIndex].label);
          setProgress((p) => {
            const next = Math.min(100, p + (dt / HOLD_MS) * 100);
            return next;
          });
        } else {
          setHint(STEPS[stepIndex].label);
          setProgress((p) => Math.max(0, p - (dt / DRAIN_MS) * 100));
        }
      }
    } catch (err) {
      console.error("Guided enrollment frame error:", err);
    }
    busyRef.current = false;
    rafRef.current = requestAnimationFrame(tick);
  }, [stepIndex]);

  // When a step's ring completes, capture (if center) and move on.
  useEffect(() => {
    if (progress < 100 || phase !== "running") return;

    const step = STEPS[stepIndex];
    if (step.id === "center" && videoRef.current) {
      centerFrameRef.current = grabFrame(videoRef.current);
    }

    if (stepIndex === STEPS.length - 1) {
      // All 5 steps complete
      setPhase("done");
      stopCamera();
      const finalImage = centerFrameRef.current;
      setTimeout(() => {
        if (mountedRef.current && finalImage) onCapture(finalImage);
      }, 400);
    } else {
      setProgress(0);
      setStepIndex((i) => i + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, phase]);

  // Speak the instruction whenever the step changes
  useEffect(() => {
    if (phase === "running") speak(STEPS[stepIndex].voice);
  }, [stepIndex, phase]);

  useEffect(() => {
    mountedRef.current = true;
    if (!isOpen) { stopCamera(); return; }

    setPhase("loading"); setStepIndex(0); setProgress(0); setErrorMsg("");
    lastTickRef.current = 0; centerFrameRef.current = null;

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

        setPhase("running");
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

  function handleCancel() { stopCamera(); onCancel(); }
  function handleRetry() {
    setPhase("loading"); setStepIndex(0); setProgress(0); setErrorMsg("");
    lastTickRef.current = 0; centerFrameRef.current = null;
    (async () => {
      try {
        await loadModels();
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } } });
        if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        setPhase("running");
        rafRef.current = requestAnimationFrame(tick);
      } catch { setPhase("error"); setErrorMsg("Still unable to access the camera."); }
    })();
  }

  if (!isOpen) return null;

  const radius = 46, circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px, 4vw, 32px)", overflowY: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 420, maxHeight: "100dvh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <h2 style={{ fontSize: "clamp(17px, 4vw, 20px)", fontWeight: 600, color: "#fff", marginBottom: 6, textAlign: "center" }}>
          Face Enrollment
        </h2>

        {/* Step indicator dots */}
        {phase !== "error" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {STEPS.map((s, i) => (
              <div key={s.id} style={{
                width: 9, height: 9, borderRadius: "50%",
                background: i < stepIndex || phase === "done" ? "#22c55e" : i === stepIndex ? "#60a5fa" : "rgba(255,255,255,0.25)",
                transition: "background 0.2s",
              }} />
            ))}
          </div>
        )}

        <div style={{ fontSize: "clamp(14px, 3.8vw, 16px)", fontWeight: 600, color: phase === "error" ? "#f87171" : phase === "done" ? "#4ade80" : "#fff", textAlign: "center", minHeight: 22, marginBottom: 16, padding: "0 12px" }}>
          {errorMsg || (phase === "done" ? "All done — processing..." : hint || STEPS[stepIndex]?.label)}
        </div>

        <div style={{ position: "relative", width: "min(62vw, 62dvh, 300px)", aspectRatio: "1 / 1" }}>
          <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", transform: "scaleX(-1)", display: phase === "error" ? "none" : "block" }} />
          {(phase === "loading" || phase === "done") && (
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
              <span style={{ fontSize: 28, color: phase === "done" ? "#4ade80" : "#9ca3af", animation: phase === "loading" ? "spin 1s linear infinite" : "none" }}>
                {phase === "done" ? "✓" : "⟳"}
              </span>
            </div>
          )}
          <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", pointerEvents: "none" }}>
            <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#22c55e" strokeWidth="4"
              strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.1s linear" }} />
          </svg>
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10, width: "100%", alignItems: "center" }}>
          {phase === "error" && (
            <button onClick={handleRetry} style={{ padding: "10px 24px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%", maxWidth: 240 }}>
              🔄 Retry
            </button>
          )}
          {phase === "running" && (
            <button onClick={handleCancel} style={{ padding: "10px 24px", borderRadius: 10, border: "0.5px solid #444", background: "transparent", color: "#9ca3af", fontSize: 14, cursor: "pointer", width: "100%", maxWidth: 240 }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
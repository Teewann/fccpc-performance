"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import { loadModels } from "@/lib/biometric/face-client";

interface Props {
  isOpen: boolean;
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

type StepId = "center" | "right" | "left" | "up" | "down";

const STEPS: { id: StepId; label: string; voice: string }[] = [
  { id: "center", label: "Look straight at the camera", voice: "Please look straight at the camera." },
  { id: "right",  label: "Turn your head to the right",   voice: "Now, slowly turn your head to your right." },
  { id: "left",   label: "Turn your head to the left",    voice: "Now, slowly turn your head to your left." },
  { id: "up",     label: "Tilt your head up slightly",    voice: "Now, tilt your head up a little." },
  { id: "down",   label: "Tilt your head down slightly",  voice: "Now, tilt your head down a little." },
];

const HOLD_MS  = 1500;
const DRAIN_MS = 3000;

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch {}
}

export default function GuidedFaceEnrollment({ isOpen, onCapture, onCancel }: Props) {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const rafRef         = useRef<number | null>(null);
  const busyRef        = useRef(false);
  const mountedRef     = useRef(true);
  const lastTickRef    = useRef(0);
  const centerFrameRef = useRef<string | null>(null);
  const stepIndexRef   = useRef(0);
  const progressRef    = useRef(0);

  const [stepIndex, setStepIndex] = useState(0);
  const [progress,  setProgress]  = useState(0);
  const [phase,     setPhase]     = useState<"loading" | "running" | "done" | "error">("loading");
  const [hint,      setHint]      = useState("");
  const [errorMsg,  setErrorMsg]  = useState("");

  // Keep refs in sync
  useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);
  useEffect(() => { progressRef.current = progress; }, [progress]);

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
    for (let i = 0; i < data.length; i += 4)
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    return sum / (data.length / 4);
  }

  function grabFrame(video: HTMLVideoElement): string {
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width  = video.videoWidth  || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  // Simplified pose detection
  function detectPose(
    detection: faceapi.FaceDetection,
    landmarks: faceapi.FaceLandmarks68
  ): StepId | null {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();

    const eyeMidX = (leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length + 
                     rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length) / 2;
    const eyeMidY = (leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length + 
                     rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length) / 2;

    const noseTip = nose[nose.length - 1];
    const chin = jaw[8];

    const faceWidth = detection.box.width || 200;
    const faceHeight = Math.abs(chin.y - eyeMidY) || detection.box.height || 200;

    const yawOffset = (noseTip.x - eyeMidX) / faceWidth;
    const pitchRatio = (noseTip.y - eyeMidY) / faceHeight;

    // VERY FORGIVING thresholds
    if (Math.abs(yawOffset) < 0.25 && pitchRatio > 0.15 && pitchRatio < 0.85) {
      return "center";
    }
    if (yawOffset < -0.03) return "right";
    if (yawOffset > 0.03) return "left";
    if (pitchRatio < 0.18) return "up";
    if (pitchRatio > 0.88) return "down";

    return null;
  }

  // Handle step completion - separate function for clarity
  const completeStep = useCallback(() => {
    console.log("✅ Step completed! Current index:", stepIndexRef.current);
    
    const currentStep = STEPS[stepIndexRef.current];
    if (currentStep.id === "center" && videoRef.current) {
      centerFrameRef.current = grabFrame(videoRef.current);
    }

    // Check if this was the last step
    if (stepIndexRef.current >= STEPS.length - 1) {
      console.log("🎉 All steps complete!");
      setPhase("done");
      stopCamera();
      const finalImage = centerFrameRef.current;
      setTimeout(() => {
        if (mountedRef.current && finalImage) onCapture(finalImage);
      }, 400);
    } else {
      // Move to next step
      const nextIndex = stepIndexRef.current + 1;
      console.log(`➡️ Moving to step ${nextIndex + 1}: ${STEPS[nextIndex].label}`);
      setProgress(0);
      setStepIndex(nextIndex);
      // Speak the next instruction
      speak(STEPS[nextIndex].voice);
    }
  }, [stopCamera, onCapture]);

  const tick = useCallback(async (now: number) => {
    if (!mountedRef.current) return;
    if (busyRef.current) { rafRef.current = requestAnimationFrame(tick); return; }

    const video = videoRef.current;
    if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }

    const dt = lastTickRef.current ? now - lastTickRef.current : 16;
    lastTickRef.current = now;

    busyRef.current = true;
    try {
      const brightness = measureBrightness(video);
      if (brightness < 20) {
        setHint("Too dark — move to better lighting");
        setProgress((p) => Math.max(0, p - (dt / DRAIN_MS) * 100));
        busyRef.current = false;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const detection = await faceapi
        .detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ 
            inputSize: 416, 
            scoreThreshold: 0.10
          })
        )
        .withFaceLandmarks();

      if (!mountedRef.current) return;

      if (!detection || detection.detection.score < 0.10) {
        setHint("Position your face in the oval");
        setProgress((p) => Math.max(0, p - (dt / DRAIN_MS) * 100));
        busyRef.current = false;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // We have a face!
      const currentStepId = STEPS[stepIndexRef.current]?.id;
      const detectedPose = detectPose(detection.detection, detection.landmarks);

      // For center step: any face works
      if (currentStepId === "center") {
        setHint("Great! Hold still...");
        const newProgress = Math.min(100, progressRef.current + (dt / HOLD_MS) * 100);
        setProgress(newProgress);
        
        // Check if we reached 100%
        if (newProgress >= 100) {
          console.log("🔵 Center step reached 100%!");
          busyRef.current = false;
          rafRef.current = requestAnimationFrame(tick);
          completeStep();
          return;
        }
        busyRef.current = false;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // For other steps: check if pose matches
      if (detectedPose === currentStepId) {
        setHint("Good! Keep that position");
        const newProgress = Math.min(100, progressRef.current + (dt / HOLD_MS) * 100);
        setProgress(newProgress);
        
        if (newProgress >= 100) {
          console.log(`🟢 Step ${currentStepId} reached 100%!`);
          busyRef.current = false;
          rafRef.current = requestAnimationFrame(tick);
          completeStep();
          return;
        }
      } else if (detectedPose === null) {
        setHint(STEPS[stepIndexRef.current]?.label || "");
        // Don't drain
      } else {
        setHint(STEPS[stepIndexRef.current]?.label || "");
        setProgress((p) => Math.max(0, p - (dt / DRAIN_MS) * 100));
      }
    } catch (err) {
      console.error("Enrollment frame error:", err);
    }

    busyRef.current = false;
    rafRef.current = requestAnimationFrame(tick);
  }, [completeStep]);

  // Camera init
  const startCamera = useCallback(async () => {
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
      setPhase("running");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setPhase("error");
      setErrorMsg(
        err.name === "NotAllowedError" ? "Camera access was denied. Please allow camera access and try again." :
        err.name === "NotFoundError"   ? "No camera found on this device." :
        "Could not start the camera. Please try again."
      );
    }
  }, [tick]);

  useEffect(() => {
    mountedRef.current = true;
    if (!isOpen) { stopCamera(); return; }

    setPhase("loading");
    setStepIndex(0);
    setProgress(0);
    setErrorMsg("");
    lastTickRef.current    = 0;
    centerFrameRef.current = null;
    stepIndexRef.current   = 0;
    progressRef.current    = 0;

    startCamera();
    return () => { mountedRef.current = false; stopCamera(); };
  }, [isOpen, startCamera, stopCamera]);

  function handleCancel() { stopCamera(); onCancel(); }
  function handleRetry() {
    setPhase("loading");
    setStepIndex(0);
    setProgress(0);
    setErrorMsg("");
    lastTickRef.current    = 0;
    centerFrameRef.current = null;
    stepIndexRef.current   = 0;
    progressRef.current    = 0;
    startCamera();
  }

  if (!isOpen) return null;

  const radius        = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset    = circumference * (1 - progress / 100);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px,4vw,32px)", overflowY: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 420, maxHeight: "100dvh", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>

        <h2 style={{ fontSize: "clamp(17px,4vw,20px)", fontWeight: 600, color: "#fff", marginBottom: 6, textAlign: "center" }}>
          Face Enrollment
        </h2>

        {/* Step dots */}
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

        {/* Current instruction */}
        <div style={{ fontSize: "clamp(14px,3.8vw,16px)", fontWeight: 600, color: phase === "error" ? "#f87171" : phase === "done" ? "#4ade80" : "#fff", textAlign: "center", minHeight: 22, marginBottom: 16, padding: "0 12px" }}>
          {errorMsg || (phase === "done" ? "All done — processing…" : hint || STEPS[stepIndex]?.label)}
        </div>

        {/* Video oval with progress ring */}
        <div style={{ position: "relative", width: "min(62vw,62dvh,300px)", aspectRatio: "1/1" }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", transform: "scaleX(-1)", display: phase === "error" ? "none" : "block" }}
          />

          {(phase === "loading" || phase === "done") && (
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
              <span style={{ fontSize: 28, color: phase === "done" ? "#4ade80" : "#9ca3af" }}>
                {phase === "done" ? "✓" : "…"}
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

        {/* Progress label */}
        {phase === "running" && (
          <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
            Step {stepIndex + 1} of {STEPS.length} — {Math.round(progress)}%
          </div>
        )}

        {/* Buttons */}
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10, width: "100%", alignItems: "center" }}>
          {phase === "error" && (
            <button onClick={handleRetry} style={{ padding: "10px 24px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%", maxWidth: 240 }}>
              Retry
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
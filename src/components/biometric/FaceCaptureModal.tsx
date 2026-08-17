"use client";

import { useState, useEffect, useRef } from "react";

interface FaceCaptureModalProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function FaceCaptureModal({ onCapture, onCancel, isOpen }: FaceCaptureModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      return;
    }

    let mounted = true;

    async function startCamera() {
      try {
        console.log("📷 Starting camera...");
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "user",
            width: { ideal: 400 },
            height: { ideal: 400 }
          }
        });
        
        if (!mounted) return;
        
        streamRef.current = stream;
        console.log("📷 Camera stream obtained");
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // ✅ Use 'loadeddata' event instead of 'onloadedmetadata'
          videoRef.current.onloadeddata = () => {
            console.log("📷 Video data loaded");
            if (videoRef.current && mounted) {
              videoRef.current.play()
                .then(() => {
                  console.log("📷 Video playing");
                  if (mounted) {
                    setIsLoading(false);
                  }
                })
                .catch((err) => {
                  console.error("📷 Video play error:", err);
                  if (mounted) {
                    setError("Failed to start video stream.");
                    setIsLoading(false);
                  }
                });
            }
          };
          
          // ✅ Also try to play immediately
          try {
            await videoRef.current.play();
            console.log("📷 Video playing (direct)");
            if (mounted) {
              setIsLoading(false);
            }
          } catch (playErr) {
            console.log("📷 Waiting for loadeddata event...");
            // If play fails, wait for the event
          }
        }
      } catch (err: any) {
        console.error("📷 Camera error:", err);
        if (mounted) {
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setError("Camera access denied. Please allow camera access in your browser settings.");
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            setError("No camera found. Please connect a camera and try again.");
          } else {
            setError("Failed to access camera: " + (err.message || "Unknown error"));
          }
          setIsLoading(false);
        }
      }
    }

    setIsLoading(true);
    setError("");
    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  const captureFace = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError("Camera not ready. Please wait.");
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      setError("Failed to capture image.");
      return;
    }
    
    canvas.width = 300;
    canvas.height = 300;
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 150, 140, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(video, 0, 0, 300, 300);
    ctx.restore();
    
    ctx.beginPath();
    ctx.arc(150, 150, 140, 0, Math.PI * 2);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 4;
    ctx.stroke();
    
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    onCapture(imageData);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.85)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000,
    }}>
      <div style={{
        background: "var(--bg-card)",
        borderRadius: 20,
        padding: "32px 28px",
        maxWidth: 420,
        width: "100%",
        textAlign: "center",
        border: "0.5px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
          📸 Face Capture
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
          Center your face in the circle and click "Capture"
        </p>

        {error && (
          <div style={{
            color: "#f87171",
            padding: "10px 14px",
            background: "#1f0707",
            borderRadius: 8,
            fontSize: 14,
            marginBottom: 12,
            border: "0.5px solid #7f1d1d",
          }}>
            ❌ {error}
          </div>
        )}

        <div style={{
          position: "relative",
          width: 300,
          height: 300,
          margin: "0 auto 16px",
          borderRadius: "50%",
          overflow: "hidden",
          background: "#0a0c12",
          border: "2px solid #22c55e",
        }}>
          {isLoading ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-muted)",
              gap: 12,
            }}>
              <div style={{ 
                animation: "spin 1s linear infinite",
                display: "inline-block",
                fontSize: 28,
              }}>⟳</div>
              <span style={{ fontSize: 14 }}>Loading camera...</span>
            </div>
          ) : (
            <video
              ref={videoRef}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              autoPlay
              playsInline
              muted
            />
          )}
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: "0.5px solid var(--border)",
              background: "var(--bg-input)",
              color: "var(--text-muted)",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={captureFace}
            disabled={isLoading || !!error}
            style={{
              padding: "10px 28px",
              borderRadius: 10,
              border: "1.5px solid #22c55e",
              background: isLoading || error ? "#14532d" : "#052e16",
              color: "#4ade80",
              fontSize: 15,
              fontWeight: 600,
              cursor: isLoading || error ? "not-allowed" : "pointer",
              opacity: isLoading || error ? 0.6 : 1,
            }}
          >
            📸 Capture
          </button>
        </div>

        {error && (
          <button
            onClick={() => {
              setError("");
              setIsLoading(true);
              if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
              }
              setTimeout(() => {
                // Force reload by toggling isOpen
                window.location.reload();
              }, 500);
            }}
            style={{
              marginTop: 12,
              padding: "8px 20px",
              borderRadius: 8,
              border: "0.5px solid var(--border)",
              background: "var(--bg-input)",
              color: "var(--text-muted)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            🔄 Retry
          </button>
        )}
      </div>
    </div>
  );
}
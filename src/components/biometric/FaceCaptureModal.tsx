"use client";

import { useState, useEffect, useRef } from "react";

interface FaceCaptureModalProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function FaceCaptureModal({ onCapture, onCancel, isOpen }: FaceCaptureModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 400, height: 400 }
        });
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsLoading(false);
        }
      } catch (err) {
        setError("Camera access denied. Please allow camera access and try again.");
        setIsLoading(false);
      }
    }

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  const captureFace = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = 300;
    canvas.height = 300;
    
    // Draw the video frame centered with circular crop
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 150, 140, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(video, 0, 0, 300, 300);
    ctx.restore();
    
    // Draw a circle border
    ctx.beginPath();
    ctx.arc(150, 150, 140, 0, Math.PI * 2);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Get image data
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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
          }}>
            {error}
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
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-muted)",
            }}>
              <div style={{ 
                animation: "spin 1s linear infinite",
                display: "inline-block",
                fontSize: 24,
              }}>⟳</div>
              <span style={{ marginLeft: 8 }}>Loading camera...</span>
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
            />
          )}
          
          {/* Face detection indicator */}
          {!isLoading && (
            <div style={{
              position: "absolute",
              bottom: 12,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "4px 12px",
              borderRadius: 6,
              background: faceDetected ? "#052e16" : "#1f0707",
              border: `0.5px solid ${faceDetected ? "#14532d" : "#7f1d1d"}`,
              color: faceDetected ? "#4ade80" : "#f87171",
              fontSize: 12,
            }}>
              {faceDetected ? "✅ Face detected" : "⚠️ No face detected"}
            </div>
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
            disabled={isLoading}
            style={{
              padding: "10px 28px",
              borderRadius: 10,
              border: "1.5px solid #22c55e",
              background: "#052e16",
              color: "#4ade80",
              fontSize: 15,
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            📸 Capture
          </button>
        </div>
      </div>
    </div>
  );
}
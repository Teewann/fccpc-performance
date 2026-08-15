"use client";

import { useState } from 'react';
import { captureFaceForEnrollment } from '@/lib/face-capture';

export default function FaceEnrollPage() {
  const [capturing, setCapturing] = useState(false);
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: "", ok: true });
  const [enrolled, setEnrolled] = useState(false);

  async function handleCapture() {
    setCapturing(true);
    setMessage({ text: "📸 Capturing face...", ok: true });
    
    const image = await captureFaceForEnrollment();
    if (image) {
      setFaceImage(image);
      setMessage({ text: "✅ Face captured! Enrolling...", ok: true });
      
      // Upload to server
      try {
        const res = await fetch('/api/face/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ faceImage: image }),
        });
        const data = await res.json();
        
        if (res.ok) {
          setMessage({ text: "✅ Face enrolled successfully!", ok: true });
          setEnrolled(true);
        } else {
          setMessage({ text: data.error || "Face enrollment failed.", ok: false });
        }
      } catch (error) {
        setMessage({ text: "Network error. Please try again.", ok: false });
      }
    } else {
      setMessage({ text: "Face capture failed. Please try again.", ok: false });
    }
    
    setCapturing(false);
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <div className="flex-1 p-6 max-w-2xl mx-auto">
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
          📸 Face Enrollment
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>
          Capture your face for biometric check-in. This will be used to verify your identity.
        </p>

        {message.text && (
          <div style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: message.ok ? "#052e16" : "#1f0707",
            border: `0.5px solid ${message.ok ? "#14532d" : "#7f1d1d"}`,
            color: message.ok ? "#4ade80" : "#f87171",
            marginBottom: 16,
          }}>
            {message.text}
          </div>
        )}

        {enrolled ? (
          <div style={{
            padding: 24,
            borderRadius: 12,
            background: "#052e16",
            border: "1px solid #14532d",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#4ade80", marginBottom: 8 }}>
              Face Enrolled Successfully!
            </h2>
            <p style={{ color: "var(--text-muted)" }}>
              Your face has been enrolled for biometric check-in.
            </p>
          </div>
        ) : (
          <>
            {faceImage && (
              <div style={{ marginBottom: 16, textAlign: "center" }}>
                <img 
                  src={faceImage} 
                  alt="Captured face" 
                  style={{
                    maxWidth: 300,
                    borderRadius: 12,
                    border: "2px solid #22c55e",
                  }}
                />
              </div>
            )}

            <button
              onClick={handleCapture}
              disabled={capturing}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                border: "1.5px solid #22c55e",
                background: capturing ? "#14532d" : "#052e16",
                color: "#4ade80",
                fontSize: 16,
                fontWeight: 600,
                cursor: capturing ? "not-allowed" : "pointer",
                opacity: capturing ? 0.6 : 1,
              }}
            >
              {capturing ? "⏳ Capturing..." : "📸 Capture Face"}
            </button>

            <p style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 12, textAlign: "center" }}>
              Make sure your face is well-lit and facing the camera directly.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
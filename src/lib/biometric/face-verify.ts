import * as faceapi from "face-api.js";

let modelsLoaded = false;

async function loadFaceModels() {
  if (modelsLoaded) return;
  try {
    const MODEL_URL = "/models";
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    console.log("✅ Face models loaded");
  } catch (error) {
    console.error("❌ Failed to load face models:", error);
    throw new Error("Face recognition models failed to load.");
  }
}

// ─── Show camera preview and capture face ──────────────────────────
export async function verifyFaceAtCheckin(): Promise<{ success: boolean; error?: string }> {
  return new Promise(async (resolve) => {
    try {
      console.log("📸 Starting face verification...");
      
      await loadFaceModels();
      
      // ── Create camera overlay ──────────────────────────────────────
      const overlay = document.createElement("div");
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;

      const videoWrapper = document.createElement("div");
      videoWrapper.style.cssText = `
        position: relative;
        width: 320px;
        height: 320px;
        border-radius: 50%;
        overflow: hidden;
        border: 3px solid #22c55e;
        box-shadow: 0 0 40px rgba(34,197,94,0.3);
      `;

      const video = document.createElement("video");
      video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;

      const statusText = document.createElement("div");
      statusText.style.cssText = `
        color: #4ade80;
        font-size: 16px;
        margin-top: 20px;
        font-weight: 500;
        text-align: center;
        font-family: sans-serif;
      `;
      statusText.textContent = "📸 Looking for your face...";

      const cancelBtn = document.createElement("button");
      cancelBtn.style.cssText = `
        margin-top: 16px;
        padding: 10px 30px;
        border-radius: 10px;
        border: 1px solid #6b7280;
        background: transparent;
        color: #9ca3af;
        font-size: 14px;
        cursor: pointer;
        font-family: sans-serif;
      `;
      cancelBtn.textContent = "Cancel";
      cancelBtn.onclick = () => {
        document.body.removeChild(overlay);
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        }
        resolve({ success: false, error: "Verification cancelled." });
      };

      videoWrapper.appendChild(video);
      overlay.appendChild(videoWrapper);
      overlay.appendChild(statusText);
      overlay.appendChild(cancelBtn);
      document.body.appendChild(overlay);

      // ── Start camera ──────────────────────────────────────────────
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 400 }, height: { ideal: 400 } }
      });
      video.srcObject = stream;
      await video.play();

      // ── Wait for face detection ──────────────────────────────────
      let faceDetected = false;
      let attempts = 0;
      const maxAttempts = 30; // 3 seconds max (100ms each)

      const detectInterval = setInterval(async () => {
        attempts++;
        try {
          const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            faceDetected = true;
            clearInterval(detectInterval);
            statusText.textContent = "✅ Face detected! Verifying...";
            statusText.style.color = "#4ade80";

            // ── Verify on server ────────────────────────────────────
            const descriptor = detection.descriptor;
            const res = await fetch("/api/face", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "verify",
                embedding: Array.from(descriptor),
              }),
            });
            const data = await res.json();

            // ── Clean up ─────────────────────────────────────────────
            if (video.srcObject) {
              (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            }
            document.body.removeChild(overlay);

            if (!res.ok) {
              resolve({ success: false, error: data.error || "Face verification failed." });
            } else {
              resolve({ success: true });
            }
          } else if (attempts >= maxAttempts) {
            clearInterval(detectInterval);
            statusText.textContent = "⏱️ No face detected. Please try again.";
            statusText.style.color = "#f87171";
            setTimeout(() => {
              if (video.srcObject) {
                (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
              }
              document.body.removeChild(overlay);
              resolve({ success: false, error: "No face detected. Please try again." });
            }, 2000);
          } else {
            // Update status based on attempts
            if (attempts % 5 === 0) {
              const dots = ".".repeat((attempts / 5) % 4);
              statusText.textContent = `📸 Looking for your face${dots}`;
            }
          }
        } catch (err) {
          console.error("Detection error:", err);
        }
      }, 100);

    } catch (err: any) {
      console.error("Face verification error:", err);
      // Clean up any overlays
      const overlays = document.querySelectorAll('div[style*="z-index: 9999"]');
      overlays.forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        resolve({ success: false, error: "Camera access denied. Please allow camera access and try again." });
      } else {
        resolve({ success: false, error: err?.message || "Face verification failed." });
      }
    }
  });
}

export async function hasFaceEnrolled(): Promise<boolean> {
  try {
    const res = await fetch("/api/face");
    const data = await res.json();
    return !!data.enrolled;
  } catch {
    return false;
  }
}

export async function hasEnrolledDevice(): Promise<boolean> {
  try {
    const res = await fetch("/api/webauthn?action=check-enrolled");
    const data = await res.json();
    return data.hasCredential === true;
  } catch {
    return false;
  }
}

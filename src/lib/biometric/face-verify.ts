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

// ─── Capture face with liveness detection (multi-angle) ──────────
async function captureFaceWithLiveness(): Promise<{ 
  success: boolean; 
  image?: string; 
  error?: string;
  angle?: string;
}> {
  try {
    await loadFaceModels();
    
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 400 }, height: { ideal: 400 } }
    });

    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check face position (center, left, right, up, down)
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();

    if (!detection) {
      stream.getTracks().forEach(track => track.stop());
      return { success: false, error: "No face detected. Please center your face." };
    }

    // Get face landmarks for angle detection
    const landmarks = detection.landmarks;
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();
    
    // Simple angle detection based on landmark positions
    const faceCenterX = (jaw[0].x + jaw[jaw.length - 1].x) / 2;
    const faceCenterY = (jaw[0].y + jaw[jaw.length - 1].y) / 2;
    const noseX = nose[0].x;
    const noseY = nose[0].y;

    let angle = "center";
    const thresholdX = 20;
    const thresholdY = 20;

    if (noseX < faceCenterX - thresholdX) angle = "left";
    else if (noseX > faceCenterX + thresholdX) angle = "right";
    else if (noseY < faceCenterY - thresholdY) angle = "up";
    else if (noseY > faceCenterY + thresholdY) angle = "down";

    // Capture frame
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, 300, 300);

    stream.getTracks().forEach(track => track.stop());
    video.remove();

    return { 
      success: true, 
      image: canvas.toDataURL("image/jpeg", 0.9),
      angle: angle
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Face capture failed." };
  }
}

// ─── Enhanced face verification with liveness ──────────────────────
export async function verifyFaceAtCheckin(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("📸 Starting enhanced face verification...");
    
    // Step 1: First capture (center)
    const result1 = await captureFaceWithLiveness();
    if (!result1.success) return { success: false, error: result1.error };
    
    console.log(`📸 First capture: ${result1.angle}`);

    // Step 2: Prompt user to turn slightly (if face is centered)
    if (result1.angle === "center") {
      // Good start - proceed to verification
      const res = await fetch("/api/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          image: result1.image,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Face verification failed." };
      }
      return { success: true };
    } else {
      // Face not centered - ask user to center
      return { 
        success: false, 
        error: `Please center your face. You were looking ${result1.angle}. Look directly at the camera.` 
      };
    }
  } catch (err: any) {
    console.error("Face verification error:", err);
    return { success: false, error: err?.message || "Face verification failed." };
  }
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
import * as faceapi from "face-api.js";

let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  
  const MODEL_URL = "/models";
  
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  
  modelsLoaded = true;
}

// ─── Get face descriptor from video ──────────────────────────────────
async function getFaceDescriptor(video: HTMLVideoElement): Promise<Float32Array> {
  await loadModels();
  
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error("No face detected. Make sure your face is clearly visible and well-lit.");
  }
  
  return detection.descriptor;
}

// ─── Capture face embedding ──────────────────────────────────────────
export async function captureFaceEmbedding(code?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "user", width: 400, height: 400 } 
    });

    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    
    // Wait for camera to settle
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // Get face descriptor
    const descriptor = await getFaceDescriptor(video);
    
    // Stop camera
    stream.getTracks().forEach(track => track.stop());
    video.remove();

    // Send to server
    const res = await fetch("/api/face", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        action: "enroll", 
        embedding: Array.from(descriptor), 
        code 
      }),
    });
    
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Camera access was denied or unavailable." };
  }
}

// ─── Verify face for check-in ────────────────────────────────────────
export async function verifyFaceLive(): Promise<{ success: boolean; error?: string }> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "user", width: 400, height: 400 } 
    });

    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const descriptor = await getFaceDescriptor(video);
    
    stream.getTracks().forEach(track => track.stop());
    video.remove();

    const res = await fetch("/api/face", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        action: "verify", 
        embedding: Array.from(descriptor) 
      }),
    });
    
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Camera access was denied or unavailable." };
  }
}

export async function hasFaceEnrolled(): Promise<boolean> {
  const res = await fetch("/api/face");
  const data = await res.json();
  return !!data.enrolled;
}

export async function removeFaceEnrollment(): Promise<boolean> {
  const res = await fetch("/api/face", { method: "DELETE" });
  return res.ok;
}
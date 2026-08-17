import * as faceapi from "face-api.js";

let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
  await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
  await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
  modelsLoaded = true;
}

async function captureFrameAndDescriptor(): Promise<Float32Array> {
  await loadModels();

  const video = document.createElement("video");
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
  video.srcObject = stream;
  await video.play();
  await new Promise((r) => setTimeout(r, 800)); // let the camera settle/focus

  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  stream.getTracks().forEach((t) => t.stop());

  if (!detection) throw new Error("No face detected. Make sure your face is clearly visible and well-lit, then try again.");
  return detection.descriptor;
}

export async function captureFaceEmbedding(code?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const descriptor = await captureFrameAndDescriptor();
    const res = await fetch("/api/face", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enroll", embedding: Array.from(descriptor), code }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Camera access was denied or unavailable." };
  }
}

export async function verifyFaceLive(): Promise<{ success: boolean; error?: string }> {
  try {
    const descriptor = await captureFrameAndDescriptor();
    const res = await fetch("/api/face", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", embedding: Array.from(descriptor) }),
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
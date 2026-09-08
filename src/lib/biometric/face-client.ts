// src/lib/biometric/face-client.ts
//
// Face recognition client — loads models, captures embeddings, and verifies
// against stored embeddings. Uses the lightweight TinyFaceDetector (fast,
// reliable enough for daily check-in), not the heavy SSD model.

import * as faceapi from "face-api.js";

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  const MODEL_URL = "/models";
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  modelsLoaded = true;
}

export async function embeddingFromImageData(imageData: string): Promise<Float32Array> {
  await loadModels();

  const img = document.createElement("img");
  img.src = imageData;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  // ✅ FIXED: Much more forgiving detection settings
  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ 
      inputSize: 416,        // Larger = better detection
      scoreThreshold: 0.15   // MUCH lower = catches more faces
    }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error("No clear face detected. Face the camera directly, at a normal distance, with your face fully visible.");
  }

  const left = detection.landmarks.getLeftEye();
  const right = detection.landmarks.getRightEye();
  const leftCenter = { x: (left[0].x + left[3].x) / 2, y: (left[0].y + left[3].y) / 2 };
  const rightCenter = { x: (right[0].x + right[3].x) / 2, y: (right[0].y + right[3].y) / 2 };
  const eyeDist = Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);
  const eyeSpacingToBox = eyeDist / detection.detection.box.width;

  // ✅ MORE FORGIVING: wider acceptable range
  if (eyeSpacingToBox < 0.12 || eyeSpacingToBox > 0.75) {
    throw new Error("Your face doesn't appear fully visible. Please remove anything covering your face and try again.");
  }

  return detection.descriptor;
}

export async function verifyEmbedding(
  imageData: string,
  storedEmbedding: Float32Array
): Promise<{ success: boolean; score: number; error?: string }> {
  try {
    await loadModels();

    const img = document.createElement("img");
    img.src = imageData;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ 
        inputSize: 416, 
        scoreThreshold: 0.15 
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return { success: false, score: 0, error: "No face detected in the image." };
    }

    const distance = faceapi.euclideanDistance(detection.descriptor, storedEmbedding);
    const matched = distance < 0.6;
    const score = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));

    return { success: matched, score };
  } catch (err: any) {
    return { success: false, score: 0, error: err.message || "Verification failed." };
  }
}

// ─── Enrollment status ──────────────────────────────────────────────

export async function hasFaceEnrolled(): Promise<boolean> {
  try {
    const res = await fetch("/api/face", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.hasFace === true;
  } catch {
    return false;
  }
}

export async function removeFaceEnrollment(): Promise<boolean> {
  try {
    const res = await fetch("/api/face", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}
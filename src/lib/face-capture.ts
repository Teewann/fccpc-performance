// ─── Face Capture using Browser Camera API ──────────────────────────

/**
 * Captures a face image from the user's camera
 * Returns a base64 image string or null if failed
 */
export async function captureFaceFromCamera(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Your browser doesn't support camera access. Please use Chrome or Edge.");
      resolve(null);
      return;
    }

    navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      } 
    })
    .then((stream) => {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      video.play();

      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        // ✅ Fix: Check if ctx is null
        if (!ctx) {
          stream.getTracks().forEach(track => track.stop());
          video.remove();
          resolve(null);
          return;
        }
        
        ctx.drawImage(video, 0, 0, 640, 480);
        
        stream.getTracks().forEach(track => track.stop());
        video.remove();

        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        resolve(imageData);
      };
    })
    .catch((error) => {
      console.error('Camera access denied:', error);
      alert('Camera access denied. Please allow camera permissions and try again.');
      resolve(null);
    });
  });
}

/**
 * Captures multiple face images for better enrollment
 */
export async function captureFaceForEnrollment(): Promise<string | null> {
  return captureFaceFromCamera();
}

/**
 * Opens camera modal for face capture
 */
export async function captureFaceModal(): Promise<string | null> {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
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

    const video = document.createElement('video');
    video.style.cssText = `
      max-width: 90%;
      max-height: 70%;
      border-radius: 12px;
      border: 2px solid #22c55e;
    `;
    video.playsInline = true;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      margin-top: 20px;
      display: flex;
      gap: 16px;
    `;

    const captureBtn = document.createElement('button');
    captureBtn.textContent = '📸 Capture Face';
    captureBtn.style.cssText = `
      padding: 14px 32px;
      border-radius: 12px;
      border: 1.5px solid #22c55e;
      background: #052e16;
      color: #4ade80;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 14px 32px;
      border-radius: 12px;
      border: 0.5px solid var(--border);
      background: var(--bg-input);
      color: var(--text-muted);
      font-size: 16px;
      cursor: pointer;
    `;

    buttonContainer.appendChild(captureBtn);
    buttonContainer.appendChild(cancelBtn);
    overlay.appendChild(video);
    overlay.appendChild(buttonContainer);
    document.body.appendChild(overlay);

    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then((s) => {
        stream = s;
        video.srcObject = s;
        video.play();
      })
      .catch(() => {
        alert('Camera access denied. Please allow camera permissions.');
        resolve(null);
        overlay.remove();
      });

    captureBtn.onclick = () => {
      if (stream) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        // ✅ Fix: Check if ctx is null
        if (!ctx) {
          stream.getTracks().forEach(track => track.stop());
          overlay.remove();
          resolve(null);
          return;
        }
        
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        
        stream.getTracks().forEach(track => track.stop());
        overlay.remove();
        resolve(imageData);
      }
    };

    cancelBtn.onclick = () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      overlay.remove();
      resolve(null);
    };
  });
}

/**
 * Checks if the browser supports face detection
 */
export function isFaceDetectionSupported(): boolean {
  return 'FaceDetector' in window;
}

/**
 * Detects if there's a face in the image
 */
export async function detectFaceInImage(imageData: string): Promise<boolean> {
  if (!isFaceDetectionSupported()) {
    console.warn('Face detection not supported in this browser');
    return true;
  }

  try {
    const img = new Image();
    img.src = imageData;
    await new Promise((resolve) => { img.onload = resolve; });

    const faceDetector = new (window as any).FaceDetector({
      maxDetectedFaces: 1,
      fastMode: true
    });

    const faces = await faceDetector.detect(img);
    return faces.length > 0;
  } catch (error) {
    console.error('Face detection error:', error);
    return true;
  }
}
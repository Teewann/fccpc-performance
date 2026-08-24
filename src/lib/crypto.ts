import crypto from "crypto";

// ✅ Lazy load the key - only when needed, not at import time
function getKey(): Buffer {
  const key = process.env.FACE_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("FACE_ENCRYPTION_KEY environment variable is not set");
  }
  return Buffer.from(key, "hex");
}

export function encrypt(text: string): string {
  const KEY = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(payload: string): string {
  const KEY = getKey();
  const data = Buffer.from(payload, "base64");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
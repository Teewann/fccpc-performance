import crypto from "crypto";

function getKey(): Buffer {
  const raw = process.env.FACE_ENCRYPTION_KEY || "";
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error(
      `FACE_ENCRYPTION_KEY is invalid: expected a 64-character hex string (32 bytes), got ${raw.length} characters (${key.length} bytes). Check Vercel → Environment Variables.`
    );
  }
  return key;
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const data = Buffer.from(payload, "base64");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
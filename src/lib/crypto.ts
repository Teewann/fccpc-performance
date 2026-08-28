import crypto from "crypto";

function getKey(): Buffer {
  const raw = process.env.FACE_ENCRYPTION_KEY || "";
  
  // ✅ DEBUG LOGS - These will show in Vercel logs
  console.log("🔑 FACE_ENCRYPTION_KEY exists:", !!process.env.FACE_ENCRYPTION_KEY);
  console.log("🔑 FACE_ENCRYPTION_KEY length:", raw.length);
  console.log("🔑 First 10 chars:", raw.substring(0, 10) || "(empty)");
  
  if (!raw || raw.length === 0) {
    throw new Error(
      "❌ FACE_ENCRYPTION_KEY is MISSING or EMPTY! Please add it to Vercel Environment Variables."
    );
  }
  
  try {
    const key = Buffer.from(raw, "hex");
    if (key.length !== 32) {
      throw new Error(
        `❌ FACE_ENCRYPTION_KEY is wrong length: expected 64 hex chars, got ${raw.length} chars. Value starts with: ${raw.substring(0, 20)}...`
      );
    }
    console.log("✅ FACE_ENCRYPTION_KEY is valid (32 bytes)");
    return key;
  } catch (err: any) {
    throw new Error(
      `❌ FACE_ENCRYPTION_KEY is not valid hex: ${err?.message || "unknown error"}. Value starts with: ${raw.substring(0, 20)}...`
    );
  }
}

export function encrypt(text: string): string {
  console.log("🔐 encrypt() called - getting key...");
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const result = Buffer.concat([iv, authTag, encrypted]).toString("base64");
  console.log("✅ encrypt() completed successfully");
  return result;
}

export function decrypt(payload: string): string {
  console.log("🔓 decrypt() called - getting key...");
  const key = getKey();
  const data = Buffer.from(payload, "base64");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const result = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  console.log("✅ decrypt() completed successfully");
  return result;
}
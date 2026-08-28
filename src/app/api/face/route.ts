import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";

const MATCH_THRESHOLD = 0.5;

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const face = await prisma.faceData.findUnique({
      where: { userId: user.id },
    });
    
    return NextResponse.json({ enrolled: !!face });
  } catch (error) {
    console.error("GET /api/face error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action, embedding, code, image } = body;

    console.log("🔵 Face API - action:", action);
    console.log("🔵 Embedding received:", embedding ? "YES (length: " + embedding.length + ")" : "NO");
    console.log("🔵 Image received:", image ? "YES" : "NO");

    // ─── ENROLL ACTION ──────────────────────────────────────────────
    if (action === "enroll") {
      // ── Get the embedding ──────────────────────────────────────────
      let faceEmbedding: number[] = [];

      if (embedding && embedding.length > 0) {
        faceEmbedding = embedding;
        console.log("✅ Using embedding from request");
      } else if (image) {
        // ❌ REMOVED the silent placeholder - now fails loudly
        console.error("❌ Image received but no embedding. This should not happen.");
        return NextResponse.json({ 
          error: "Face detection failed. Please make sure your face is clearly visible and try again."
        }, { status: 400 });
      } else {
        return NextResponse.json({ error: "No face data provided" }, { status: 400 });
      }

      // ── Check if user already has face enrolled ──────────────────
      const existingFace = await prisma.faceData.findUnique({
        where: { userId: user.id },
      });

      // ── Check activation code if not already proven ──────────────
      const existingCred = await prisma.webAuthnCredential.count({
        where: { userId: user.id },
      });
      const alreadyProven = existingCred > 0 || !!existingFace;

      if (!alreadyProven && code) {
        const activation = await prisma.biometricActivationCode.findUnique({
          where: { code },
        });
        
        if (!activation || activation.userId !== user.id || activation.used || activation.expiresAt < new Date()) {
          return NextResponse.json({ error: "Invalid or expired activation code." }, { status: 400 });
        }

        await prisma.biometricActivationCode.update({
          where: { id: activation.id },
          data: { used: true, usedAt: new Date() },
        });
      }

      // ── Encrypt and store real embedding ──────────────────────────
      try {
        console.log("🔐 Encrypting face embedding...");
        console.log("🔐 FACE_ENCRYPTION_KEY exists:", !!process.env.FACE_ENCRYPTION_KEY);
        console.log("🔐 FACE_ENCRYPTION_KEY length:", process.env.FACE_ENCRYPTION_KEY?.length || 0);
        
        const encrypted = encrypt(JSON.stringify(faceEmbedding));

        if (existingFace) {
          await prisma.faceData.update({
            where: { id: existingFace.id },
            data: { 
              embedding: encrypted,
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.faceData.create({
            data: {
              userId: user.id,
              embedding: encrypted,
              algorithm: "face-api-128d",
            },
          });
        }

        console.log("✅ Face enrolled successfully!");
        return NextResponse.json({ success: true });
      } catch (encryptError: any) {
        console.error("❌ Encryption error:", encryptError);
        console.error("❌ Error message:", encryptError?.message);
        console.error("❌ Error stack:", encryptError?.stack);
        
        // Return the ACTUAL error message
        return NextResponse.json({ 
          error: encryptError?.message || "Encryption failed. Please check server logs for details.",
          details: {
            keyExists: !!process.env.FACE_ENCRYPTION_KEY,
            keyLength: process.env.FACE_ENCRYPTION_KEY?.length || 0
          }
        }, { status: 500 });
      }
    }

    // ─── VERIFY ACTION ──────────────────────────────────────────────
    if (action === "verify") {
      // ── Get the embedding from request ────────────────────────────
      if (!embedding || embedding.length === 0) {
        return NextResponse.json({ error: "No face embedding provided" }, { status: 400 });
      }

      // ── Get stored face data ──────────────────────────────────────
      const stored = await prisma.faceData.findUnique({
        where: { userId: user.id },
      });
      
      if (!stored) {
        return NextResponse.json({ error: "No face enrolled. Please set up face verification in Settings first." }, { status: 400 });
      }

      // ── Check if it's a placeholder ───────────────────────────────
      if (stored.embedding === "PLACEHOLDER") {
        return NextResponse.json({ 
          error: "Face data is incomplete. Please re-enroll your face in Settings." 
        }, { status: 400 });
      }

      // ── Decrypt and compare ──────────────────────────────────────
      try {
        const storedEmbedding: number[] = JSON.parse(decrypt(stored.embedding));
        
        if (!storedEmbedding || storedEmbedding.length === 0) {
          return NextResponse.json({ error: "Stored face data is invalid. Please re-enroll." }, { status: 400 });
        }

        const distance = euclideanDistance(embedding, storedEmbedding);
        const match = distance <= MATCH_THRESHOLD;

        // ── Log the attempt ──────────────────────────────────────────
        await prisma.biometricAttempt.create({
          data: {
            userId: user.id,
            method: "FACE",
            success: match,
            similarityScore: 1 - distance,
          },
        });

        if (!match) {
          return NextResponse.json({ 
            error: "Face did not match enrolled record. Please try again.", 
            distance: distance,
            threshold: MATCH_THRESHOLD
          }, { status: 401 });
        }
        
        return NextResponse.json({ success: true, distance: distance });
      } catch (decryptError: any) {
        console.error("❌ Decryption error:", decryptError);
        console.error("❌ Error message:", decryptError?.message);
        return NextResponse.json({ 
          error: decryptError?.message || "Failed to decrypt face data. Please re-enroll your face." 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/face error:", error);
    return NextResponse.json({ error: "Server error: " + (error as Error).message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.faceData.deleteMany({
      where: { userId: user.id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/face error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
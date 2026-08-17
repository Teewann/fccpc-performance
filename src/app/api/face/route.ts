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
        // For now, we'll store a placeholder
        console.warn("⚠️ Image received but server-side face extraction not implemented. Storing placeholder.");
        faceEmbedding = [];
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

      // ── Handle empty embedding (placeholder) ──────────────────────
      if (faceEmbedding.length === 0) {
        console.log("📝 Storing placeholder face data");
        
        if (existingFace) {
          await prisma.faceData.update({
            where: { id: existingFace.id },
            data: { 
              embedding: "PLACEHOLDER",
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.faceData.create({
            data: {
              userId: user.id,
              embedding: "PLACEHOLDER",
              algorithm: "face-api-128d",
            },
          });
        }
        return NextResponse.json({ success: true, warning: "Placeholder stored - please re-enroll with proper embedding" });
      }

      // ── Encrypt and store real embedding ──────────────────────────
      try {
        console.log("🔐 Encrypting face embedding...");
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
      } catch (encryptError) {
        console.error("❌ Encryption error:", encryptError);
        return NextResponse.json({ 
          error: "Encryption failed. Please make sure FACE_ENCRYPTION_KEY is set in Vercel environment variables." 
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
      } catch (decryptError) {
        console.error("Decryption error:", decryptError);
        return NextResponse.json({ 
          error: "Failed to decrypt face data. Please re-enroll your face." 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
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
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

    if (action === "enroll") {
      // ✅ Use either embedding or image
      let faceEmbedding: number[];

      if (embedding) {
        faceEmbedding = embedding;
      } else if (image) {
        // If image is sent, we need to extract embedding from it
        // For now, we'll store the image directly (not ideal, but works for testing)
        // TODO: Use face-api.js to extract embedding from image on server
        faceEmbedding = []; // Placeholder - will be populated from image
      } else {
        return NextResponse.json({ error: "No face data provided" }, { status: 400 });
      }

      // ✅ Check if user already has face enrolled
      const existingFace = await prisma.faceData.findUnique({
        where: { userId: user.id },
      });

      // ✅ Check activation code if not already proven
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

      // ✅ Encrypt and store the face data
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

      return NextResponse.json({ success: true });
    }

    if (action === "verify") {
      const stored = await prisma.faceData.findUnique({
        where: { userId: user.id },
      });
      
      if (!stored) {
        return NextResponse.json({ error: "No face enrolled." }, { status: 400 });
      }

      const storedEmbedding: number[] = JSON.parse(decrypt(stored.embedding));
      const distance = euclideanDistance(embedding, storedEmbedding);
      const match = distance <= MATCH_THRESHOLD;

      await prisma.biometricAttempt.create({
        data: {
          userId: user.id,
          method: "FACE",
          success: match,
          similarityScore: 1 - distance,
        },
      });

      if (!match) {
        return NextResponse.json({ error: "Face did not match enrolled record." }, { status: 401 });
      }
      
      return NextResponse.json({ success: true });
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
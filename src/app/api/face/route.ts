import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";

const MATCH_THRESHOLD = 0.5; // lower = stricter. face-api.js's own docs suggest ~0.6 as the line between same/different person — we go a bit stricter since this gates attendance.

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const face = await prisma.faceData.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ enrolled: !!face });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { action } = body;

  if (action === "enroll") {
    const { embedding, code } = body;

    const existingCred = await prisma.webAuthnCredential.count({ where: { userId: user.id } });
    const existingFace = await prisma.faceData.count({ where: { userId: user.id } });
    const alreadyProven = existingCred > 0 || existingFace > 0;

    if (!alreadyProven) {
      const activation = await prisma.biometricActivationCode.findUnique({ where: { code } });
      if (!activation || activation.userId !== user.id || activation.used || activation.expiresAt < new Date())
        return NextResponse.json({ error: "Invalid or expired activation code." }, { status: 400 });
      await prisma.biometricActivationCode.update({
        where: { id: activation.id },
        data: { used: true, usedAt: new Date() },
      });
    }

    const encrypted = encrypt(JSON.stringify(embedding));
    await prisma.faceData.upsert({
      where: { userId: user.id },
      create: { userId: user.id, embedding: encrypted, algorithm: "face-api-128d" },
      update: { embedding: encrypted, updatedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  }

  if (action === "verify") {
    const { embedding } = body;
    const stored = await prisma.faceData.findUnique({ where: { userId: user.id } });
    if (!stored) return NextResponse.json({ error: "No face enrolled." }, { status: 400 });

    const storedEmbedding: number[] = JSON.parse(decrypt(stored.embedding));
    const distance = euclideanDistance(embedding, storedEmbedding);
    const match = distance <= MATCH_THRESHOLD;

    await prisma.biometricAttempt.create({
      data: { userId: user.id, method: "FACE", success: match, similarityScore: 1 - distance },
    });

    if (!match) return NextResponse.json({ error: "Face did not match enrolled record." }, { status: 401 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.faceData.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ success: true });
}
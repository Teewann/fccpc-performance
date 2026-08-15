import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions, verifyRegistrationResponse,
         generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const rpName = "FCCPC Performance System";
const rpID = process.env.NODE_ENV === "development" ? "localhost" : "fccpc-performance-intelligence-syte.vercel.app";
const origin = process.env.NODE_ENV === "development" ? "http://localhost:3000" : `https://${rpID}`;

// In-memory challenge store keyed by user id
const challengeStore = new Map<string, string>();

// ─── GET ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
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

    const action = new URL(request.url).searchParams.get("action");

    // ── Get enrollment options for enrolling a new device ──────────────
    if (action === "enroll-options") {
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: user.id,
        userName: user.email,
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
      });
      challengeStore.set(user.id, options.challenge);
      return NextResponse.json(options);
    }

    // ── Check if user has any enrolled devices ─────────────────────────
    if (action === "check-enrolled") {
      const count = await prisma.webAuthnCredential.count({
        where: { userId: user.id },
      });
      return NextResponse.json({ hasCredential: count > 0 });
    }

    // ── Get authentication options for signing in ──────────────────────
    if (action === "auth-options") {
      const creds = await prisma.webAuthnCredential.findMany({
        where: { userId: user.id },
      });

      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "required",
        allowCredentials: creds.map((c) => ({
          id: Buffer.from(c.credentialId, "base64url"),
          type: "public-key" as const,
        })),
      });
      challengeStore.set(user.id, options.challenge);
      return NextResponse.json(options);
    }

    // ── List all enrolled devices for the user ─────────────────────────
    if (action === "list-devices") {
      const creds = await prisma.webAuthnCredential.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          deviceLabel: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ devices: creds });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("GET /api/webauthn error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────
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
    const { action, code, response, expectedChallenge, deviceLabel } = body;

    // ── Check activation code validity ─────────────────────────────────
    if (action === "check-activation") {
      const activation = await prisma.biometricActivationCode.findUnique({
        where: { code },
      });

      if (!activation || activation.userId !== user.id) {
        return NextResponse.json({
          error: "Invalid code. Contact IT for your setup code.",
        }, { status: 400 });
      }

      if (activation.used) {
        return NextResponse.json({
          error: "This code has already been used. Contact IT for a new one.",
        }, { status: 400 });
      }

      if (activation.expiresAt < new Date()) {
        return NextResponse.json({
          error: "This code has expired. Contact IT for a new one.",
        }, { status: 400 });
      }

      return NextResponse.json({ valid: true });
    }

    // ── Enroll verify ──────────────────────────────────────────────────
    if (action === "enroll-verify") {
      // Re-check the code server-side too
      const activation = await prisma.biometricActivationCode.findUnique({
        where: { code },
      });

      if (!activation || activation.userId !== user.id) {
        return NextResponse.json({
          error: "Invalid or expired activation code.",
        }, { status: 400 });
      }

      if (activation.used || activation.expiresAt < new Date()) {
        return NextResponse.json({
          error: "Activation code has already been used or expired.",
        }, { status: 400 });
      }

      // Verify the biometric enrollment
      const storedChallenge = challengeStore.get(user.id);
      if (!storedChallenge || storedChallenge !== expectedChallenge) {
        return NextResponse.json({
          error: "Session expired, please try again.",
        }, { status: 400 });
      }

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: storedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return NextResponse.json({
          error: "Could not verify device.",
        }, { status: 400 });
      }

      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

      // Save the credential
      await prisma.webAuthnCredential.create({
        data: {
          userId: user.id,
          credentialId: Buffer.from(credentialID).toString("base64url"),
          publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
          counter,
          deviceLabel: deviceLabel || "Unnamed device",
        },
      });

      // Mark the activation code as used
      await prisma.biometricActivationCode.update({
        where: { id: activation.id },
        data: { used: true, usedAt: new Date() },
      });

      challengeStore.delete(user.id);

      return NextResponse.json({ success: true });
    }

    // ── Auth verify ────────────────────────────────────────────────────
    if (action === "auth-verify") {
      const credIdB64 = response.id;
      const cred = await prisma.webAuthnCredential.findUnique({
        where: { credentialId: credIdB64 },
      });

      if (!cred || cred.userId !== user.id) {
        return NextResponse.json({
          error: "Device not recognized for this account.",
        }, { status: 400 });
      }

      const storedChallenge = challengeStore.get(user.id);
      if (!storedChallenge || storedChallenge !== expectedChallenge) {
        return NextResponse.json({
          error: "Session expired, please try again.",
        }, { status: 400 });
      }

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: storedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: Buffer.from(cred.credentialId, "base64url"),
          credentialPublicKey: Buffer.from(cred.publicKey, "base64url"),
          counter: cred.counter,
        },
      });

      if (!verification.verified) {
        return NextResponse.json({
          error: "Biometric verification failed.",
        }, { status: 401 });
      }

      // Update counter
      await prisma.webAuthnCredential.update({
        where: { id: cred.id },
        data: { counter: verification.authenticationInfo.newCounter },
      });

      challengeStore.delete(user.id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/webauthn error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
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

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Device ID required" }, { status: 400 });
    }

    const cred = await prisma.webAuthnCredential.findUnique({
      where: { id },
    });

    if (!cred || cred.userId !== user.id) {
      return NextResponse.json({ error: "Device not found." }, { status: 404 });
    }

    await prisma.webAuthnCredential.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/webauthn error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
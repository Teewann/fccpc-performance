import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions, verifyRegistrationResponse,
         generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const rpName = "FCCPC Performance System";
const rpID = process.env.NODE_ENV === "development" ? "localhost" : "yourdomain.gov.ng";
const origin = process.env.NODE_ENV === "development" ? "http://localhost:3000" : `https://${rpID}`;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });


  const action = new URL(request.url).searchParams.get("action");

  if (action === "enroll-options") {
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,  // ✅ Remove Buffer.from() - just use string
    userName: user.email,
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
  });
  return NextResponse.json(options);
}

  if (action === "check-enrolled") {
  const count = await prisma.webAuthnCredential.count({ where: { userId: user.id } });
  return NextResponse.json({ hasCredential: count > 0 });
}

  if (action === "auth-options") {
  const creds = await prisma.webAuthnCredential.findMany({ where: { userId: user.id } });
  
  // ✅ Convert credentialId from base64url to Buffer
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: creds.map((c) => ({
      id: Buffer.from(c.credentialId, "base64url"),
      type: "public-key" as const,
    })),
  });
  return NextResponse.json(options);
}

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action, response, expectedChallenge, deviceLabel, code } = await request.json();

  // ── NEW: Check activation code ──────────────────────────────────────
  if (action === "check-activation") {
    const activation = await prisma.biometricActivationCode.findUnique({ 
      where: { code } 
    });

    if (!activation || activation.userId !== user.id) {
      return NextResponse.json({ 
        error: "Invalid code. Contact IT for your setup code." 
      }, { status: 400 });
    }
    
    if (activation.used) {
      return NextResponse.json({ 
        error: "This code has already been used. Contact IT for a new one." 
      }, { status: 400 });
    }
    
    if (activation.expiresAt < new Date()) {
      return NextResponse.json({ 
        error: "This code has expired. Contact IT for a new one." 
      }, { status: 400 });
    }

    return NextResponse.json({ valid: true });
  }

  // ── UPDATED: Enroll verify with activation code check ───────────────
  if (action === "enroll-verify") {
    // Check activation code first (prevent enrollment without IT approval)
    const activation = await prisma.biometricActivationCode.findUnique({ 
      where: { code } 
    });

    if (!activation || activation.userId !== user.id) {
      return NextResponse.json({ 
        error: "Invalid activation code. Please contact IT." 
      }, { status: 400 });
    }
    
    if (activation.used) {
      return NextResponse.json({ 
        error: "This code has already been used." 
      }, { status: 400 });
    }
    
    if (activation.expiresAt < new Date()) {
      return NextResponse.json({ 
        error: "This code has expired. Request a new one from IT." 
      }, { status: 400 });
    }

    // Verify the biometric enrollment
    const verification = await verifyRegistrationResponse({
      response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID,
    });
    
    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Could not verify device" }, { status: 400 });
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

    return NextResponse.json({ success: true });
  }

  if (action === "auth-verify") {
    const credIdB64 = response.id;
    const cred = await prisma.webAuthnCredential.findUnique({ where: { credentialId: credIdB64 } });
    if (!cred || cred.userId !== user.id) {
      return NextResponse.json({ error: "Device not recognized for this account" }, { status: 400 });
    }

    const verification = await verifyAuthenticationResponse({
      response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(cred.credentialId, "base64url"),
        credentialPublicKey: Buffer.from(cred.publicKey, "base64url"),
        counter: cred.counter,
      },
    });
    
    if (!verification.verified) {
      return NextResponse.json({ error: "Biometric verification failed" }, { status: 401 });
    }

    await prisma.webAuthnCredential.update({
      where: { id: cred.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });
    
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
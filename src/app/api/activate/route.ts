import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: "Email, code, and password are required." }, { status: 400 });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase();

    // Find the activation code
    const activation = await prisma.accountActivationCode.findUnique({ 
      where: { code } 
    });

    if (!activation) {
      return NextResponse.json({ error: "Invalid activation code." }, { status: 400 });
    }

    if (activation.email.toLowerCase() !== normalizedEmail) {
      return NextResponse.json({ error: "This code is for a different email address." }, { status: 400 });
    }

    if (activation.used) {
      return NextResponse.json({ error: "This code has already been used. Contact IT for a new one." }, { status: 400 });
    }

    if (activation.expiresAt < new Date()) {
      return NextResponse.json({ error: "This code has expired. Contact IT for a new one." }, { status: 400 });
    }

    // Check if user exists, if not create them
    let user = await prisma.user.findUnique({ 
      where: { email: normalizedEmail } 
    });

    if (!user) {
      // Create the user account first
      const hashed = await bcrypt.hash(newPassword, 10);
      
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedEmail.split("@")[0], // Use part before @ as name
          password: hashed,
          role: activation.role || "STAFF",
          isActive: true,
        },
      });
    } else {
      // User exists, just update password
      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ 
        where: { id: user.id }, 
        data: { 
          password: hashed,
          isActive: true,
        } 
      });
    }

    // Mark code as used
    await prisma.accountActivationCode.update({ 
      where: { id: activation.id }, 
      data: { used: true, usedAt: new Date() } 
    });

    // Log the activation
    await prisma.auditLog.create({
      data: { 
        userId: user.id, 
        action: "ACCOUNT_ACTIVATED", 
        detail: `Account activated via code: ${code}` 
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Activation error:", error);
    return NextResponse.json({ 
      error: "Server error. Please try again." 
    }, { status: 500 });
  }
}
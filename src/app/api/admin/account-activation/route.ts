import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function generateCode(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ 
      where: { email: session.user.email } 
    });
    
    if (!admin || !["ADMIN", "HR"].includes(admin.role)) {
      return NextResponse.json({ error: "Only Admin or HR can generate activation codes." }, { status: 403 });
    }

    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const staff = await prisma.user.findUnique({ 
      where: { email: email.toLowerCase() } 
    });
    
    if (!staff) {
      return NextResponse.json({ 
        error: "No staff account found with that email." 
      }, { status: 404 });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // ✅ Use biometricActivationCode model (which uses userId)
    await prisma.biometricActivationCode.create({
      data: { 
        code, 
        userId: staff.id, 
        createdById: admin.id, 
        expiresAt 
      },
    });

    return NextResponse.json({ code, expiresAt });
  } catch (error) {
    console.error("Error generating activation code:", error);
    return NextResponse.json({ 
      error: "Server error: " + (error as Error).message 
    }, { status: 500 });
  }
}
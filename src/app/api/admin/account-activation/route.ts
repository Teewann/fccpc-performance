import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function generateCode(): string {
  // Generate 8-digit code
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔵 Account activation: Starting...");
    
    const session = await getServerSession(authOptions);
    console.log("🔵 Session:", session?.user?.email);
    
    if (!session?.user?.email) {
      console.log("❌ Not authenticated");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ 
      where: { email: session.user.email } 
    });
    console.log("🔵 Admin found:", admin?.email, "Role:", admin?.role);
    
    if (!admin || !["ADMIN", "HR"].includes(admin.role)) {
      console.log("❌ Unauthorized - role:", admin?.role);
      return NextResponse.json({ error: "Only Admin or HR can generate activation codes." }, { status: 403 });
    }

    const { email } = await request.json();
    console.log("🔵 Looking for staff:", email);
    
    if (!email) {
      console.log("❌ No email provided");
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const staff = await prisma.user.findUnique({ 
      where: { email: email.toLowerCase() } 
    });
    console.log("🔵 Staff found:", staff?.email);
    
    if (!staff) {
      console.log("❌ Staff not found:", email);
      return NextResponse.json({ 
        error: "No staff account found with that email. Create the account first." 
      }, { status: 404 });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    console.log("🔵 Code generated:", code);

    // ✅ FIX: Use the CORRECT model - biometricActivationCode
    await prisma.biometricActivationCode.create({
      data: { 
        code, 
        userId: staff.id,           // ✅ Use userId, not email
        createdById: admin.id, 
        expiresAt 
      },
    });
    console.log("✅ Code saved to database");

    return NextResponse.json({ code, expiresAt });
  } catch (error) {
    console.error("❌ Error generating activation code:", error);
    return NextResponse.json({ 
      error: "Server error: " + (error as Error).message 
    }, { status: 500 });
  }
}
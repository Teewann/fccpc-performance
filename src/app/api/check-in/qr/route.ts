import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    console.log("📡 QR API: Request received");
    
    const session = await getServerSession(authOptions);
    console.log("📡 Session:", session?.user?.email);
    
    if (!session?.user?.email) {
      console.log("❌ No session");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    console.log("📡 User found:", user?.id);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { token } = await request.json();
    console.log("📡 Token received:", token);

    if (!token) {
      return NextResponse.json({ error: "QR token required" }, { status: 400 });
    }

    // Verify the token format
    const parts = token.split("-");
    console.log("📡 Token parts:", parts);
    
    if (parts.length < 4 || parts[0] !== "FCCPC" || parts[1] !== "CHECKIN") {
      console.log("❌ Invalid token format");
      return NextResponse.json({ error: "Invalid QR token" }, { status: 400 });
    }

    // Check if token is expired (more than 5 minutes old)
    const timestamp = parseInt(parts[2]);
    console.log("📡 Timestamp:", timestamp, "Age:", Date.now() - timestamp);
    
    if (isNaN(timestamp) || Date.now() - timestamp > 5 * 60 * 1000) {
      console.log("❌ Token expired");
      return NextResponse.json({ error: "QR code expired. Please refresh." }, { status: 400 });
    }

    // Check if already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.checkIn.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
    });

    console.log("📡 Existing check-in:", existing?.id);

    if (existing) {
      return NextResponse.json({ error: "You have already checked in today" }, { status: 400 });
    }

    // Create check-in record
    const now = new Date();
    const lateThreshold = new Date(today);
    lateThreshold.setHours(8, 30, 0, 0);
    const status = now > lateThreshold ? "LATE" : "PRESENT";

    console.log("📡 Creating check-in with status:", status);

    const checkIn = await prisma.checkIn.create({
      data: {
        userId: user.id,
        date: today,
        checkInAt: now,
        status,
        isOnPremises: true,
        locationMethod: "QR",
        note: "Checked in via QR code",
      },
    });

    console.log("✅ Check-in created:", checkIn.id);

    // Try to create audit log, but don't fail if it doesn't work
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "CHECK_IN",
          detail: `QR check-in at ${now.toLocaleTimeString("en-GB")} - ${status}`,
        },
      });
      console.log("✅ Audit log created");
    } catch (auditError) {
      console.warn("⚠️ Audit log failed, but check-in succeeded:", auditError);
      // Don't fail the whole request
    }

    return NextResponse.json({ success: true, checkIn });
  } catch (error) {
    console.error("❌ QR check-in error:", error);
    return NextResponse.json({ error: "Server error: " + (error as Error).message }, { status: 500 });
  }
}
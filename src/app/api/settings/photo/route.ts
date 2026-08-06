import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
  "image/heic",
  "image/heif",
];

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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 10MB.` },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type) && file.type !== "") {
      return NextResponse.json(
        { error: "File type not supported." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    let mimeType = file.type || "image/jpeg";
    const header = buffer.slice(0, 4);
    if (header[0] === 0xFF && header[1] === 0xD8) mimeType = "image/jpeg";
    else if (header[0] === 0x89 && header[1] === 0x50) mimeType = "image/png";
    else if (header[0] === 0x47 && header[1] === 0x49) mimeType = "image/gif";
    else if (header[0] === 0x52 && header[1] === 0x49) mimeType = "image/webp";

    const dataUrl = `data:${mimeType};base64,${base64}`;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { photo: dataUrl },
      select: { id: true, name: true, photo: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PROFILE_PHOTO_UPDATED",
        detail: `Profile photo updated (${(file.size / 1024).toFixed(0)}KB, ${mimeType})`,
      },
    });

    return NextResponse.json({
      success: true,
      photo: updated.photo,
      message: "Profile photo updated successfully",
    });
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { photo: null },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PROFILE_PHOTO_REMOVED",
        detail: "Profile photo removed",
      },
    });

    return NextResponse.json({ success: true, message: "Profile photo removed" });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
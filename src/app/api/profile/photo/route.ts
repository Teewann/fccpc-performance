// FILE PATH: app/api/profile/photo/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/gif",  "image/bmp", "image/tiff", "image/svg+xml",
  "image/heic", "image/heif",
];

// ── POST: upload / replace photo ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data. Please try again." }, { status: 400 });
    }

    const file = formData.get("photo") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Size check
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.` },
        { status: 400 }
      );
    }

    // Convert to buffer
    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Detect MIME type from magic bytes (fallback to declared type)
    let mimeType = file.type || "image/jpeg";
    const h      = buffer;
    if (h[0] === 0xFF && h[1] === 0xD8)                         mimeType = "image/jpeg";
    else if (h[0] === 0x89 && h[1] === 0x50)                    mimeType = "image/png";
    else if (h[0] === 0x47 && h[1] === 0x49)                    mimeType = "image/gif";
    else if (h[0] === 0x52 && h[1] === 0x49 && h[8] === 0x57)  mimeType = "image/webp";

    // Type check (after magic-byte detection)
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a JPG, PNG, WebP, GIF, BMP, or TIFF." },
        { status: 400 }
      );
    }

    // Store as base64 data URL in the database
    // For production at scale, swap this for Cloudinary / Supabase Storage
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

    const updated = await prisma.user.update({
      where:  { id: user.id },
      data:   { photo: dataUrl },
      select: { id: true, name: true, photo: true },
    });

    // Audit log (optional — only runs if AuditLog model exists)
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "PROFILE_PHOTO_UPDATED",
          detail: `Photo updated (${(file.size / 1024).toFixed(0)} KB, ${mimeType})`,
        },
      });
    } catch { /* silently skip if audit log table doesn't exist yet */ }

    return NextResponse.json({
      success: true,
      photo:   updated.photo,
      message: "Profile photo updated successfully",
    });

  } catch (error) {
    console.error("[photo POST]", error);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}

// ── DELETE: remove photo ──────────────────────────────────────────────────────
export async function DELETE(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await prisma.user.update({ where: { id: user.id }, data: { photo: null } });

    try {
      await prisma.auditLog.create({
        data: { userId: user.id, action: "PROFILE_PHOTO_REMOVED", detail: "Profile photo removed" },
      });
    } catch { /* silently skip */ }

    return NextResponse.json({ success: true, message: "Profile photo removed" });

  } catch (error) {
    console.error("[photo DELETE]", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

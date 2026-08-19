import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// GET - list vault files
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || user.role !== "EXECUTIVE") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || null;

    const files = await prisma.eVCVaultFile.findMany({
      where: {
        ownerId: user.id,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: "desc" },
      // Never return file data in list - only metadata
      select: {
        id: true, title: true, description: true, category: true,
        fileName: true, fileType: true, fileSize: true,
        isEncrypted: true, tags: true, createdAt: true, updatedAt: true,
      },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// POST - upload file to vault
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || user.role !== "EXECUTIVE") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const formData   = await request.formData();
    const file       = formData.get("file") as File | null;
    const title      = formData.get("title") as string;
    const description = formData.get("description") as string;
    const category   = formData.get("category") as string;
    const tags       = formData.get("tags") as string;
    const isEncrypted = formData.get("isEncrypted") === "true";

    if (!file || !title || !category) {
      return NextResponse.json({ error: "File, title and category are required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.` },
        { status: 400 }
      );
    }

    // Convert to base64
    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const vaultFile = await prisma.eVCVaultFile.create({
      data: {
        ownerId:     user.id,
        title:       title.trim(),
        description: description?.trim() || null,
        category,
        fileName:    file.name,
        fileType:    file.type,
        fileSize:    file.size,
        fileData:    dataUrl,
        isEncrypted,
        tags:        tags?.trim() || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "EVC_VAULT_UPLOAD",
        detail: `EVC uploaded file to vault: "${title}" (${(file.size / 1024).toFixed(0)}KB)`,
      },
    });

    // Return metadata only - not file data
    const { fileData: _, ...safefile } = vaultFile;
    return NextResponse.json({ success: true, file: safefile }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// DELETE - remove file from vault
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || user.role !== "EXECUTIVE") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("id");
    if (!fileId) return NextResponse.json({ error: "File id required" }, { status: 400 });

    // Confirm file belongs to this EVC
    const vaultFile = await prisma.eVCVaultFile.findUnique({ where: { id: fileId } });
    if (!vaultFile || vaultFile.ownerId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.eVCVaultFile.delete({ where: { id: fileId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// PATCH - download file (requires password confirmation from client)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || user.role !== "EXECUTIVE") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body   = await request.json();
    const { fileId } = body;

    const vaultFile = await prisma.eVCVaultFile.findUnique({ where: { id: fileId } });
    if (!vaultFile || vaultFile.ownerId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Log the download
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "EVC_VAULT_DOWNLOAD",
        detail: `EVC downloaded vault file: "${vaultFile.title}"`,
      },
    });

    return NextResponse.json({
      success:  true,
      fileData: vaultFile.fileData,
      fileName: vaultFile.fileName,
      fileType: vaultFile.fileType,
    });
  } catch (error) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
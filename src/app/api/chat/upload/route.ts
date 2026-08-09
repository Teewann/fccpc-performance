import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  // Limit file size (20 MB) — same limit as before
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) return NextResponse.json({ error: "File too large (max 100MB)" }, { status: 400 });
  
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Strip extension + sanitize name for a clean Cloudinary public_id
  const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_");
  const publicId = `${Date.now()}-${baseName}`;

  try {
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "fccpc/chat",
          resource_type: "auto", // handles images, video, audio (voice notes), and raw files (pdf/docs) automatically
          public_id: publicId,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json({
      url: uploadResult.secure_url,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
    });
  } catch (err: any) {
    console.error("[Chat Upload] Cloudinary error:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
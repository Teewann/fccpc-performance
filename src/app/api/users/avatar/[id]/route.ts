// src/app/api/users/avatar/[id]/route.ts
//
// Serves a single user's avatar.
// Base64 photos stored in the DB can be up to 1 MB — this route exists so
// list endpoints don't have to ship that data, and the browser can cache
// avatars independently.
//
// Usage: <img src={`/api/users/avatar/${userId}`} />
//
// Note: Next.js 15+ passes route params as a Promise. Handle both old and new.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
};

function pixelGif() {
  return Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
}

type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    // Next.js 15/16 params is a Promise; Next.js 14 was a plain object.
    // Support both.
    const raw = ctx.params;
    const resolved = typeof (raw as any)?.then === "function" ? await raw : raw;
    const id = (resolved as { id: string })?.id;

    if (!id) {
      console.warn("[avatar route] no id in params");
      return new NextResponse(pixelGif(), {
        headers: { "Content-Type": "image/gif", ...CACHE_HEADERS },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { photo: true },
    });

    if (!user?.photo) {
      return new NextResponse(pixelGif(), {
        headers: { "Content-Type": "image/gif", ...CACHE_HEADERS },
      });
    }

    const photo = user.photo;

    // Format 1: full data URL, e.g. "data:image/jpeg;base64,..."
    const match = photo.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
    if (match) {
      const [, mimeType, b64] = match;
      const buffer = Buffer.from(b64, "base64");
      return new NextResponse(buffer, {
        headers: { "Content-Type": mimeType, ...CACHE_HEADERS },
      });
    }

    // Format 2: a URL — redirect
    if (
      photo.startsWith("http://") ||
      photo.startsWith("https://") ||
      photo.startsWith("/")
    ) {
      return NextResponse.redirect(photo);
    }

    // Format 3: raw base64 (no prefix)
    const buffer = Buffer.from(photo, "base64");
    return new NextResponse(buffer, {
      headers: { "Content-Type": "image/jpeg", ...CACHE_HEADERS },
    });
  } catch (error) {
    console.error("[avatar route]", error);
    return new NextResponse(pixelGif(), {
      headers: { "Content-Type": "image/gif", ...CACHE_HEADERS },
    });
  }
}
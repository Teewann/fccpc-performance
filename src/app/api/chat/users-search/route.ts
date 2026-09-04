import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { cache } from "@/lib/cache";

/**
 * Fast user search for New Chat modal.
 * Full staff list is cached for 60 seconds — subsequent searches are instant.
 * EVC users only appear if the searcher has a high enough role.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myId   = (session.user as any).id   as string;
  const myRole = (session.user as any).role as string;
  const q      = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";

  const EXEC_ROLES = ["EXECUTIVE", "DIRECTOR", "ADMIN", "HR"];
  const canSeeEVC  = EXEC_ROLES.includes(myRole);

  const cacheKey = `users:list:${canSeeEVC}`;
  let allUsers = cache.get<object[]>(cacheKey);

  if (!allUsers) {
    allUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: myId },
        // Non-exec users cannot see EVC
        ...(!canSeeEVC ? { role: { not: "EXECUTIVE" } } : {}),
      },
      select: {
        id: true, name: true, email: true, photo: true,
        role: true, staffId: true,
        department: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });
    cache.set(cacheKey, allUsers, 60_000); // cache for 60s
  }

  // Filter in-memory (no DB hit on every keystroke)
  const filtered = q
    ? (allUsers as any[]).filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.staffId?.toLowerCase().includes(q) ||
        u.department?.name?.toLowerCase().includes(q)
      )
    : allUsers;

  return NextResponse.json({ users: filtered });
}
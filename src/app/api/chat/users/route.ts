import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/chat/users?q=searchterm
 *
 * SEPARATE from /api/users (which has admin role restrictions).
 * This endpoint is FOR CHAT ONLY — ALL active staff can search everyone.
 * EVC/CHIEF roles are hidden from non-exec staff.
 *
 * Results are cached in-memory for 60s so typing search is instant.
 */

const _cache = new Map<string, { data: object[]; exp: number }>();

function getCache(k: string) {
  const e = _cache.get(k);
  return e && Date.now() < e.exp ? e.data : null;
}
function setCache(k: string, d: object[]) {
  _cache.set(k, { data: d, exp: Date.now() + 60_000 });
}

// Roles that can see EVC/CHIEF users
const CAN_SEE_EVC = new Set(["EXECUTIVE", "DIRECTOR", "ADMIN", "HR", "CHIEF"]);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myId      = (session.user as any).id   as string;
  const myRole    = (session.user as any).role as string;
  const q         = req.nextUrl.searchParams.get("q")?.toLowerCase().trim() ?? "";
  const canSeeEVC = CAN_SEE_EVC.has(myRole);

  const cacheKey = `chat-users:${canSeeEVC}`;
  let allUsers = getCache(cacheKey);

  if (!allUsers) {
    // ALL active staff — no role restriction except hiding EVC from non-exec
    allUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: myId },
        ...(!canSeeEVC ? { role: { notIn: ["EXECUTIVE", "CHIEF"] } } : {}),
      },
      select: {
  id: true, name: true, email: true,
  role: true, staffId: true,
  lastSeen: true,
  department: { select: { name: true } },
  // photo: REMOVED — served on-demand via /api/users/avatar/[id]
},
      orderBy: { name: "asc" },
    });
    setCache(cacheKey, allUsers as object[]);
  }

  // Filter in-memory — zero DB hit per keystroke
  const users = q
    ? (allUsers as any[]).filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.staffId?.toLowerCase().includes(q) ||
        u.department?.name?.toLowerCase().includes(q)
      )
    : allUsers;

  return NextResponse.json({ users });
}

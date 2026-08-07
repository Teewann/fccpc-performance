import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AGENCY } from "@/config/agency.config";

const WORK_START_HOUR   = 8;
const WORK_START_MINUTE = 0;
const LATE_GRACE_MINS   = 30; // late after 8:30 AM

function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function ipMatchesRange(ip: string, range: string): boolean {
  if (range.includes("/")) {
    const [subnet, bitsStr] = range.split("/");
    const bits = parseInt(bitsStr, 10);
    const ipParts     = ip.split(".").map(Number);
    const subnetParts = subnet.split(".").map(Number);
    if (ipParts.length !== 4 || subnetParts.length !== 4) return false;
    const mask      = -1 << (32 - bits);
    const ipNum     = (ipParts[0]     << 24) | (ipParts[1]     << 16) | (ipParts[2]     << 8) | ipParts[3];
    const subnetNum = (subnetParts[0] << 24) | (subnetParts[1] << 16) | (subnetParts[2] << 8) | subnetParts[3];
    return (ipNum & mask) === (subnetNum & mask);
  }
  return ip === range;
}

function isFccpcIp(ip: string | null): boolean {
  if (!ip) return false;
  return AGENCY.allowedIPs.some((range) => ipMatchesRange(ip, range));
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isGpsOnPremises(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  const hq   = AGENCY.hqLocation;
  const dist = haversineMeters(lat, lng, hq.lat, hq.lng);
  return dist <= hq.radiusMeters;
}

// ── Core premises decision ───────────────────────────────────────────
// In dev: reads SIMULATE_ON_PREMISES env var so you can toggle without
// changing any code. In production: real IP + GPS logic only.
function resolveOnPremises(ipResult: boolean, gpsResult: boolean): boolean {
  if (process.env.NODE_ENV === "development") {
    const sim = process.env.SIMULATE_ON_PREMISES;
    if (sim === "true")  return true;
    if (sim === "false") return false;
    // If env var not set, fall through to real logic
  }
  // FAIR RULE: either IP or GPS confirming is enough
  return ipResult || gpsResult;
}

// ── GET ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const view   = searchParams.get("view")   || "today";
    const month  = searchParams.get("month");
    const userId = searchParams.get("userId") || user.id;

    const isPrivileged = ["ADMIN", "HR", "DIRECTOR", "EXECUTIVE"].includes(user.role);

    // ── Location check — called by frontend before check-in ──────────
    if (view === "location-check") {
      const ip           = getIp(request);
      const ipOnPremises = isFccpcIp(ip);
      const simVar       = process.env.SIMULATE_ON_PREMISES;
      const isOnPremises =
        process.env.NODE_ENV === "development" && simVar !== undefined
          ? simVar === "true"
          : ipOnPremises;

      return NextResponse.json({
        isOnPremises,
        ipOnPremises,
        ip:          ip || "unknown",
        simulating:  process.env.NODE_ENV === "development" ? simVar || "not set" : "production",
      });
    }

    // ── Today's check-in ─────────────────────────────────────────────
    if (view === "today") {
      const today = await prisma.checkIn.findUnique({
        where: { userId_date: { userId: user.id, date: todayDate() } },
      });

      let teamToday: any[] = [];
      let absent:    any[] = [];

      if (isPrivileged) {
        const whereClause: any = { date: todayDate() };
        if (user.role === "DIRECTOR" && user.departmentId) {
          whereClause.user = { departmentId: user.departmentId };
        }
        teamToday = await prisma.checkIn.findMany({
          where:   whereClause,
          include: {
            user: {
              select: {
                id: true, name: true, role: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { checkInAt: "asc" },
        });

        const checkedInIds   = new Set(teamToday.map((c: any) => c.userId));
        const allActiveStaff = await prisma.user.findMany({
          where: {
            isActive: true,
            ...(user.role === "DIRECTOR" && user.departmentId
              ? { departmentId: user.departmentId }
              : {}),
          },
          select: {
            id: true, name: true, role: true,
            department: { select: { name: true } },
          },
        });
        absent = allActiveStaff.filter((s) => !checkedInIds.has(s.id));
      }

      return NextResponse.json({ today, teamToday, absent });
    }

    // ── History ──────────────────────────────────────────────────────
    if (view === "history") {
      const targetId = isPrivileged ? userId : user.id;
      let start: Date;
      let end: Date;

      if (month) {
        const [yr, mo] = month.split("-").map(Number);
        start = new Date(yr, mo - 1, 1);
        end   = new Date(yr, mo, 1);
      } else {
        end   = new Date();
        start = new Date(); start.setDate(start.getDate() - 30);
      }

      const records = await prisma.checkIn.findMany({
        where:   { userId: targetId, date: { gte: start, lt: end } },
        orderBy: { date: "desc" },
      });

      const present  = records.filter((r) => r.status !== "ABSENT").length;
      const late     = records.filter((r) => r.status === "LATE").length;
      const halfDay  = records.filter((r) => r.status === "HALF_DAY").length;
      const totalHrs = records.reduce((s, r) => s + (r.hoursWorked || 0), 0);
      const avgHrs   = present > 0 ? Math.round((totalHrs / present) * 10) / 10 : 0;

      return NextResponse.json({
        records,
        summary: {
          present, late, halfDay,
          totalHrs: Math.round(totalHrs * 10) / 10,
          avgHrs,
        },
      });
    }

    return NextResponse.json({ error: "Invalid view" }, { status: 400 });
  } catch (error) {
    console.error("[CheckIn GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST — check in ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { note, gpsLat, gpsLng, locationMethod } = body;

    const today = todayDate();
    const now   = new Date();
    const ip    = getIp(request);

    const existing = await prisma.checkIn.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });
    if (existing) {
      return NextResponse.json({ error: "You have already checked in today" }, { status: 400 });
    }

    // Late threshold — 8:30 AM
    const lateThreshold = new Date(today);
    lateThreshold.setHours(WORK_START_HOUR, WORK_START_MINUTE + LATE_GRACE_MINS, 0, 0);
    const status = now > lateThreshold ? "LATE" : "PRESENT";

    // Individual signals
    const ipOnPremises  = isFccpcIp(ip);
    const gpsConfirmed  = isGpsOnPremises(gpsLat, gpsLng);

    // Final decision — respects SIMULATE_ON_PREMISES in dev
    const onPremises = resolveOnPremises(ipOnPremises, gpsConfirmed);

    // Build method string
    const methods: string[] = [];
    if (process.env.NODE_ENV === "development" && process.env.SIMULATE_ON_PREMISES !== undefined) {
      methods.push(`SIM:${process.env.SIMULATE_ON_PREMISES}`);
    } else {
      if (ipOnPremises) methods.push("IP");
      if (gpsConfirmed) methods.push("GPS");
    }
    const detectedMethod = locationMethod || (methods.length > 0 ? methods.join("+") : "UNVERIFIED");

    const checkIn = await prisma.checkIn.create({
      data: {
        userId:       user.id,
        date:         today,
        checkInAt:    now,
        status,
        note:         note || null,
        ipAddress:    ip,
        isOnPremises: onPremises,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CHECK_IN",
        detail: `Checked in ${now.toLocaleTimeString("en-GB")} — ${status} — IP: ${ip || "unknown"} (${ipOnPremises ? "FCCPC" : "external"}) — GPS: ${gpsConfirmed ? "within HQ" : gpsLat != null ? "outside range" : "not provided"} — Premises: ${onPremises ? "ON" : "OFF"} — Method: ${detectedMethod}`,
      },
    });

    return NextResponse.json({ success: true, checkIn });
  } catch (error) {
    console.error("[CheckIn POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH — check out ────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { note } = body;

    const today = todayDate();
    const now   = new Date();

    const existing = await prisma.checkIn.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });

    if (!existing)         return NextResponse.json({ error: "You have not checked in today" },    { status: 400 });
    if (existing.checkOutAt) return NextResponse.json({ error: "You have already checked out today" }, { status: 400 });

    const msWorked    = now.getTime() - existing.checkInAt.getTime();
    const hoursWorked = Math.round((msWorked / 3_600_000) * 100) / 100;

    const finalStatus =
      existing.status === "LATE"
        ? hoursWorked < 4 ? "HALF_DAY" : "LATE"
        : hoursWorked < 4 ? "HALF_DAY" : existing.status;

    const checkIn = await prisma.checkIn.update({
      where: { id: existing.id },
      data: {
        checkOutAt:  now,
        hoursWorked,
        status:      finalStatus,
        ...(note ? { note } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CHECK_OUT",
        detail: `Checked out ${now.toLocaleTimeString("en-GB")} — ${hoursWorked}h worked — ${finalStatus}`,
      },
    });

    return NextResponse.json({ success: true, checkIn });
  } catch (error) {
    console.error("[CheckIn PATCH]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
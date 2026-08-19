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

// ✅ FIX: Accepts GPS accuracy and gives fair margin
function evaluateGps(lat: number | null | undefined, lng: number | null | undefined, accuracy: number | null | undefined) {
  if (lat == null || lng == null) return { onPremises: false, distanceMeters: null as number | null };
  const hq = AGENCY.hqLocation;
  const distanceMeters = haversineMeters(lat, lng, hq.lat, hq.lng);
  const margin = accuracy ? Math.min(accuracy, 150) : 0;
  return { onPremises: distanceMeters <= hq.radiusMeters + margin, distanceMeters };
}

function isGpsOnPremises(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  const hq   = AGENCY.hqLocation;
  const dist = haversineMeters(lat, lng, hq.lat, hq.lng);
  return dist <= hq.radiusMeters;
}

function resolveOnPremises(ipResult: boolean, gpsResult: boolean): boolean {
  if (process.env.NODE_ENV === "development") {
    const sim = process.env.SIMULATE_ON_PREMISES;
    if (sim === "true")  return true;
    if (sim === "false") return false;
  }
  return ipResult || gpsResult;
}

// ── GET ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // ✅ OPTIMIZED: Use session.user.id directly (no redundant DB lookup)
    const userId = (session?.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view   = searchParams.get("view")   || "today";
    const month  = searchParams.get("month");
    const targetUserId = searchParams.get("userId") || userId;

    // ✅ OPTIMIZED: Single query for user role (only when needed)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, departmentId: true }
    });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isPrivileged = ["ADMIN", "HR", "DIRECTOR", "EXECUTIVE"].includes(user.role);

    // ── Location check - called by frontend before check-in ──────────
    if (view === "location-check") {
      const ip           = getIp(request);
      const ipOnPremises = isFccpcIp(ip);
      const simVar       = process.env.SIMULATE_ON_PREMISES;

      // ✅ FIX: Return HQ data so client uses single source of truth
      return NextResponse.json({
        ipOnPremises,
        ip: ip || "unknown",
        simulating: process.env.NODE_ENV === "development" ? simVar || "not set" : "production",
        hq: {
          lat: AGENCY.hqLocation.lat,
          lng: AGENCY.hqLocation.lng,
          radiusMeters: AGENCY.hqLocation.radiusMeters,
        },
      });
    }

    // ── Today's check-in ─────────────────────────────────────────────
    if (view === "today") {
      // ✅ OPTIMIZED: Single query for today's check-in
      const today = await prisma.checkIn.findUnique({
        where: { userId_date: { userId, date: todayDate() } },
      });

      let teamToday: any[] = [];
      let absent: any[] = [];

      if (isPrivileged) {
        // ✅ OPTIMIZED: Parallel queries
        const whereClause: any = { date: todayDate() };
        if (user.role === "DIRECTOR" && user.departmentId) {
          whereClause.user = { departmentId: user.departmentId };
        }

        const [teamTodayResult, allActiveStaff] = await Promise.all([
          prisma.checkIn.findMany({
            where: whereClause,
            include: {
              user: {
                select: {
                  id: true, name: true, role: true,
                  department: { select: { name: true } },
                },
              },
            },
            orderBy: { checkInAt: "asc" },
          }),
          prisma.user.findMany({
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
          }),
        ]);

        teamToday = teamTodayResult;
        const checkedInIds = new Set(teamToday.map((c: any) => c.userId));
        absent = allActiveStaff.filter((s) => !checkedInIds.has(s.id));
      }

      return NextResponse.json({ today, teamToday, absent });
    }

    // ── History ──────────────────────────────────────────────────────
    if (view === "history") {
      const targetId = isPrivileged ? targetUserId : userId;
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
        where: { userId: targetId, date: { gte: start, lt: end } },
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

// ── POST - check in ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // ✅ OPTIMIZED: Use session.user.id directly
    const userId = (session?.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { note, gpsLat, gpsLng, gpsAccuracy, locationMethod, verificationMethod } = body;

    const today = todayDate();
    const now   = new Date();
    const ip    = getIp(request);

    // ✅ OPTIMIZED: Single query for user and check-in
    const [user, existing] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.checkIn.findUnique({
        where: { userId_date: { userId, date: today } },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing) {
      return NextResponse.json({ error: "You have already checked in today" }, { status: 400 });
    }

    // Late threshold - 8:30 AM
    const lateThreshold = new Date(today);
    lateThreshold.setHours(WORK_START_HOUR, WORK_START_MINUTE + LATE_GRACE_MINS, 0, 0);
    const status = now > lateThreshold ? "LATE" : "PRESENT";

    // ✅ FIX: Use accuracy-aware GPS evaluation
    const ipOnPremises = isFccpcIp(ip);
    const gps = evaluateGps(gpsLat, gpsLng, gpsAccuracy);
    const onPremises = ipOnPremises || gps.onPremises;

    // Build method string
    const methods: string[] = [];
    if (process.env.NODE_ENV === "development" && process.env.SIMULATE_ON_PREMISES !== undefined) {
      methods.push(`SIM:${process.env.SIMULATE_ON_PREMISES}`);
    } else {
      if (ipOnPremises) methods.push("IP");
      if (gps.onPremises) methods.push("GPS");
    }
    const detectedMethod = locationMethod || (methods.length > 0 ? methods.join("+") : "UNVERIFIED");

    // ✅ FIX: Store distance and GPS data
    const checkIn = await prisma.checkIn.create({
      data: {
        userId,
        date: today,
        checkInAt: now,
        status,
        note: note || null,
        ipAddress: ip,
        isOnPremises: onPremises,
        gpsLat: gpsLat ?? null,
        gpsLng: gpsLng ?? null,
        locationMethod: detectedMethod,
        verificationMethod: verificationMethod || "UNVERIFIED",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "CHECK_IN",
        detail: `Checked in ${now.toLocaleTimeString("en-GB")} - ${status} - IP: ${ip || "unknown"} (${ipOnPremises ? "FCCPC" : "external"}) - GPS: ${gps.onPremises ? "within HQ" : gpsLat != null ? `outside range (${Math.round(gps.distanceMeters || 0)}m)` : "not provided"} - Premises: ${onPremises ? "ON" : "OFF"} - Method: ${detectedMethod}`,
      },
    });

    return NextResponse.json({ success: true, checkIn });
  } catch (error) {
    console.error("[CheckIn POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH - check out ────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { note, gpsLat, gpsLng, gpsAccuracy, locationMethod, verificationMethod } = body;
    const today = todayDate();
    const now   = new Date();
    const ip    = getIp(request);

    const existing = await prisma.checkIn.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });

    if (!existing)           return NextResponse.json({ error: "You have not checked in today" }, { status: 400 });
    if (existing.checkOutAt) return NextResponse.json({ error: "You have already checked out today" }, { status: 400 });

    const msWorked    = now.getTime() - existing.checkInAt.getTime();
    const hoursWorked = Math.round((msWorked / 3_600_000) * 100) / 100;

    const finalStatus =
      existing.status === "LATE"
        ? hoursWorked < 4 ? "HALF_DAY" : "LATE"
        : hoursWorked < 4 ? "HALF_DAY" : existing.status;

    // Same location check as check-in, run again right now at check-out
    const ipOnPremises = isFccpcIp(ip);
    const gps = evaluateGps(gpsLat, gpsLng, gpsAccuracy);
    const checkOutOnPremises = ipOnPremises || gps.onPremises;
    const methods: string[] = [];
    if (ipOnPremises) methods.push("IP");
    if (gps.onPremises) methods.push("GPS");
    const detectedMethod = locationMethod || (methods.length > 0 ? methods.join("+") : "UNVERIFIED");

    const checkIn = await prisma.checkIn.update({
      where: { id: existing.id },
      data: {
        checkOutAt: now,
        hoursWorked,
        status: finalStatus,
        checkOutIsOnPremises: checkOutOnPremises,
        checkOutGpsLat: gpsLat ?? null,
        checkOutGpsLng: gpsLng ?? null,
        checkOutLocationMethod: detectedMethod,
        ...(note ? { note } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CHECK_OUT",
        detail: `Checked out ${now.toLocaleTimeString("en-GB")} - ${hoursWorked}h - ${finalStatus} - Location: ${checkOutOnPremises ? "on-premises" : "outside"} (${detectedMethod})`,
      },
    });

    return NextResponse.json({ success: true, checkIn });
  } catch (error) {
    console.error("[CheckIn PATCH]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
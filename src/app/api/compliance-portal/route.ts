import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

// ── GET — fetch portal data ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const staff = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isPrivileged = ["ADMIN", "HR", "DIRECTOR", "EXECUTIVE"].includes(staff.role);
    if (!isPrivileged)
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const view       = searchParams.get("view")   || "dashboard";
    const businessId = searchParams.get("bizId")  || null;
    const search     = searchParams.get("search") || null;
    const status     = searchParams.get("status") || null;

    // ── Dashboard summary ─────────────────────────────────────────────
    if (view === "dashboard") {
      const [
        totalBiz,
        activeBiz,
        pendingVerification,
        totalRevenue,
        pendingPayments,
        overdueReports,
        unpaidFines,
        recentRegistrations,
        recentPayments,
        revenueBySector,
      ] = await Promise.all([
        prisma.registeredBusiness.count(),
        prisma.registeredBusiness.count({ where: { status: "ACTIVE" } }),
        prisma.registeredBusiness.count({ where: { status: "PENDING_VERIFICATION" } }),
        prisma.bizPayment.aggregate({
          where: { status: "CONFIRMED" },
          _sum:  { amount: true },
        }),
        prisma.bizPayment.aggregate({
          where: { status: "PENDING" },
          _sum:  { amount: true },
        }),
        prisma.complianceReport.count({ where: { status: "OVERDUE" } }),
        prisma.complianceFine.aggregate({
          where: { status: { in: ["UNPAID", "PARTIAL"] } },
          _sum:  { amount: true },
        }),
        prisma.registeredBusiness.findMany({
          take:    5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, businessName: true, sector: true,
            status: true, feePaid: true, createdAt: true,
          },
        }),
        prisma.bizPayment.findMany({
          take:    5,
          orderBy: { createdAt: "desc" },
          where:   { status: "CONFIRMED" },
          select: {
            id: true, amount: true, type: true, reference: true, createdAt: true,
            business: { select: { businessName: true } },
          },
        }),
        // Revenue by sector
        prisma.registeredBusiness.groupBy({
          by:      ["sector"],
          _count:  { id: true },
        }),
      ]);

      return NextResponse.json({
        dashboard: {
          totalBiz,
          activeBiz,
          pendingVerification,
          totalRevenue:    totalRevenue._sum.amount    || 0,
          pendingPayments: pendingPayments._sum.amount || 0,
          overdueReports,
          unpaidFines:     unpaidFines._sum.amount     || 0,
          recentRegistrations,
          recentPayments,
          revenueBySector,
        },
      });
    }

    // ── Business list ─────────────────────────────────────────────────
    if (view === "businesses") {
      const businesses = await prisma.registeredBusiness.findMany({
        where: {
          ...(search ? {
            OR: [
              { businessName: { contains: search, mode: "insensitive" } },
              { rcNumber:     { contains: search, mode: "insensitive" } },
              { email:        { contains: search, mode: "insensitive" } },
              { sector:       { contains: search, mode: "insensitive" } },
            ],
          } : {}),
          ...(status ? { status: status as any } : {}),
        },
        include: {
          _count: {
            select: {
              complianceReports: true,
              fines:             true,
              payments:          true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ businesses });
    }

    // ── Single business detail ────────────────────────────────────────
    if (view === "detail" && businessId) {
      const business = await prisma.registeredBusiness.findUnique({
        where:   { id: businessId },
        include: {
          complianceReports: { orderBy: { createdAt: "desc" } },
          fines:             { orderBy: { createdAt: "desc" } },
          payments:          { orderBy: { createdAt: "desc" } },
          auditLogs:         { orderBy: { createdAt: "desc" }, take: 20 },
        },
      });

      if (!business)
        return NextResponse.json({ error: "Business not found" }, { status: 404 });

      return NextResponse.json({ business });
    }

    // ── Fines list ────────────────────────────────────────────────────
    if (view === "fines") {
      const fines = await prisma.complianceFine.findMany({
        where:   { ...(status ? { status: status as any } : {}) },
        include: { business: { select: { businessName: true, sector: true } } },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ fines });
    }

    // ── Payments list ─────────────────────────────────────────────────
    if (view === "payments") {
      const payments = await prisma.bizPayment.findMany({
        where:   { ...(status ? { status: status as any } : {}) },
        include: { business: { select: { businessName: true } } },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ payments });
    }

    return NextResponse.json({ error: "Invalid view" }, { status: 400 });
  } catch (error) {
    console.error("[Compliance Portal GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST — register business / issue fine / confirm payment ──────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const staff = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { action } = body;

    // ── Register a new business ───────────────────────────────────────
    if (action === "register_business") {
      const isPrivileged = ["ADMIN", "HR", "EXECUTIVE"].includes(staff.role);
      if (!isPrivileged)
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

      const {
        businessName, rcNumber, tin, sector, email, phone,
        address, state, contactPerson, contactRole, password,
        registrationFee,
      } = body;

      if (!businessName || !rcNumber || !sector || !email || !phone || !address || !contactPerson || !password)
        return NextResponse.json({ error: "All required fields must be filled" }, { status: 400 });

      const exists = await prisma.registeredBusiness.findUnique({ where: { email } });
      if (exists)
        return NextResponse.json({ error: "A business with this email already exists" }, { status: 400 });

      const rcExists = await prisma.registeredBusiness.findUnique({ where: { rcNumber } });
      if (rcExists)
        return NextResponse.json({ error: "RC number already registered" }, { status: 400 });

      const hashed = await bcrypt.hash(password, 10);

      const business = await prisma.registeredBusiness.create({
        data: {
          businessName, rcNumber,
          tin:           tin || null,
          sector, email, phone, address, state,
          contactPerson, contactRole,
          password:      hashed,
          registrationFee: registrationFee || 50000,
          status:        "PENDING_VERIFICATION",
        },
      });

      // Auto-create registration fee payment record
      await prisma.bizPayment.create({
        data: {
          businessId: business.id,
          amount:     business.registrationFee,
          type:       "REGISTRATION_FEE",
          reference:  `REG-${business.id.slice(-8).toUpperCase()}-${Date.now()}`,
          status:     "PENDING",
        },
      });

      await prisma.bizAuditLog.create({
        data: {
          businessId: business.id,
          action:     "REGISTERED",
          detail:     `Registered by ${staff.name}`,
          doneById:   staff.id,
        },
      });

      return NextResponse.json({ success: true, business }, { status: 201 });
    }

    // ── Issue a fine ──────────────────────────────────────────────────
    if (action === "issue_fine") {
      if (!["ADMIN", "DIRECTOR", "EXECUTIVE"].includes(staff.role))
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

      const { businessId, reason, amount, dueDate, notes } = body;
      if (!businessId || !reason || !amount || !dueDate)
        return NextResponse.json({ error: "Business, reason, amount, and due date required" }, { status: 400 });

      const fine = await prisma.complianceFine.create({
        data: {
          businessId,
          reason,
          amount:    parseFloat(amount),
          dueDate:   new Date(dueDate),
          issuedById: staff.id,
          notes:     notes || null,
          status:    "UNPAID",
        },
      });

      // Create payment record for the fine
      await prisma.bizPayment.create({
        data: {
          businessId,
          fineId:    fine.id,
          amount:    fine.amount,
          type:      "FINE_PAYMENT",
          reference: `FINE-${fine.id.slice(-8).toUpperCase()}-${Date.now()}`,
          status:    "PENDING",
        },
      });

      await prisma.bizAuditLog.create({
        data: {
          businessId,
          action:   "FINE_ISSUED",
          detail:   `Fine of ₦${amount.toLocaleString()} issued by ${staff.name}: ${reason}`,
          doneById: staff.id,
        },
      });

      return NextResponse.json({ success: true, fine });
    }

    // ── Confirm a payment ─────────────────────────────────────────────
    if (action === "confirm_payment") {
      if (!["ADMIN", "HR", "EXECUTIVE"].includes(staff.role))
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

      const { paymentId, notes } = body;
      if (!paymentId)
        return NextResponse.json({ error: "paymentId required" }, { status: 400 });

      const payment = await prisma.bizPayment.update({
        where: { id: paymentId },
        data:  {
          status:        "CONFIRMED",
          confirmedAt:   new Date(),
          confirmedById: staff.id,
          notes:         notes || null,
        },
        include: { business: true, fine: true },
      });

      // If registration fee — activate the business
      if (payment.type === "REGISTRATION_FEE") {
        await prisma.registeredBusiness.update({
          where: { id: payment.businessId },
          data:  { feePaid: true, status: "ACTIVE", verifiedAt: new Date(), verifiedById: staff.id },
        });
      }

      // If fine payment — mark fine as paid
      if (payment.fineId) {
        await prisma.complianceFine.update({
          where: { id: payment.fineId },
          data:  { paid: true, paidAt: new Date(), status: "PAID", paidReference: payment.reference },
        });
      }

      await prisma.bizAuditLog.create({
        data: {
          businessId: payment.businessId,
          action:     "PAYMENT_CONFIRMED",
          detail:     `Payment of ₦${payment.amount.toLocaleString()} confirmed by ${staff.name}`,
          doneById:   staff.id,
        },
      });

      return NextResponse.json({ success: true, payment });
    }

    // ── Verify / suspend / revoke business ────────────────────────────
    if (action === "update_status") {
      if (!["ADMIN", "EXECUTIVE"].includes(staff.role))
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

      const { businessId, status: newStatus, notes } = body;
      if (!businessId || !newStatus)
        return NextResponse.json({ error: "businessId and status required" }, { status: 400 });

      const business = await prisma.registeredBusiness.update({
        where: { id: businessId },
        data:  {
          status: newStatus,
          ...(newStatus === "ACTIVE" ? { verifiedAt: new Date(), verifiedById: staff.id } : {}),
          ...(notes ? { notes } : {}),
        },
      });

      await prisma.bizAuditLog.create({
        data: {
          businessId,
          action:   `STATUS_${newStatus}`,
          detail:   `Status changed to ${newStatus} by ${staff.name}${notes ? `: ${notes}` : ""}`,
          doneById: staff.id,
        },
      });

      return NextResponse.json({ success: true, business });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[Compliance Portal POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

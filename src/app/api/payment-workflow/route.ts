// src/app/api/payment-workflow/route.ts
// ─── M&A ↔ Finance Payment Confirmation Workflow ─────────────────────
//
// How it works:
// 1. M&A staff raises a Payment Confirmation Request (POST)
//    - includes case reference, expected amount, company name
// 2. Finance sees it in their queue (GET with ?role=FINANCE or ?dept=finance)
// 3. Finance confirms or rejects the payment (PATCH)
//    - actual amount, date, bank ref
// 4. M&A is automatically notified
// 5. EVC can see all pending items
// 6. M&A can then proceed to treat the file

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── Types (Prisma model — add to schema.prisma, see guide below) ─────
//
// model PaymentWorkflow {
//   id              String   @id @default(cuid())
//   caseReference   String
//   caseType        String   // "MERGER_NOTIFICATION" | "PENALTY" | "LICENCE_FEE" | etc
//   companyName     String
//   expectedAmount  Float
//   actualAmount    Float?
//   currency        String   @default("NGN")
//   notes           String?
//   status          PaymentStatus @default(PENDING_CONFIRMATION)
//   raisedById      String
//   raisedBy        User     @relation("RaisedPayments", fields: [raisedById], references: [id])
//   confirmedById   String?
//   confirmedBy     User?    @relation("ConfirmedPayments", fields: [confirmedById], references: [id])
//   bankReference   String?
//   paymentDate     DateTime?
//   financeNotes    String?
//   documentUrl     String?
//   documentName    String?
//   rejectionReason String?
//   createdAt       DateTime @default(now())
//   updatedAt       DateTime @updatedAt
// }
//
// enum PaymentStatus {
//   PENDING_CONFIRMATION
//   CONFIRMED
//   REJECTED
//   PARTIALLY_PAID
//   OVERPAID
// }
//
// Add to User model:
//   raisedPayments    PaymentWorkflow[] @relation("RaisedPayments")
//   confirmedPayments PaymentWorkflow[] @relation("ConfirmedPayments")

// ─── GET — list payment workflow items ───────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where:   { email: session.user.email },
      include: { department: { select: { name: true } } },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const view   = searchParams.get("view")   || "all";   // "raised" | "pending" | "all"
    const status = searchParams.get("status") || "";

    const where: any = {};
    if (status) where.status = status;

    // Finance sees all items needing confirmation
    // M&A sees items they raised
    // Directors / EVC see everything
    const isFinance = user.department?.name?.toLowerCase().includes("finance");
    const isMA      = user.department?.name?.toLowerCase().includes("merger") || user.department?.name?.toLowerCase().includes("acquisition");
    const isEVC     = user.role === "EXECUTIVE";
    const isAdmin   = user.role === "ADMIN";

    if (isMA && view !== "all") {
      where.raisedById = user.id;
    } else if (isFinance && view === "pending") {
      where.status = "PENDING_CONFIRMATION";
    } else if (!isEVC && !isAdmin && !isFinance) {
      // Other roles only see what they raised
      where.raisedById = user.id;
    }

    const items = await (prisma as any).paymentWorkflow.findMany({
      where,
      include: {
        raisedBy:    { select: { name: true, role: true, department: { select: { name: true } } } },
        confirmedBy: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Summary stats
    const allItems = await (prisma as any).paymentWorkflow.findMany({ select: { status: true, expectedAmount: true, actualAmount: true } });
    const stats = {
      total:              allItems.length,
      pendingConfirmation: allItems.filter((i: any) => i.status === "PENDING_CONFIRMATION").length,
      confirmed:          allItems.filter((i: any) => i.status === "CONFIRMED").length,
      rejected:           allItems.filter((i: any) => i.status === "REJECTED").length,
      totalExpected:      allItems.reduce((s: number, i: any) => s + (i.expectedAmount || 0), 0),
      totalConfirmed:     allItems.filter((i: any) => i.status === "CONFIRMED").reduce((s: number, i: any) => s + (i.actualAmount || 0), 0),
    };

    return NextResponse.json({ items, stats, userDept: user.department?.name });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── POST — raise a payment confirmation request ──────────────────────
// Called by M&A (or any dept) when they need Finance to confirm payment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where:   { email: session.user.email },
      include: { department: { select: { name: true } } },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Only DIRECTOR, SUPERVISOR, STAFF, HR, ADMIN, EXECUTIVE can raise
    const allowed = ["DIRECTOR","SUPERVISOR","STAFF","HR","ADMIN","EXECUTIVE"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ error: "Not authorised to raise payment requests" }, { status: 403 });
    }

    const body = await request.json();
    const {
      caseReference, caseType, companyName,
      expectedAmount, notes, documentUrl, documentName,
    } = body;

    if (!caseReference?.trim() || !companyName?.trim() || !expectedAmount || !caseType) {
      return NextResponse.json({ error: "Case reference, company name, case type and expected amount are required" }, { status: 400 });
    }
    if (isNaN(Number(expectedAmount)) || Number(expectedAmount) <= 0) {
      return NextResponse.json({ error: "Expected amount must be a positive number" }, { status: 400 });
    }

    const item = await (prisma as any).paymentWorkflow.create({
      data: {
        caseReference:  caseReference.trim(),
        caseType,
        companyName:    companyName.trim(),
        expectedAmount: Number(expectedAmount),
        notes:          notes?.trim() || null,
        raisedById:     user.id,
        status:         "PENDING_CONFIRMATION",
        documentUrl:    documentUrl || null,
        documentName:   documentName || null,
      },
    });

    // Notify Finance dept staff
    const financeStaff = await prisma.user.findMany({
      where: {
        isActive: true,
        department: { name: { contains: "Finance", mode: "insensitive" } },
      },
      select: { id: true },
    });

    if (financeStaff.length > 0) {
      await prisma.notification.createMany({
        data: financeStaff.map((f) => ({
          userId:  f.id,
          title:   `Payment Confirmation Required — ${caseReference}`,
          message: `${user.name} (${user.department?.name || user.role}) has raised a payment confirmation request for ${companyName}. Expected: ₦${Number(expectedAmount).toLocaleString()}. Case ref: ${caseReference}.`,
          type:    "ALERT" as any,
          link:    "/payment-workflow",
        })),
      });
    }

    // Also notify Directors of Finance
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PAYMENT_REQUEST_RAISED",
        detail: `Payment confirmation request raised for ${companyName} (${caseReference}) — ₦${Number(expectedAmount).toLocaleString()}`,
      },
    });

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error) {
    console.error("Payment workflow POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── PATCH — Finance confirms or rejects payment ──────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where:   { email: session.user.email },
      include: { department: { select: { name: true } } },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Only Finance staff, Directors, Admin or EVC can confirm/reject
    const isFinance = user.department?.name?.toLowerCase().includes("finance");
    const canConfirm = isFinance || user.role === "EXECUTIVE" || user.role === "ADMIN" || user.role === "DIRECTOR";
    if (!canConfirm) {
      return NextResponse.json({ error: "Only Finance staff can confirm or reject payments" }, { status: 403 });
    }

    const body = await request.json();
    const { itemId, action, actualAmount, bankReference, paymentDate, financeNotes, rejectionReason } = body;

    if (!itemId || !action) {
      return NextResponse.json({ error: "itemId and action are required" }, { status: 400 });
    }
    if (!["confirm","reject","partial"].includes(action)) {
      return NextResponse.json({ error: "Action must be confirm, reject or partial" }, { status: 400 });
    }

    const item = await (prisma as any).paymentWorkflow.findUnique({
      where:   { id: itemId },
      include: { raisedBy: { select: { id: true, name: true } } },
    });
    if (!item) return NextResponse.json({ error: "Payment request not found" }, { status: 404 });

    const newStatus =
      action === "confirm"  ? "CONFIRMED"    :
      action === "reject"   ? "REJECTED"     :
      "PARTIALLY_PAID";

    const updated = await (prisma as any).paymentWorkflow.update({
      where: { id: itemId },
      data: {
        status:          newStatus,
        confirmedById:   user.id,
        actualAmount:    actualAmount   ? Number(actualAmount)    : null,
        bankReference:   bankReference  || null,
        paymentDate:     paymentDate    ? new Date(paymentDate)   : null,
        financeNotes:    financeNotes   || null,
        rejectionReason: rejectionReason || null,
      },
    });

    // Notify the person who raised the request
    const notifMessage =
      action === "confirm"
        ? `Finance has confirmed payment for your case "${item.caseReference}" (${item.companyName}). Amount: ₦${Number(actualAmount || item.expectedAmount).toLocaleString()}. You may now proceed.`
        : action === "reject"
        ? `Finance has rejected the payment confirmation for "${item.caseReference}" (${item.companyName}). Reason: ${rejectionReason || "Not specified"}.`
        : `Finance has recorded a partial payment for "${item.caseReference}" (${item.companyName}). Amount received: ₦${Number(actualAmount).toLocaleString()} of ₦${Number(item.expectedAmount).toLocaleString()} expected.`;

    await prisma.notification.create({
      data: {
        userId:  item.raisedBy.id,
        title:   `Payment ${action === "confirm" ? "Confirmed ✓" : action === "reject" ? "Rejected ✗" : "Partial ⚠️"} — ${item.caseReference}`,
        message: notifMessage,
        type:    action === "confirm" ? "SUCCESS" : action === "reject" ? "ALERT" : ("WARNING" as any),
        link:    "/payment-workflow",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: `PAYMENT_${newStatus}`,
        detail: `Finance ${action}ed payment for ${item.companyName} (${item.caseReference})${actualAmount ? ` — actual: ₦${Number(actualAmount).toLocaleString()}` : ""}`,
      },
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Payment workflow PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
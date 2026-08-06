// src/app/api/case-transfer/route.ts
// ─── Zone-to-Zone / Zone-to-HQ / Interstate Case Transfer ────────────
//
// Prisma schema to add (after PaymentWorkflow):
//
// model CaseTransfer {
//   id              String         @id @default(cuid())
//   caseRef         String
//   caseTitle       String
//   caseType        String
//   description     String
//   fromOffice      String         // e.g. "Lagos Zone", "HQ", "Kano Zone"
//   toOffice        String
//   transferType    TransferType
//   priority        Priority       @default(MEDIUM)
//   status          TransferStatus @default(PENDING_ACCEPTANCE)
//   transferNote    String
//   attachmentUrl   String?
//   attachmentName  String?
//   initiatedById   String
//   initiatedBy     User           @relation("InitiatedTransfers", fields: [initiatedById], references: [id])
//   acceptedById    String?
//   acceptedBy      User?          @relation("AcceptedTransfers", fields: [acceptedById], references: [id])
//   rejectedReason  String?
//   completedNote   String?
//   targetUserId    String?        // specific person at the receiving office (optional)
//   targetUser      User?          @relation("TargetTransfers", fields: [targetUserId], references: [id])
//   dueDate         DateTime?
//   acceptedAt      DateTime?
//   completedAt     DateTime?
//   createdAt       DateTime       @default(now())
//   updatedAt       DateTime       @updatedAt
// }
//
// enum TransferType {
//   ZONE_TO_ZONE
//   ZONE_TO_HQ
//   HQ_TO_ZONE
//   INTERSTATE
//   INTER_DEPARTMENTAL
// }
//
// enum TransferStatus {
//   PENDING_ACCEPTANCE
//   ACCEPTED
//   IN_PROGRESS
//   COMPLETED
//   REJECTED
//   RECALLED
// }
//
// Add to User model:
//   initiatedTransfers CaseTransfer[] @relation("InitiatedTransfers")
//   acceptedTransfers  CaseTransfer[] @relation("AcceptedTransfers")
//   targetTransfers    CaseTransfer[] @relation("TargetTransfers")
//
// Run: npx prisma migrate dev --name add_case_transfer

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const OFFICES = [
  "HQ — Abuja",
  "Lagos Zone",
  "Kano Zone",
  "Port Harcourt Zone",
  "Enugu Zone",
  "Ibadan Zone",
  "Maiduguri Zone",
  "Ilorin",
  "Asaba",
  "Uyo",
  "Jos",
  "Sokoto",
  "Benin",
  "Owerri",
  "Abeokuta",
];

// ─── GET — list case transfers ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const view   = searchParams.get("view") || "all"; // "sent" | "received" | "all"
    const status = searchParams.get("status") || "";

    const where: any = {};
    if (status) where.status = status;

    // Regular staff see what they sent or are targeted to receive
    // Directors / Admin / EVC see everything
    const canSeeAll = ["DIRECTOR","ADMIN","EXECUTIVE"].includes(user.role);
    if (!canSeeAll) {
      where.OR = [
        { initiatedById: user.id },
        { targetUserId:  user.id },
      ];
    }
    if (view === "sent")     where.initiatedById = user.id;
    if (view === "received") where.targetUserId  = user.id;

    const transfers = await (prisma as any).caseTransfer.findMany({
      where,
      include: {
        initiatedBy: { select: { id: true, name: true, role: true, jobTitle: true, department: { select: { name: true } } } },
        acceptedBy:  { select: { id: true, name: true, role: true } },
        targetUser:  { select: { id: true, name: true, role: true, jobTitle: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const stats = {
      total:             transfers.length,
      pendingAcceptance: transfers.filter((t: any) => t.status === "PENDING_ACCEPTANCE").length,
      inProgress:        transfers.filter((t: any) => t.status === "IN_PROGRESS").length,
      completed:         transfers.filter((t: any) => t.status === "COMPLETED").length,
    };

    return NextResponse.json({ transfers, stats, offices: OFFICES });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── POST — initiate a case transfer ──────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where:   { email: session.user.email },
      include: { department: { select: { name: true } } },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const {
      caseRef, caseTitle, caseType, description,
      fromOffice, toOffice, transferType,
      priority, transferNote, targetUserId,
      attachmentUrl, attachmentName, dueDate,
    } = body;

    if (!caseRef || !caseTitle || !fromOffice || !toOffice || !transferNote) {
      return NextResponse.json(
        { error: "Case ref, title, from/to office and transfer note are required" },
        { status: 400 }
      );
    }

    const transfer = await (prisma as any).caseTransfer.create({
      data: {
        caseRef:       caseRef.trim(),
        caseTitle:     caseTitle.trim(),
        caseType:      caseType || "General",
        description:   description?.trim() || "",
        fromOffice:    fromOffice.trim(),
        toOffice:      toOffice.trim(),
        transferType:  transferType || "INTER_DEPARTMENTAL",
        priority:      priority     || "MEDIUM",
        transferNote:  transferNote.trim(),
        status:        "PENDING_ACCEPTANCE",
        initiatedById: user.id,
        targetUserId:  targetUserId || null,
        attachmentUrl:  attachmentUrl  || null,
        attachmentName: attachmentName || null,
        dueDate:       dueDate ? new Date(dueDate) : null,
      },
    });

    // Notify the target user if specified
    if (targetUserId) {
      await prisma.notification.create({
        data: {
          userId:  targetUserId,
          title:   `Case Transfer — ${caseRef}`,
          message: `${user.name} has transferred case "${caseTitle}" from ${fromOffice} to you (${toOffice}). Note: ${transferNote.slice(0, 100)}`,
          type:    "ALERT" as any,
          link:    "/case-transfer",
        },
      });
    }

    // Notify Directors and Admins
    const directors = await prisma.user.findMany({
      where: { role: { in: ["DIRECTOR", "ADMIN", "EXECUTIVE"] }, isActive: true, id: { not: user.id } },
      select: { id: true },
      take: 10,
    });
    if (directors.length > 0) {
      await prisma.notification.createMany({
        data: directors.map((d) => ({
          userId:  d.id,
          title:   `Case Transfer Initiated — ${caseRef}`,
          message: `${user.name} transferred case "${caseTitle}" from ${fromOffice} to ${toOffice}.`,
          type:    "INFO" as any,
          link:    "/case-transfer",
        })),
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CASE_TRANSFER_INITIATED",
        detail: `Case ${caseRef} "${caseTitle}" transferred from ${fromOffice} to ${toOffice}`,
      },
    });

    return NextResponse.json({ success: true, transfer }, { status: 201 });
  } catch (error) {
    console.error("Case transfer POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── PATCH — accept / reject / update transfer status ─────────────────
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { transferId, action, rejectedReason, completedNote } = body;

    if (!transferId || !action)
      return NextResponse.json({ error: "transferId and action required" }, { status: 400 });

    const transfer = await (prisma as any).caseTransfer.findUnique({
      where:   { id: transferId },
      include: { initiatedBy: { select: { id: true, name: true } } },
    });
    if (!transfer)
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });

    // Only target user, directors, admin or EVC can action
    const canAction = transfer.targetUserId === user.id ||
      ["DIRECTOR","ADMIN","EXECUTIVE"].includes(user.role);
    // Initiator can recall
    const canRecall = transfer.initiatedById === user.id;

    if (!canAction && !(action === "recall" && canRecall))
      return NextResponse.json({ error: "Not authorised to action this transfer" }, { status: 403 });

    const validActions = ["accept","reject","in_progress","complete","recall"];
    if (!validActions.includes(action))
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const statusMap: Record<string, string> = {
      accept:      "ACCEPTED",
      reject:      "REJECTED",
      in_progress: "IN_PROGRESS",
      complete:    "COMPLETED",
      recall:      "RECALLED",
    };

    const updateData: any = {
      status: statusMap[action],
    };
    if (action === "accept" || action === "in_progress" || action === "complete") {
      updateData.acceptedById = user.id;
      if (action === "accept") updateData.acceptedAt = new Date();
      if (action === "complete") updateData.completedAt = new Date();
    }
    if (rejectedReason) updateData.rejectedReason = rejectedReason;
    if (completedNote)  updateData.completedNote  = completedNote;

    await (prisma as any).caseTransfer.update({
      where: { id: transferId },
      data:  updateData,
    });

    // Notify the initiator about the status change
    const actionLabel =
      action === "accept"      ? "accepted your case transfer ✓"      :
      action === "reject"      ? "rejected the case transfer ✗"       :
      action === "in_progress" ? "is now treating the transferred case":
      action === "complete"    ? "has completed the transferred case ✓" :
      "has recalled the case";

    await prisma.notification.create({
      data: {
        userId:  transfer.initiatedBy.id,
        title:   `Case Transfer Update — ${transfer.caseRef}`,
        message: `${user.name} ${actionLabel}: "${transfer.caseTitle}".${completedNote ? ` Note: ${completedNote}` : ""}${rejectedReason ? ` Reason: ${rejectedReason}` : ""}`,
        type:    action === "complete" ? "SUCCESS" : action === "reject" ? "ALERT" : ("INFO" as any),
        link:    "/case-transfer",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: `CASE_TRANSFER_${statusMap[action]}`,
        detail: `Case ${transfer.caseRef} "${transfer.caseTitle}" — ${actionLabel} by ${user.name}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Case transfer PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
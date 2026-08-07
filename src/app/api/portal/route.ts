import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// ─── PUBLIC route — no session required ──────────────────────────────
// This handles business self-registration and status checks
// Route: src/app/api/portal/route.ts

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rc = searchParams.get("rc");

    if (!rc) {
      return NextResponse.json({ error: "RC number required" }, { status: 400 });
    }

    const business = await prisma.registeredBusiness.findUnique({
      where:  { rcNumber: rc.trim().toUpperCase() },
      select: {
        id: true, businessName: true, rcNumber: true,
        sector: true, status: true, feePaid: true,
        registrationFee: true, createdAt: true,
        verifiedAt: true, contactPerson: true,
        complianceScore: true,
        payments: {
          select: { amount: true, type: true, status: true, reference: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        complianceReports: {
          select: { title: true, status: true, reportType: true, submittedAt: true },
          orderBy: { submittedAt: "desc" },
          take: 3,
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "No business found with that RC number" }, { status: 404 });
    }

    return NextResponse.json({ business });
  } catch (error) {
    console.error("[Portal GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // ── Self-registration by a business ──────────────────────────────
    if (action === "register_business") {
      const {
        businessName, rcNumber, tin, sector, email, phone,
        address, state, contactPerson, contactRole, password,
      } = body;

      // Validate required fields
      const missing = [];
      if (!businessName?.trim()) missing.push("Business name");
      if (!rcNumber?.trim())     missing.push("RC number");
      if (!sector)               missing.push("Sector");
      if (!email?.trim())        missing.push("Email");
      if (!phone?.trim())        missing.push("Phone");
      if (!address?.trim())      missing.push("Address");
      if (!state?.trim())        missing.push("State");
      if (!contactPerson?.trim()) missing.push("Contact person");
      if (!contactRole?.trim())  missing.push("Contact role");
      if (!password)             missing.push("Password");

      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Missing required fields: ${missing.join(", ")}` },
          { status: 400 }
        );
      }

      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }

      // Check duplicates
      const emailExists = await prisma.registeredBusiness.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (emailExists) {
        return NextResponse.json({ error: "A business with this email is already registered" }, { status: 400 });
      }

      const rcExists = await prisma.registeredBusiness.findUnique({ where: { rcNumber: rcNumber.trim().toUpperCase() } });
      if (rcExists) {
        return NextResponse.json({ error: "This RC number is already registered" }, { status: 400 });
      }

      const hashed = await bcrypt.hash(password, 10);

      const business = await prisma.registeredBusiness.create({
        data: {
          businessName:   businessName.trim(),
          rcNumber:       rcNumber.trim().toUpperCase(),
          tin:            tin?.trim() || null,
          sector,
          email:          email.trim().toLowerCase(),
          phone:          phone.trim(),
          address:        address.trim(),
          state:          state.trim(),
          contactPerson:  contactPerson.trim(),
          contactRole:    contactRole.trim(),
          password:       hashed,
          registrationFee: 50000,
          status:         "PENDING_VERIFICATION",
        },
      });

      // Generate registration fee payment record
      const reference = `FCCPC-REG-${business.id.slice(-8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

      const payment = await prisma.bizPayment.create({
        data: {
          businessId: business.id,
          amount:     50000,
          type:       "REGISTRATION_FEE",
          reference,
          status:     "PENDING",
        },
      });

      await prisma.bizAuditLog.create({
        data: {
          businessId: business.id,
          action:     "SELF_REGISTERED",
          detail:     `Self-registered via public portal`,
        },
      });

      return NextResponse.json({
        success: true,
        businessName: business.businessName,
        rcNumber:     business.rcNumber,
        reference:    payment.reference,
        amount:       payment.amount,
        paymentInstructions: {
          bankName:      "Central Bank of Nigeria",
          accountName:   "FCCPC Revenue Account",
          accountNumber: "0123456789",
          amount:        50000,
          reference:     payment.reference,
          note:          `After payment, email receipt to compliance@fccpc.gov.ng with subject: ${payment.reference}`,
        },
      }, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[Portal POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

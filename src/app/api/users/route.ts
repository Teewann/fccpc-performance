import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { Role } from "@prisma/client";

async function generateUserIdRef(): Promise<string> {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const LEN = 7;
  const MAX_ATTEMPTS = 30;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let code = "U";
    for (let i = 0; i < LEN; i++) {
      code += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    const existing = await prisma.user.findUnique({ where: { userIdRef: code } });
    if (!existing) return code;
  }
  return `U${Date.now().toString(36).toUpperCase().slice(-7)}`;
}

async function sendPasswordResetEmail(toEmail: string, toName: string, adminName: string) {
  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST   || "smtp.gmail.com",
      port:   Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to:      toEmail,
      subject: "Your FCCPC portal password has been reset",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#f1f5f9;border-radius:16px;overflow:hidden;">
          <div style="background:#052e16;border-bottom:1px solid #14532d;padding:28px 32px;">
            <div style="font-size:22px;font-weight:700;color:#4ade80;">FCCPC</div>
            <div style="font-size:13px;color:#86efac;margin-top:4px;">Performance Intelligence System</div>
          </div>
          <div style="padding:32px;">
            <h2 style="font-size:20px;font-weight:600;color:#f1f5f9;margin:0 0 16px;">Password Reset Notification</h2>
            <p style="color:#94a3b8;line-height:1.6;margin:0 0 20px;">
              Dear <strong style="color:#f1f5f9;">${toName}</strong>,<br><br>
              Your FCCPC portal password has been reset by <strong style="color:#4ade80;">${adminName}</strong> (System Administrator).
            </p>
            <div style="background:#1c1107;border:1px solid #78350f;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <div style="color:#f59e0b;font-weight:600;font-size:14px;">⚠ Action required</div>
              <div style="color:#fcd34d;font-size:13px;margin-top:6px;line-height:1.5;">
                Please log in immediately and change your password to something only you know.
                If you did not expect this change, contact your system administrator immediately.
              </div>
            </div>
            <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login"
               style="display:inline-block;padding:13px 28px;background:#052e16;border:1.5px solid #22c55e;border-radius:10px;color:#4ade80;font-weight:600;font-size:14px;text-decoration:none;">
              Log in to FCCPC Portal →
            </a>
            <p style="color:#475569;font-size:12px;margin-top:28px;line-height:1.5;">
              This is an automated message from the FCCPC Performance Intelligence System.<br>
              Do not reply to this email. Contact IT support if you have questions.
            </p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("[Email send error]", err);
    return false;
  }
}

// ─── GET - list users (with department filtering for Directors) ─────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // ✅ Use session data directly — no DB round trip needed
    const currentUser = {
      id: (session.user as any).id as string,
      role: (session.user as any).role as string,
      departmentId: (session.user as any).departmentId as string | null,
    };

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const isActive = searchParams.get("isActive") === "true";
    const departmentId = searchParams.get("deptId") || null;
    const directory = searchParams.get("directory") === "true";
    
    // ✅ NEW: Check for supervisedBy param
    const supervisedBy = searchParams.get("supervisedBy");

    // ✅ PAGINATION
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { staffId: { contains: search, mode: "insensitive" } },
        { jobTitle: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role) where.role = role as Role;
    if (isActive) where.isActive = true;
    if (departmentId) where.departmentId = departmentId;

    // ✅ NEW: Modified Permission filtering with supervisedBy
    // ✅ CORRECTED: Permissions with supervisedBy
if (currentUser.role === "ADMIN" || currentUser.role === "EXECUTIVE") {
  // Admins and Executives see all — search param narrows further if sent
} else if (currentUser.role === "DIRECTOR") {
  if (!currentUser.departmentId) {
    return NextResponse.json({ error: "Director not assigned to a department" }, { status: 400 });
  }
  where.departmentId = currentUser.departmentId;
} else if (supervisedBy === "me") {
  // Plain supervisors only see their designated direct reports
  where.supervisorId = currentUser.id;
} else {
  where.id = currentUser.id;
}

    // ✅ Everything independent — fire all 4 queries at the same time
    const [users, total, departments, units] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, role: true, jobTitle: true,
          staffId: true, isActive: true, createdAt: true, phone: true,
          userIdRef: true,
          photo: true,
          gradeLevel: true,
          supervisorId: true,   // ✅ NEW: Added supervisorId to select
          department: { select: { id: true, name: true, shortCode: true } },
          unit: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.unit.findMany({ orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({
      users,
      departments,
      units,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[Users GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── POST - create user ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // ✅ Use session data directly — no DB round trip needed
    const adminId = (session.user as any).id as string;
    const adminRole = (session.user as any).role as string;
    if (adminRole !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    // ✅ NEW: Added supervisorId to destructured body
    const { name, email, password, role, staffId, departmentId, unitId, jobTitle, phone, gradeLevel, supervisorId } = body;

    if (!name?.trim() || !email?.trim() || !password || !role) {
      return NextResponse.json({ error: "Name, email, password and role are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const userIdRef = await generateUserIdRef();

    const user = await prisma.user.create({
      data: {
        name:         name.trim(),
        email:        email.toLowerCase().trim(),
        password:     hashed,
        role:         role as Role,
        jobTitle:     jobTitle?.trim() || null,
        staffId:      staffId?.trim()    || null,
        departmentId: departmentId       || null,
        unitId:       unitId             || null,
        phone:        phone?.trim()      || null,
        gradeLevel:   gradeLevel?.trim() || null,
        supervisorId: supervisorId       || null, // ✅ NEW: Added to data object
        isActive:     true,
        userIdRef,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: "USER_CREATED",
        detail: `Admin created user: ${user.name} (${user.email}) - Role: ${role}${phone ? ` - Phone: ${phone}` : ""}`,
      },
    });

    return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
  } catch (error) {
    console.error("[Users POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── PATCH - update user or reset password ────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // ✅ Use session data directly — no DB round trip needed
    const adminId = (session.user as any).id as string;
    const adminRole = (session.user as any).role as string;
    const adminName = (session.user as any).name as string;
    if (adminRole !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    // ✅ NEW: Added supervisorId to destructured body
    const { userId, name, role, staffId, departmentId, unitId, jobTitle, phone, gradeLevel, newPassword, sendResetEmail, supervisorId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: any = {};

    if (name?.trim())          updateData.name         = name.trim();
    if (role)                  updateData.role         = role as Role;
    if (staffId !== undefined) updateData.staffId      = staffId?.trim() || null;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (unitId !== undefined)  updateData.unitId       = unitId || null;
    if (jobTitle !== undefined) updateData.jobTitle    = jobTitle?.trim() || null;
    if (phone !== undefined)   updateData.phone        = phone?.trim() || null;
    if (gradeLevel !== undefined) updateData.gradeLevel = gradeLevel?.trim() || null;
    // ✅ NEW: Added supervisorId assignment
    if (supervisorId !== undefined) updateData.supervisorId = supervisorId || null;

    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    await prisma.user.update({ where: { id: userId }, data: updateData });

    let emailSent = false;
    if (newPassword && sendResetEmail) {
      emailSent = await sendPasswordResetEmail(target.email, target.name, adminName);
    }

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: newPassword ? "PASSWORD_RESET" : "USER_UPDATED",
        detail: newPassword
          ? `Admin reset password for ${target.name} (${target.email}) - Email notification: ${emailSent ? "sent" : "failed or skipped"}`
          : `Admin updated user: ${target.name} - Fields: ${Object.keys(updateData).join(", ")}`,
      },
    });

    return NextResponse.json({ success: true, emailSent });
  } catch (error) {
    console.error("[Users PATCH]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── DELETE - remove user ─────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // ✅ Use session data directly — no DB round trip needed
    const adminId = (session.user as any).id as string;
    const adminRole = (session.user as any).role as string;
    if (adminRole !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    if (id === adminId) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target)  return NextResponse.json({ error: "User not found" }, { status: 404 });

    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: "USER_DELETED",
        detail: `Admin deleted user: ${target.name} (${target.email})`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Users DELETE]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
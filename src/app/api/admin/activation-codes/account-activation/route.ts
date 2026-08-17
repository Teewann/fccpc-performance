import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!admin || !["ADMIN", "HR"].includes(admin.role))
    return NextResponse.json({ error: "Only Admin or HR can generate activation codes." }, { status: 403 });

  const { email } = await request.json();
  const staff = await prisma.user.findUnique({ where: { email } });
  if (!staff)
    return NextResponse.json({ error: "No staff account found with that email. Create the account first." }, { status: 404 });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.accountActivationCode.create({
    data: { code, email, role: staff.role, createdById: admin.id, expiresAt },
  });

  return NextResponse.json({ code, expiresAt });
}
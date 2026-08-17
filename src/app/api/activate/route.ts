import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const { email, code, newPassword } = await request.json();

  const activation = await prisma.accountActivationCode.findUnique({ where: { code } });
  if (!activation || activation.email.toLowerCase() !== email.toLowerCase())
    return NextResponse.json({ error: "Invalid code for this email." }, { status: 400 });
  if (activation.used)
    return NextResponse.json({ error: "This code has already been used. Contact IT for a new one." }, { status: 400 });
  if (activation.expiresAt < new Date())
    return NextResponse.json({ error: "This code has expired. Contact IT for a new one." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "No account found for this email." }, { status: 404 });

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  await prisma.accountActivationCode.update({ where: { id: activation.id }, data: { used: true, usedAt: new Date() } });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "ACCOUNT_ACTIVATED", detail: "Password set via activation code" },
  });

  return NextResponse.json({ success: true });
}
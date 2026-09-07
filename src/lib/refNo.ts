// src/lib/refNo.ts
// Generates unique sequential reference numbers for daily logs.
// Format: FCCPC-YYYY-XXXXXX (e.g. FCCPC-2026-000142)

import prisma from '@/lib/prisma';
export async function generateRefNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FCCPC-${year}-`;

  // Count existing logs this year to get next number
  const count = await prisma.dailyLog.count({
    where: { createdAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
  });

  const seq = String(count + 1).padStart(6, '0');
  return `${prefix}${seq}`;
}

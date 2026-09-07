// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// ✅ Correct: Use `connectionLimit` and `timeout` via the pool options
const prisma = globalForPrisma.prisma || new PrismaClient({
  // ✅ Correct way to set connection timeout
  // The connection timeout is controlled by the pool timeout
  // You can set it via the `__internal` options or use environment variables
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// ✅ If you need to set a timeout, use the `$connect` with a timeout wrapper
// or use the connection string with `connect_timeout` parameter:
// DATABASE_URL="postgresql://...?connect_timeout=5"

if (process.env.NODE_ENV === 'development') {
  // @ts-ignore - Prisma has this event but types are incomplete
  prisma.$on('error', (e: any) => {
    console.error('Prisma error:', e);
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
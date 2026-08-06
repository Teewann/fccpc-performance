import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Admin@1234", 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@fccpc.gov.ng" },
    update: { password },
    create: {
      name:     "System Administrator",
      email:    "admin@fccpc.gov.ng",
      password,
      role:     "ADMIN",
      staffId:  "FCCPC/ADM/001",
    },
  });

  console.log("Password reset complete.");
  console.log("Email:   ", user.email);
  console.log("Password: Admin@1234");
  console.log("Role:    ", user.role);
}

main().catch(console.error).finally(() => prisma.$disconnect());
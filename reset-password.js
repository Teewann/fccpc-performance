// reset-password.js
// One-time script to reset a user's password.
// Run with: node reset-password.js
// Delete this file afterwards for security.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// ⬇️ EDIT THESE TWO LINES ⬇️
const EMAIL = "admin@fccpc.gov.ng";
const NEW_PASSWORD = "Admin@1234"; // choose your own new password here

async function main() {
  const hashed = await bcrypt.hash(NEW_PASSWORD, 10);

  const user = await prisma.user.update({
    where: { email: EMAIL },
    data: { password: hashed },
  });

  console.log("✅ Password reset successfully for:", user.email);
  console.log("New password is:", NEW_PASSWORD);
}

main()
  .catch((e) => {
    console.error("❌ Error resetting password:", e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
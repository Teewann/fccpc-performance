const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Creating admin user...');

    const password = await bcrypt.hash('Admin@1234', 10);

    const admin = await prisma.user.upsert({
      where: { email: 'admin@fccpc.gov.ng' },
      update: {
        password: password,
        role: 'ADMIN',
        isActive: true,
        name: 'System Administrator',
      },
      create: {
        email: 'admin@fccpc.gov.ng',
        name: 'System Administrator',
        password: password,
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log('✅ Admin created/updated:', admin.email);
    console.log('🔑 Password: Admin@1234');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.();
  }
}

main();

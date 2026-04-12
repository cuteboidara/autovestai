/**
 * One-time script to delete and recreate the super admin user.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/reset-admin.ts
 *
 * Or on Railway:
 *   railway run npx ts-node scripts/reset-admin.ts
 */
import { PrismaClient, AdminRole, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const ADMIN_EMAIL = 'admin@autovestai.com';
const ADMIN_PASSWORD = 'AutoVest2026!';
const BCRYPT_ROUNDS = 12;

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log(`Connecting to database...`);
    await prisma.$connect();

    // Find existing admin
    const existing = await prisma.adminUser.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (existing) {
      console.log(`Found existing admin: ${existing.email} (${existing.id})`);

      // Delete shadow User first (foreign key), then AdminUser
      await prisma.$transaction(async (tx) => {
        await tx.user.deleteMany({ where: { id: existing.id } });
        await tx.adminUser.delete({ where: { id: existing.id } });
      });

      console.log(`Deleted existing admin and shadow user.`);
    } else {
      console.log(`No existing admin found with email ${ADMIN_EMAIL}.`);
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

    // Generate admin account number
    const lastAdmin = await prisma.user.findFirst({
      where: { accountNumber: { startsWith: 'ADM' } },
      orderBy: { accountNumber: 'desc' },
      select: { accountNumber: true },
    });
    const nextSeq = lastAdmin
      ? Number(lastAdmin.accountNumber.replace('ADM', '')) + 1
      : 1;
    const accountNumber = `ADM${String(nextSeq).padStart(6, '0')}`;

    // Create new admin + shadow user in a transaction
    const admin = await prisma.$transaction(async (tx) => {
      const newAdmin = await tx.adminUser.create({
        data: {
          email: ADMIN_EMAIL,
          passwordHash,
          firstName: 'System',
          lastName: 'Administrator',
          role: AdminRole.SUPER_ADMIN,
          permissions: [],
          isActive: true,
          createdById: null,
        },
      });

      await tx.user.create({
        data: {
          id: newAdmin.id,
          email: ADMIN_EMAIL,
          accountNumber,
          password: passwordHash,
          role: UserRole.ADMIN,
          isEmailVerified: true,
        },
      });

      return newAdmin;
    });

    console.log(`\nSuper admin created successfully:`);
    console.log(`  ID:       ${admin.id}`);
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Role:     ${admin.role}`);
    console.log(`  Account:  ${accountNumber}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
  } catch (error) {
    console.error('Failed to reset admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

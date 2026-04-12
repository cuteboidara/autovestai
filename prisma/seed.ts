import {
  AdminRole,
  PrismaClient,
  QuoteSource,
  SymbolCategory,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { loadContractSpecifications } from './contract-specifications';
import { getDefaultPermissionsForAdminRole } from '../src/modules/admin-users/admin-users.constants';

const prisma = new PrismaClient();
const superAdminPermissions = getDefaultPermissionsForAdminRole(AdminRole.SUPER_ADMIN);

async function generateAdminAccountNumber() {
  const latest = await prisma.user.findFirst({
    where: {
      accountNumber: {
        startsWith: 'ADM',
      },
    },
    orderBy: {
      accountNumber: 'desc',
    },
    select: {
      accountNumber: true,
    },
  });

  const latestSequence = latest?.accountNumber
    ? Number.parseInt(latest.accountNumber.replace(/^ADM/, ''), 10)
    : 0;

  return `ADM${String(latestSequence + 1).padStart(6, '0')}`;
}

function getConfiguredSuperAdminEmails() {
  const configured = new Set<string>();
  const primary =
    process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || 'admin@autovestai.com';

  configured.add(primary);

  for (const entry of process.env.BOOTSTRAP_ADMIN_EMAILS?.split(',') ?? []) {
    const normalized = entry.trim().toLowerCase();

    if (normalized) {
      configured.add(normalized);
    }
  }

  return [...configured];
}

function deriveAdminName(email: string) {
  const localPart = email.split('@')[0] ?? 'super-admin';
  const pieces = localPart
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const formatPart = (value: string) =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  return {
    firstName: formatPart(pieces[0] ?? 'Super'),
    lastName: formatPart(pieces.slice(1).join(' ') || 'Admin'),
  };
}

async function syncSuperAdminAccount(params: {
  email: string;
  passwordHash?: string;
  fallbackName?: {
    firstName: string;
    lastName: string;
  };
  createIfMissing: boolean;
}) {
  const email = params.email.trim().toLowerCase();
  const [existingAdmin, existingUserByEmail] = await Promise.all([
    prisma.adminUser.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
      },
    }),
    prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
      },
    }),
  ]);

  if (
    existingAdmin &&
    existingUserByEmail &&
    existingAdmin.id !== existingUserByEmail.id
  ) {
    throw new Error(
      `Cannot seed default super admin for ${email}: admin and shadow user records are out of sync`,
    );
  }

  if (
    !existingAdmin &&
    existingUserByEmail &&
    existingUserByEmail.role !== UserRole.ADMIN
  ) {
    await prisma.user.update({
      where: { id: existingUserByEmail.id },
      data: {
        role: UserRole.ADMIN,
      },
    });
  }

  if (!existingAdmin && !existingUserByEmail && !params.createIfMissing) {
    console.log(`Skipped configured super admin ${email}: no matching user record found`);
    return null;
  }

  const passwordHash =
    existingAdmin?.passwordHash ??
    existingUserByEmail?.password ??
    params.passwordHash;

  if (!passwordHash) {
    throw new Error(`Cannot seed configured super admin for ${email}: missing password hash`);
  }

  const derivedName = params.fallbackName ?? deriveAdminName(email);
  const seededAdmin = existingAdmin
    ? await prisma.adminUser.update({
        where: { email },
        data: {
          passwordHash,
          firstName: existingAdmin.firstName || derivedName.firstName,
          lastName: existingAdmin.lastName || derivedName.lastName,
          role: AdminRole.SUPER_ADMIN,
          permissions: superAdminPermissions,
          isActive: true,
          createdById: null,
        },
      })
    : await prisma.adminUser.create({
        data: {
          id: existingUserByEmail?.id,
          email,
          passwordHash,
          firstName: derivedName.firstName,
          lastName: derivedName.lastName,
          role: AdminRole.SUPER_ADMIN,
          permissions: superAdminPermissions,
          isActive: true,
          createdById: null,
        },
      });

  const shadowUser = await prisma.user.findUnique({
    where: { id: seededAdmin.id },
    select: {
      id: true,
      accountNumber: true,
    },
  });

  if (shadowUser) {
    await prisma.user.update({
      where: { id: shadowUser.id },
      data: {
        email,
        password: passwordHash,
        role: UserRole.ADMIN,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        id: seededAdmin.id,
        email,
        accountNumber: await generateAdminAccountNumber(),
        password: passwordHash,
        role: UserRole.ADMIN,
      },
    });
  }

  console.log(`Seeded configured super admin ${email}`);
  return seededAdmin;
}

async function seedDefaultSuperAdmin() {
  const email =
    process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || 'admin@autovestai.com';
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim() || 'changeme123';
  const passwordHash = await bcrypt.hash(password, 12);

  await syncSuperAdminAccount({
    email,
    passwordHash,
    fallbackName: {
      firstName: 'System',
      lastName: 'Administrator',
    },
    createIfMissing: true,
  });
}

async function seedLegacyBootstrapSuperAdmins() {
  const primary =
    process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || 'admin@autovestai.com';

  for (const email of getConfiguredSuperAdminEmails()) {
    if (email === primary) {
      continue;
    }

    await syncSuperAdminAccount({
      email,
      createIfMissing: false,
    });
  }
}

async function patchExistingSuperAdmins() {
  const result = await prisma.adminUser.updateMany({
    where: {
      role: AdminRole.SUPER_ADMIN,
    },
    data: {
      permissions: superAdminPermissions,
    },
  });

  console.log(`Patched ${result.count} super admin permission record(s)`);
}

async function main() {
  const specifications = await loadContractSpecifications();

  for (const specification of specifications) {
    await prisma.symbol.upsert({
      where: { symbol: specification.symbol },
      create: {
        symbol: specification.symbol,
        description: specification.description,
        category: specification.category as SymbolCategory,
        marketGroup: specification.marketGroup,
        lotSize: specification.lotSize,
        marginRetailPct: specification.marginRetailPct,
        marginProPct: specification.marginProPct,
        swapLong: specification.swapLong,
        swapShort: specification.swapShort,
        digits: specification.digits,
        minTickIncrement: specification.minTickIncrement,
        minTradeSizeLots: specification.minTradeSizeLots,
        maxTradeSizeLots: specification.maxTradeSizeLots,
        pipValue: specification.pipValue,
        tradingHours: specification.tradingHours,
        isActive: specification.isActive,
        defaultSpread: specification.defaultSpread,
        quoteSource: specification.quoteSource as QuoteSource,
        quoteSymbol: specification.quoteSymbol,
      },
      update: {
        description: specification.description,
        category: specification.category as SymbolCategory,
        marketGroup: specification.marketGroup,
        lotSize: specification.lotSize,
        marginRetailPct: specification.marginRetailPct,
        marginProPct: specification.marginProPct,
        swapLong: specification.swapLong,
        swapShort: specification.swapShort,
        digits: specification.digits,
        minTickIncrement: specification.minTickIncrement,
        minTradeSizeLots: specification.minTradeSizeLots,
        maxTradeSizeLots: specification.maxTradeSizeLots,
        pipValue: specification.pipValue,
        tradingHours: specification.tradingHours,
        isActive: specification.isActive,
        defaultSpread: specification.defaultSpread,
        quoteSource: specification.quoteSource as QuoteSource,
        quoteSymbol: specification.quoteSymbol,
      },
    });
  }

  console.log(`Seeded ${specifications.length} symbols`);
  await seedDefaultSuperAdmin();
  await seedLegacyBootstrapSuperAdmins();
  await patchExistingSuperAdmins();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

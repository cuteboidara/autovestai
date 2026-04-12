import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdminUsersService } from '../admin-users/admin-users.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly adminUsersService: AdminUsersService,
    private readonly auditService: AuditService,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.prismaService.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async getCurrentUserProfile(userId: string) {
    const adminProfile =
      await this.adminUsersService.getCurrentAdminProfile(userId);

    if (adminProfile) {
      return adminProfile;
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        accounts: {
          where: {
            status: {
              not: 'CLOSED',
            },
          },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        },
        affiliate: true,
        copyMaster: true,
        signalProvider: true,
        kycSubmission: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const primaryAccount = user.accounts[0] ?? null;

    return {
      id: user.id,
      email: user.email,
      accountNumber: user.accountNumber,
      role: user.role,
      wallet: primaryAccount
        ? {
            balance: primaryAccount.balance,
          }
        : user.wallet,
      affiliate: user.affiliate,
      copyMaster: user.copyMaster,
      signalProvider: user.signalProvider,
      kyc: user.kycSubmission ?? {
        status: 'NOT_SUBMITTED',
      },
      permissions: [],
      adminRoles: [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async createUser(data: {
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<User> {
    const normalizedEmail = data.email.toLowerCase();
    const resolvedRole = data.role ?? UserRole.USER;

    try {
      return await this.prismaService.user.create({
        data: {
          email: normalizedEmail,
          accountNumber: await this.generateClientAccountNumber(),
          password: data.password,
          role: resolvedRole,
          wallet: {
            create: {
              balance: new Prisma.Decimal(0),
              lockedMargin: new Prisma.Decimal(0),
            },
          },
          accounts: {
            create: {
              type: 'LIVE',
              name: 'Live Account #1',
              accountNo: await this.generateAccountNo(),
              balance: new Prisma.Decimal(0),
              equity: new Prisma.Decimal(0),
              currency: 'USDT',
              status: 'ACTIVE',
              isDefault: true,
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }

      throw error;
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const user = await this.findById(userId);
    const admin = await this.adminUsersService.findById(userId);
    const currentHash = admin?.passwordHash ?? user.password;
    const passwordMatches = await bcrypt.compare(dto.currentPassword, currentHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    await this.prismaService.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
        },
      });

      if (admin) {
        await tx.adminUser.update({
          where: { id: user.id },
          data: {
            passwordHash: hashedPassword,
          },
        });
      }
    });

    await this.auditService.log({
      actorUserId: user.id,
      actorRole: admin?.role.toLowerCase() ?? user.role.toLowerCase(),
      action: 'USER_PASSWORD_CHANGED',
      entityType: 'user',
      entityId: user.id,
      targetUserId: user.id,
    });

    return { success: true };
  }

  private async generateAccountNo(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const accountNo = `FF${randomBytes(3).toString('hex').toUpperCase()}`.slice(0, 8);
      const existing = await this.prismaService.account.findUnique({
        where: { accountNo },
      });

      if (!existing) {
        return accountNo;
      }
    }

    throw new ConflictException('Unable to allocate a default live account');
  }

  private async generateClientAccountNumber(): Promise<string> {
    const latest = await this.prismaService.user.findFirst({
      where: {
        accountNumber: {
          startsWith: 'AV',
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
      ? Number.parseInt(latest.accountNumber.replace(/^AV/, ''), 10)
      : 0;

    return `AV${String(latestSequence + 1).padStart(6, '0')}`;
  }
}

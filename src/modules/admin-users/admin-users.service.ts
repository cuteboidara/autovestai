import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminRole, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CrmService } from '../crm/crm.service';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import {
  ADMIN_PERMISSION_KEYS,
  getDefaultPermissionsForAdminRole,
  isSuperAdminRole,
} from './admin-users.constants';

type AdminUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  permissions: string[];
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly crmService: CrmService,
  ) {}

  async findByEmail(email: string) {
    return this.findOrProvisionAdminByEmail(email);
  }

  async findById(id: string) {
    return this.findOrProvisionAdminById(id);
  }

  async getAdminAuthorization(userId: string) {
    const admin = await this.findById(userId);

    if (!admin) {
      return null;
    }

    return {
      adminRole: admin.role,
      permissions: this.resolveStoredPermissions(admin),
      isActive: admin.isActive,
      mustChangePassword: admin.mustChangePassword,
      adminRoles: [
        {
          id: admin.id,
          name: admin.role.toLowerCase(),
        },
      ],
    };
  }

  async getCurrentAdminProfile(userId: string) {
    const admin = await this.findById(userId);

    if (!admin) {
      return null;
    }

    return this.serializeAdminAuthProfile(admin);
  }

  async markSuccessfulLogin(userId: string) {
    await this.prismaService.adminUser.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  async listAdmins(query: AdminUserListQueryDto) {
    const admins = await this.prismaService.adminUser.findMany({
      where: query.search?.trim()
        ? {
            OR: [
              {
                email: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                firstName: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : undefined,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return admins.map((admin) => this.serializeAdminSummary(admin));
  }

  async getAdminProfile(adminId: string) {
    const admin = await this.prismaService.adminUser.findUnique({
      where: { id: adminId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    return this.serializeAdminSummary(admin, true);
  }

  async createAdmin(dto: CreateAdminUserDto, createdById: string) {
    const creator = await this.getAdminUserOrThrow(createdById);
    this.assertCanManageAdmins(creator);

    const normalizedEmail = dto.email.trim().toLowerCase();
    const temporaryPassword =
      dto.temporaryPassword?.trim() || this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const permissions = getDefaultPermissionsForAdminRole(dto.role);

    const createdAdmin = await this.prismaService.$transaction(async (tx) => {
      await this.assertEmailAvailable(tx, normalizedEmail);

      const admin = await tx.adminUser.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: dto.role,
          permissions,
          mustChangePassword: true,
          createdById: creator.id,
        },
      });

      await tx.user.create({
        data: {
          id: admin.id,
          email: admin.email,
          accountNumber: await this.generateAdminAccountNumber(tx),
          password: passwordHash,
          role: UserRole.ADMIN,
        },
      });

      return admin;
    });

    const welcomeEmail = await this.crmService.sendDirectEmailToUser({
      toUserId: createdAdmin.id,
      sentById: creator.id,
      subject: 'Your AutovestAI admin account is ready',
      body: this.buildWelcomeEmail({
        firstName: createdAdmin.firstName,
        role: createdAdmin.role,
        temporaryPassword,
      }),
    });

    await this.auditService.log({
      actorUserId: creator.id,
      actorRole: this.getActorRole(creator),
      action: 'ADMIN_USER_CREATED',
      entityType: 'admin_user',
      entityId: createdAdmin.id,
      targetUserId: createdAdmin.id,
      metadataJson: {
        email: createdAdmin.email,
        role: createdAdmin.role,
        permissions,
        welcomeEmailSent: welcomeEmail.success,
      },
    });

    return {
      admin: await this.getAdminProfile(createdAdmin.id),
      temporaryPassword,
      welcomeEmailSent: welcomeEmail.success,
      welcomeEmailSkipped: Boolean(welcomeEmail.skipped),
    };
  }

  async updateAdmin(
    adminId: string,
    dto: UpdateAdminUserDto,
    currentUserId: string,
  ) {
    const currentAdmin = await this.getAdminUserOrThrow(currentUserId);
    this.assertCanManageAdmins(currentAdmin);

    const targetAdmin = await this.getAdminUserOrThrow(adminId);
    const nextRole = dto.role ?? targetAdmin.role;
    const nextIsActive = dto.isActive ?? targetAdmin.isActive;
    const nextPermissions =
      dto.permissions !== undefined
        ? this.resolvePermissions(dto.permissions)
        : isSuperAdminRole(nextRole)
          ? getDefaultPermissionsForAdminRole(AdminRole.SUPER_ADMIN)
          : dto.role !== undefined
          ? getDefaultPermissionsForAdminRole(nextRole)
          : targetAdmin.permissions;

    this.assertCanModifyTarget(currentAdmin, targetAdmin, {
      nextRole,
      nextIsActive,
    });

    const updatedAdmin = await this.prismaService.adminUser.update({
      where: { id: targetAdmin.id },
      data: {
        role: nextRole,
        permissions: nextPermissions,
        isActive: nextIsActive,
      },
    });

    await this.auditService.log({
      actorUserId: currentAdmin.id,
      actorRole: this.getActorRole(currentAdmin),
      action: 'ADMIN_USER_UPDATED',
      entityType: 'admin_user',
      entityId: updatedAdmin.id,
      targetUserId: updatedAdmin.id,
      metadataJson: {
        previousRole: targetAdmin.role,
        nextRole,
        previousPermissions: targetAdmin.permissions,
        nextPermissions,
        previousIsActive: targetAdmin.isActive,
        nextIsActive,
      },
    });

    return this.getAdminProfile(updatedAdmin.id);
  }

  async deactivateAdmin(adminId: string, currentUserId: string) {
    return this.updateAdmin(
      adminId,
      {
        isActive: false,
      },
      currentUserId,
    );
  }

  async resetPassword(adminId: string, currentUserId: string) {
    const currentAdmin = await this.getAdminUserOrThrow(currentUserId);
    this.assertCanManageAdmins(currentAdmin);

    const targetAdmin = await this.getAdminUserOrThrow(adminId);
    const currentShadowUser = await this.prismaService.user.findUnique({
      where: { id: targetAdmin.id },
      select: {
        password: true,
      },
    });

    if (!currentShadowUser) {
      throw new NotFoundException('Admin shadow user not found');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const nextPasswordHash = await bcrypt.hash(temporaryPassword, 12);

    await this.prismaService.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: targetAdmin.id },
        data: {
          passwordHash: nextPasswordHash,
          mustChangePassword: true,
        },
      });

      await tx.user.update({
        where: { id: targetAdmin.id },
        data: {
          password: nextPasswordHash,
        },
      });
    });

    const emailResult = await this.crmService.sendDirectEmailToUser({
      toUserId: targetAdmin.id,
      sentById: currentAdmin.id,
      subject: 'Your AutovestAI admin password has been reset',
      body: this.buildPasswordResetEmail({
        firstName: targetAdmin.firstName,
        temporaryPassword,
      }),
    });

    if (!emailResult.success) {
      await this.prismaService.$transaction(async (tx) => {
        await tx.adminUser.update({
          where: { id: targetAdmin.id },
          data: {
            passwordHash: targetAdmin.passwordHash,
          },
        });

        await tx.user.update({
          where: { id: targetAdmin.id },
          data: {
            password: currentShadowUser.password,
          },
        });
      });

      throw new BadRequestException(
        emailResult.error ?? 'Unable to send password reset email',
      );
    }

    await this.auditService.log({
      actorUserId: currentAdmin.id,
      actorRole: this.getActorRole(currentAdmin),
      action: 'ADMIN_USER_PASSWORD_RESET',
      entityType: 'admin_user',
      entityId: targetAdmin.id,
      targetUserId: targetAdmin.id,
    });

    return { success: true };
  }

  async changeMyPassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await this.getAdminUserOrThrow(adminId);
    const passwordMatch = await bcrypt.compare(currentPassword, admin.passwordHash);

    if (!passwordMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await this.prismaService.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: adminId },
        data: { passwordHash: newHash, mustChangePassword: false },
      });

      await tx.user.update({
        where: { id: adminId },
        data: { password: newHash },
      });
    });

    return { success: true };
  }

  private async getAdminUserOrThrow(adminId: string) {
    const admin = await this.findById(adminId);

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    return admin;
  }

  private serializeAdminAuthProfile(admin: AdminUserRecord) {
    return {
      id: admin.id,
      email: admin.email,
      role: UserRole.ADMIN,
      adminRole: admin.role,
      permissions: this.resolveStoredPermissions(admin),
      adminRoles: [
        {
          id: admin.id,
          name: admin.role.toLowerCase(),
        },
      ],
      firstName: admin.firstName,
      lastName: admin.lastName,
      isActive: admin.isActive,
      mustChangePassword: admin.mustChangePassword,
      isSeededSuperAdmin: this.isSeededSuperAdmin(admin),
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  private serializeAdminSummary(
    admin: AdminUserRecord & {
      createdBy?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      } | null;
    },
    includePermissions = false,
  ) {
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      fullName: `${admin.firstName} ${admin.lastName}`.trim(),
      role: admin.role,
      status: admin.isActive ? 'ACTIVE' : 'INACTIVE',
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt,
      createdById: admin.createdById,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
      isSeededSuperAdmin: this.isSeededSuperAdmin(admin),
      ...(includePermissions
        ? { permissions: this.resolveStoredPermissions(admin) }
        : {}),
      createdBy: admin.createdBy
        ? {
            id: admin.createdBy.id,
            email: admin.createdBy.email,
            fullName: `${admin.createdBy.firstName} ${admin.createdBy.lastName}`.trim(),
          }
        : null,
    };
  }

  private async assertEmailAvailable(
    tx: Prisma.TransactionClient,
    email: string,
  ) {
    const [existingAdmin, existingUser] = await Promise.all([
      tx.adminUser.findUnique({
        where: { email },
        select: { id: true },
      }),
      tx.user.findUnique({
        where: { email },
        select: { id: true },
      }),
    ]);

    if (existingAdmin || existingUser) {
      throw new ConflictException('Email already exists');
    }
  }

  private async generateAdminAccountNumber(tx: Prisma.TransactionClient) {
    const latest = await tx.user.findFirst({
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

  private async findOrProvisionAdminByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const admin = await this.prismaService.adminUser.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (admin) {
      return this.reconcileConfiguredSuperAdmin(admin);
    }

    if (!this.isConfiguredSuperAdminEmail(normalizedEmail)) {
      return null;
    }

    const user = await this.prismaService.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
      },
    });

    if (!user) {
      return null;
    }

    return this.provisionConfiguredSuperAdmin({
      userId: user.id,
      email: user.email,
      passwordHash: user.password,
      currentUserRole: user.role,
    });
  }

  private async findOrProvisionAdminById(userId: string) {
    const admin = await this.prismaService.adminUser.findUnique({
      where: { id: userId },
    });

    if (admin) {
      return this.reconcileConfiguredSuperAdmin(admin);
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
      },
    });

    if (!user || !this.isConfiguredSuperAdminEmail(user.email)) {
      return null;
    }

    return this.provisionConfiguredSuperAdmin({
      userId: user.id,
      email: user.email,
      passwordHash: user.password,
      currentUserRole: user.role,
    });
  }

  private async provisionConfiguredSuperAdmin(params: {
    userId: string;
    email: string;
    passwordHash: string;
    currentUserRole: UserRole;
  }) {
    const normalizedEmail = params.email.trim().toLowerCase();
    const permissions = getDefaultPermissionsForAdminRole(AdminRole.SUPER_ADMIN);
    const [firstName, ...remainingNameParts] = normalizedEmail
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const derivedFirstName = this.toNameCase(firstName ?? 'Super');
    const derivedLastName = this.toNameCase(
      remainingNameParts.join(' ') || 'Admin',
    );

    const admin = await this.prismaService.adminUser.create({
      data: {
        id: params.userId,
        email: normalizedEmail,
        passwordHash: params.passwordHash,
        firstName: derivedFirstName,
        lastName: derivedLastName,
        role: AdminRole.SUPER_ADMIN,
        permissions,
        isActive: true,
        createdById: null,
      },
    });

    if (
      params.currentUserRole !== UserRole.ADMIN ||
      normalizedEmail !== params.email
    ) {
      await this.prismaService.user.update({
        where: { id: params.userId },
        data: {
          email: normalizedEmail,
          role: UserRole.ADMIN,
        },
      });
    }

    return admin;
  }

  private async reconcileConfiguredSuperAdmin(admin: AdminUserRecord) {
    if (!this.isConfiguredSuperAdminEmail(admin.email)) {
      return admin;
    }

    const permissions = getDefaultPermissionsForAdminRole(AdminRole.SUPER_ADMIN);
    const storedPermissions = this.resolveStoredPermissions(admin);

    if (
      admin.role === AdminRole.SUPER_ADMIN &&
      admin.isActive &&
      storedPermissions.length === admin.permissions.length &&
      storedPermissions.every((permission, index) => permission === admin.permissions[index])
    ) {
      return admin;
    }

    return this.prismaService.adminUser.update({
      where: { id: admin.id },
      data: {
        role: AdminRole.SUPER_ADMIN,
        permissions,
        isActive: true,
        createdById: null,
      },
    });
  }

  private assertCanManageAdmins(admin: AdminUserRecord) {
    if (!isSuperAdminRole(admin.role)) {
      throw new ForbiddenException('Only super admins can manage admin accounts');
    }
  }

  private assertCanModifyTarget(
    currentAdmin: AdminUserRecord,
    targetAdmin: AdminUserRecord,
    params: {
      nextRole: AdminRole;
      nextIsActive: boolean;
    },
  ) {
    if (currentAdmin.id === targetAdmin.id && !params.nextIsActive) {
      throw new ForbiddenException('You cannot deactivate your own admin account');
    }

    const otherSuperAdmin =
      targetAdmin.id !== currentAdmin.id && isSuperAdminRole(targetAdmin.role);
    const isDemoting =
      isSuperAdminRole(targetAdmin.role) && params.nextRole !== AdminRole.SUPER_ADMIN;
    const isDeactivating =
      isSuperAdminRole(targetAdmin.role) && params.nextIsActive === false;

    if (
      otherSuperAdmin &&
      (isDemoting || isDeactivating) &&
      !this.isSeededSuperAdmin(currentAdmin)
    ) {
      throw new ForbiddenException(
        'Only the original seeded super admin can deactivate or demote another super admin',
      );
    }
  }

  private resolvePermissions(permissions: string[]) {
    const normalized = Array.from(
      new Set(permissions.map((permission) => permission.trim()).filter(Boolean)),
    );
    const invalid = normalized.filter(
      (permission) =>
        !ADMIN_PERMISSION_KEYS.includes(permission as (typeof ADMIN_PERMISSION_KEYS)[number]),
    );

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown permissions: ${invalid.join(', ')}`,
      );
    }

    return normalized;
  }

  private resolveStoredPermissions(
    admin: Pick<AdminUserRecord, 'role' | 'permissions'>,
  ) {
    return isSuperAdminRole(admin.role)
      ? getDefaultPermissionsForAdminRole(AdminRole.SUPER_ADMIN)
      : admin.permissions;
  }

  private generateTemporaryPassword() {
    return randomBytes(9).toString('base64url');
  }

  private buildWelcomeEmail(params: {
    firstName: string;
    role: AdminRole;
    temporaryPassword: string;
  }) {
    return [
      `<p>Hello ${params.firstName},</p>`,
      '<p>Your AutovestAI control tower account has been created.</p>',
      `<p>Role: <strong>${params.role.replace(/_/g, ' ')}</strong></p>`,
      `<p>Temporary password: <strong>${params.temporaryPassword}</strong></p>`,
      '<p>Please sign in and change your password immediately.</p>',
    ].join('');
  }

  private buildPasswordResetEmail(params: {
    firstName: string;
    temporaryPassword: string;
  }) {
    return [
      `<p>Hello ${params.firstName},</p>`,
      '<p>Your AutovestAI admin password has been reset.</p>',
      `<p>Temporary password: <strong>${params.temporaryPassword}</strong></p>`,
      '<p>Please sign in and change your password immediately.</p>',
    ].join('');
  }

  private isSeededSuperAdmin(admin: Pick<AdminUserRecord, 'email' | 'role' | 'createdById'>) {
    const configuredEmail =
      this.configService
        .get<string>('superAdmin.email')
        ?.trim()
        .toLowerCase() || 'admin@autovestai.com';

    return (
      isSuperAdminRole(admin.role) &&
      admin.createdById === null &&
      admin.email.toLowerCase() === configuredEmail
    );
  }

  private getActorRole(admin: Pick<AdminUserRecord, 'role'>) {
    return admin.role.toLowerCase();
  }

  private isConfiguredSuperAdminEmail(email: string) {
    const configuredEmails = new Set<string>([
      this.configService
        .get<string>('superAdmin.email')
        ?.trim()
        .toLowerCase() || 'admin@autovestai.com',
      ...(
        this.configService.get<string[]>('bootstrapAdminEmails') ?? []
      ).map((entry) => entry.trim().toLowerCase()),
    ]);

    return configuredEmails.has(email.trim().toLowerCase());
  }

  private toNameCase(value: string) {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}

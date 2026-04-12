import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { User } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdminUsersService } from '../admin-users/admin-users.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { AdminChatService } from '../admin-chat/admin-chat.service';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { CrmService } from '../crm/crm.service';
import { EmailService } from '../email/email.service';
import { SessionsService } from '../sessions/sessions.service';
import { SurveillanceService } from '../surveillance/surveillance.service';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly affiliatesService: AffiliatesService,
    private readonly adminChatService: AdminChatService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly sessionsService: SessionsService,
    private readonly auditService: AuditService,
    private readonly surveillanceService: SurveillanceService,
    private readonly prismaService: PrismaService,
    private readonly crmService: CrmService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (!this.brokerSettingsService.areRegistrationsEnabled()) {
      throw new ServiceUnavailableException(
        'New registrations are temporarily disabled',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.createUser({
      email: dto.email,
      password: hashedPassword,
    });
    await this.affiliatesService.registerReferralForUser(user.id, dto.referralCode);
    await this.sendVerificationEmail(user.id, user.email);
    const authResponse = await this.buildAuthResponse(user);

    await this.auditService.log({
      actorUserId: user.id,
      actorRole: user.role.toLowerCase(),
      action: 'AUTH_REGISTERED',
      entityType: 'user',
      entityId: user.id,
      targetUserId: user.id,
      metadataJson: {
        email: user.email,
      },
    });
    await this.adminChatService.postSystemAlert(
      'general',
      `New client ${user.accountNumber} (${user.email}) registered`,
    );

    return authResponse;
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const admin = await this.adminUsersService.findByEmail(normalizedEmail);

    if (admin) {
      const passwordMatches =
        admin.isActive &&
        (await bcrypt.compare(dto.password, admin.passwordHash));

      if (!passwordMatches) {
        await this.auditService.log({
          actorUserId: admin.id,
          actorRole: admin.role.toLowerCase(),
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'admin_user',
          entityId: admin.id,
          targetUserId: admin.id,
          metadataJson: {
            reason: admin.isActive ? 'invalid_password' : 'inactive_admin',
          },
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      const shadowUser = await this.usersService.findById(admin.id);
      await this.adminUsersService.markSuccessfulLogin(admin.id);
      const authResponse = await this.buildAuthResponse(shadowUser);
      await this.auditService.log({
        actorUserId: admin.id,
        actorRole: admin.role.toLowerCase(),
        action: 'AUTH_LOGIN_SUCCEEDED',
        entityType: 'user_session',
        entityId: authResponse.sessionId,
        targetUserId: admin.id,
      });

      return authResponse;
    }

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      await this.auditService.log({
        actorRole: 'anonymous',
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'auth',
        entityId: normalizedEmail,
        metadataJson: {
          reason: 'user_not_found',
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      await this.auditService.log({
        actorUserId: user.id,
        actorRole: user.role.toLowerCase(),
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        targetUserId: user.id,
        metadataJson: {
          reason: 'invalid_password',
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    const authResponse = await this.buildAuthResponse(user);
    await this.auditService.log({
      actorUserId: user.id,
      actorRole: user.role.toLowerCase(),
      action: 'AUTH_LOGIN_SUCCEEDED',
      entityType: 'user_session',
      entityId: authResponse.sessionId,
      targetUserId: user.id,
    });
    await this.surveillanceService.evaluateLogin(user.id);

    return authResponse;
  }

  async refresh(refreshToken: string) {
    const { user, session, refreshToken: nextRefreshToken } =
      await this.sessionsService.rotateSession(refreshToken);
    const adminAuthorization = await this.adminUsersService.getAdminAuthorization(
      user.id,
    );

    if (adminAuthorization && !adminAuthorization.isActive) {
      throw new UnauthorizedException('Admin account is inactive');
    }

    const authUser = await this.usersService.getCurrentUserProfile(user.id);
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      sessionId: session.id,
      user: authUser,
    };
  }

  async logout(user: AuthenticatedUser) {
    if (!user.sessionId) {
      throw new UnauthorizedException('Missing active session');
    }

    await this.sessionsService.logoutCurrentSession(user.id, user.sessionId);
    await this.auditService.log({
      actorUserId: user.id,
      actorRole: user.adminRole?.toLowerCase() ?? user.role.toLowerCase(),
      action: 'AUTH_LOGOUT',
      entityType: 'user_session',
      entityId: user.sessionId,
      targetUserId: user.id,
    });

    return { success: true };
  }

  async logoutAll(user: AuthenticatedUser) {
    await this.sessionsService.logoutAllSessions(user.id, user.sessionId);
    await this.auditService.log({
      actorUserId: user.id,
      actorRole: user.adminRole?.toLowerCase() ?? user.role.toLowerCase(),
      action: 'AUTH_LOGOUT_ALL',
      entityType: 'user',
      entityId: user.id,
      targetUserId: user.id,
    });

    return { success: true };
  }

  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      // Return silently - do not reveal if email exists
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prismaService.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const frontendUrl = this.configService.get<string>('app.frontendUrl') ?? '';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await this.emailService.sendPasswordReset(user.id, resetLink);
    } catch {
      // Email failure is non-fatal
    }

    try {
      await this.crmService.sendDirectEmailToUser({
        toUserId: user.id,
        sentById: user.id,
        subject: 'Reset your AutovestAI password',
        body: `
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
        `,
      });
    } catch {
      // Email failure is non-fatal
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prismaService.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prismaService.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      });
      await tx.passwordResetToken.delete({
        where: { id: record.id },
      });
    });

    this.emailService.sendPasswordChanged(record.userId).catch(() => {});
  }

  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    // Delete existing tokens for this user first
    await this.prismaService.emailVerificationToken.deleteMany({
      where: { userId },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prismaService.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    const frontendUrl = this.configService.get<string>('app.frontendUrl') ?? '';
    const verifyLink = `${frontendUrl}/verify-email?token=${rawToken}`;

    try {
      await this.emailService.sendWelcome(userId, verifyLink);
    } catch {
      // Email failure is non-fatal
    }

    try {
      await this.crmService.sendDirectEmailToUser({
        toUserId: userId,
        sentById: userId,
        subject: 'Verify your AutovestAI email address',
        body: `
          <p>Please verify your email address by clicking the link below:</p>
          <p><a href="${verifyLink}">${verifyLink}</a></p>
          <p>This link expires in 24 hours. If you did not register, you can ignore this email.</p>
        `,
      });
    } catch {
      // Email failure is non-fatal
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prismaService.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prismaService.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { isEmailVerified: true },
      });
      await tx.emailVerificationToken.delete({
        where: { id: record.id },
      });
    });

    this.emailService.sendEmailVerified(record.userId).catch(() => {});
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if ((user as unknown as { isEmailVerified?: boolean }).isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    await this.sendVerificationEmail(user.id, user.email);
  }

  private async buildAuthResponse(user: User) {
    const { session, refreshToken } = await this.sessionsService.createSession(user.id);
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });
    const authUser = await this.usersService.getCurrentUserProfile(user.id);

    return {
      accessToken: token,
      refreshToken,
      sessionId: session.id,
      user: authUser,
    };
  }
}

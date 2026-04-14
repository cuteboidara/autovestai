import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';

import { AdminChatService } from '../src/modules/admin-chat/admin-chat.service';
import { AdminUsersService } from '../src/modules/admin-users/admin-users.service';
import { BrokerSettingsService } from '../src/modules/admin/broker-settings.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { SurveillanceService } from '../src/modules/surveillance/surveillance.service';
import { UsersService } from '../src/modules/users/users.service';
import { AffiliatesService } from '../src/modules/affiliates/affiliates.service';

jest.mock('bcrypt', () => ({
  __esModule: true,
  compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  it('returns access and refresh tokens on successful login', async () => {
    const user = {
      id: 'user-1',
      email: 'trader@example.com',
      password: 'stored-hash',
      role: UserRole.USER,
    };
    const authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: [],
      adminRoles: [],
    };

    const service = new AuthService(
      {
        findByEmail: jest.fn().mockResolvedValue(null),
      } as never,
      {
        findByEmail: jest.fn().mockResolvedValue(user),
        getCurrentUserProfile: jest.fn().mockResolvedValue(authUser),
        findById: jest.fn().mockResolvedValue(user),
      } as never,
      {
        sign: jest.fn().mockReturnValue('access-token'),
      } as never,
      {
        registerReferralForUser: jest.fn(),
      } as never,
      {
        postSystemAlert: jest.fn(),
      } as never,
      {
        areRegistrationsEnabled: jest.fn().mockReturnValue(true),
      } as never,
      {
        createSession: jest.fn().mockResolvedValue({
          session: { id: 'session-1' },
          refreshToken: 'refresh-token',
        }),
      } as never,
      {
        log: jest.fn(),
      } as never,
      {
        evaluateLogin: jest.fn(),
      } as never,
      {
        passwordResetToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
        emailVerificationToken: { create: jest.fn(), findUnique: jest.fn(), deleteMany: jest.fn(), delete: jest.fn() },
        user: { update: jest.fn() },
        $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({
          user: { update: jest.fn() },
          passwordResetToken: { delete: jest.fn() },
          emailVerificationToken: { delete: jest.fn() },
        })),
      } as never,
      {
        sendDirectEmailToUser: jest.fn(),
      } as never,
      {
        sendPasswordReset: jest.fn(),
        sendPasswordChanged: jest.fn(),
        sendWelcome: jest.fn(),
        sendEmailVerified: jest.fn(),
      } as never,
      {
        get: jest.fn().mockReturnValue(''),
      } as never,
    );
    const result = await service.login({
      email: user.email,
      password: 'secret123',
    });

    expect(result).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      sessionId: 'session-1',
      user: authUser,
    });
  });

  it('rejects invalid credentials', async () => {
    const service = new AuthService(
      {
        findByEmail: jest.fn().mockResolvedValue(null),
      } as never,
      {
        findByEmail: jest.fn().mockResolvedValue(null),
        findById: jest.fn().mockResolvedValue(null),
      } as never,
      {
        sign: jest.fn(),
      } as never,
      {
        registerReferralForUser: jest.fn(),
      } as never,
      {
        postSystemAlert: jest.fn(),
      } as never,
      {
        areRegistrationsEnabled: jest.fn().mockReturnValue(true),
      } as never,
      {
        createSession: jest.fn(),
      } as never,
      {
        log: jest.fn(),
      } as never,
      {
        evaluateLogin: jest.fn(),
      } as never,
      {
        passwordResetToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
        emailVerificationToken: { create: jest.fn(), findUnique: jest.fn(), deleteMany: jest.fn(), delete: jest.fn() },
        user: { update: jest.fn() },
        $transaction: jest.fn(),
      } as never,
      {
        sendDirectEmailToUser: jest.fn(),
      } as never,
      {
        sendPasswordReset: jest.fn(),
        sendPasswordChanged: jest.fn(),
        sendWelcome: jest.fn(),
        sendEmailVerified: jest.fn(),
      } as never,
      {
        get: jest.fn().mockReturnValue(''),
      } as never,
    );

    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'wrong',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

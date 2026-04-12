import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { parseDurationToMilliseconds } from '../../common/utils/time';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly requestContextService: RequestContextService,
    private readonly auditService: AuditService,
  ) {}

  async createSession(userId: string) {
    const refreshToken = this.generateRefreshToken();
    const context = this.requestContextService.get();
    const expiresAt = new Date(
      Date.now() +
        parseDurationToMilliseconds(
          this.configService.getOrThrow<string>('jwt.refreshExpiresIn'),
        ),
    );
    const deviceFingerprint =
      context?.deviceFingerprint ?? this.buildFallbackFingerprint();
    const userAgent = context?.userAgent ?? null;

    const session = await this.prismaService.userSession.create({
      data: {
        userId,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        deviceFingerprint,
        ipAddress: context?.ipAddress ?? null,
        userAgent,
        lastSeenAt: new Date(),
        expiresAt,
      },
    });

    await this.upsertTrustedDevice(userId, deviceFingerprint, userAgent);

    return {
      session,
      refreshToken,
    };
  }

  async rotateSession(refreshToken: string) {
    const session = await this.prismaService.userSession.findFirst({
      where: {
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextRefreshToken = this.generateRefreshToken();
    const context = this.requestContextService.get();
    const updatedSession = await this.prismaService.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashRefreshToken(nextRefreshToken),
        ipAddress: context?.ipAddress ?? session.ipAddress,
        userAgent: context?.userAgent ?? session.userAgent,
        lastSeenAt: new Date(),
        expiresAt: new Date(
          Date.now() +
            parseDurationToMilliseconds(
              this.configService.getOrThrow<string>('jwt.refreshExpiresIn'),
            ),
        ),
      },
      include: {
        user: true,
      },
    });

    await this.upsertTrustedDevice(
      updatedSession.userId,
      updatedSession.deviceFingerprint,
      updatedSession.userAgent,
    );

    return {
      session: updatedSession,
      refreshToken: nextRefreshToken,
      user: updatedSession.user,
    };
  }

  async validateSession(sessionId: string) {
    const session = await this.prismaService.userSession.findUnique({
      where: { id: sessionId },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Session is no longer active');
    }

    return session;
  }

  async touchSession(sessionId: string) {
    const session = await this.prismaService.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.revokedAt !== null) {
      return null;
    }

    const minutesSinceLastSeen =
      Date.now() - session.lastSeenAt.getTime();

    if (minutesSinceLastSeen < 300_000) {
      return session;
    }

    const context = this.requestContextService.get();

    return this.prismaService.userSession.update({
      where: { id: sessionId },
      data: {
        lastSeenAt: new Date(),
        ipAddress: context?.ipAddress ?? session.ipAddress,
        userAgent: context?.userAgent ?? session.userAgent,
      },
    });
  }

  async logoutCurrentSession(userId: string, sessionId: string) {
    return this.revokeSession(userId, sessionId);
  }

  async logoutAllSessions(userId: string, excludeSessionId?: string) {
    const result = await this.prismaService.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        id: excludeSessionId ? { not: excludeSessionId } : undefined,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'AUTH_LOGOUT_ALL_SESSIONS',
      entityType: 'user',
      entityId: userId,
      targetUserId: userId,
      metadataJson: {
        revokedSessionCount: result.count,
        excludedSessionId: excludeSessionId ?? null,
      },
    });

    return { success: true };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prismaService.userSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceFingerprint: session.deviceFingerprint,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      createdAt: session.createdAt,
      isCurrent: currentSessionId === session.id,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prismaService.userSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const revokedSession = await this.prismaService.userSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'AUTH_SESSION_REVOKED',
      entityType: 'user_session',
      entityId: revokedSession.id,
      targetUserId: userId,
      metadataJson: {
        deviceFingerprint: revokedSession.deviceFingerprint,
      },
    });

    return revokedSession;
  }

  private async upsertTrustedDevice(
    userId: string,
    deviceFingerprint: string,
    userAgent?: string | null,
  ) {
    const label = userAgent
      ? userAgent.slice(0, 120)
      : `Device ${deviceFingerprint.slice(0, 8)}`;

    await this.prismaService.trustedDevice.upsert({
      where: {
        userId_deviceFingerprint: {
          userId,
          deviceFingerprint,
        },
      },
      create: {
        userId,
        deviceFingerprint,
        label,
        lastSeenAt: new Date(),
      },
      update: {
        label,
        lastSeenAt: new Date(),
      },
    });
  }

  private generateRefreshToken() {
    return randomBytes(48).toString('hex');
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildFallbackFingerprint() {
    const context = this.requestContextService.get();

    return createHash('sha256')
      .update(
        `${context?.userAgent ?? 'unknown'}:${context?.ipAddress ?? 'unknown'}`,
      )
      .digest('hex');
  }
}

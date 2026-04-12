import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

interface AuditLogInput {
  actorUserId?: string | null;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  targetUserId?: string | null;
  metadataJson?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async log(input: AuditLogInput) {
    const context = this.requestContextService.get();

    return this.prismaService.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? (input.actorUserId ? 'user' : 'system'),
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        targetUserId: input.targetUserId ?? null,
        metadataJson: input.metadataJson,
        ipAddress: input.ipAddress ?? context?.ipAddress ?? null,
        userAgent: input.userAgent ?? context?.userAgent ?? null,
        requestId: input.requestId ?? context?.requestId ?? null,
      },
    });
  }

  list(query: ListAuditLogsQueryDto) {
    return this.prismaService.auditLog.findMany({
      where: {
        actorUserId: query.actorUserId,
        targetUserId: query.targetUserId,
        entityType: query.entityType,
        action: query.action,
        createdAt: {
          gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
          lte: query.dateTo ? new Date(query.dateTo) : undefined,
        },
      },
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async getById(id: string) {
    const auditLog = await this.prismaService.auditLog.findUnique({
      where: { id },
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!auditLog) {
      throw new NotFoundException('Audit log not found');
    }

    return auditLog;
  }
}

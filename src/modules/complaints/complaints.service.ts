import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ComplaintDecision, ComplaintStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal, toNumber } from '../../common/utils/decimal';
import { AuditService } from '../audit/audit.service';
import { BalanceLedgerService } from '../balance-ledger/balance-ledger.service';
import { EmailService } from '../email/email.service';
import { WebhookService } from '../webhooks/webhook.service';

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
    private readonly balanceLedgerService: BalanceLedgerService,
    private readonly emailService: EmailService,
    private readonly webhookService: WebhookService,
  ) {}

  async create(
    userId: string,
    params: {
      description: string;
      tradeId?: string;
      amount?: number;
    },
  ) {
    if (!params.description.trim()) {
      throw new BadRequestException('Complaint description is required');
    }

    const complaint = await this.prismaService.complaint.create({
      data: {
        userId,
        description: params.description.trim(),
        tradeId: params.tradeId ?? null,
        amount: params.amount !== undefined ? toDecimal(params.amount) : null,
        status: ComplaintStatus.OPEN,
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'COMPLAINT_CREATED',
      entityType: 'complaint',
      entityId: complaint.id,
      targetUserId: userId,
      metadataJson: {
        description: params.description.trim(),
        tradeId: params.tradeId ?? null,
        amount: params.amount ?? null,
      } as Prisma.InputJsonObject,
    });

    this.logger.log(`Complaint created: ${complaint.id} by user ${userId}`);

    return complaint;
  }

  async listForUser(userId: string) {
    return this.prismaService.complaint.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForUser(userId: string, complaintId: string) {
    const complaint = await this.prismaService.complaint.findFirst({
      where: { id: complaintId, userId },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    return complaint;
  }

  async listAll(params: {
    status?: ComplaintStatus;
    skip?: number;
    take?: number;
  }) {
    return this.prismaService.complaint.findMany({
      where: { status: params.status },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            accountNumber: true,
            kycSubmission: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: params.skip ?? 0,
      take: params.take ?? 50,
    });
  }

  async acknowledge(complaintId: string, adminId: string) {
    const complaint = await this.prismaService.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    if (complaint.status !== ComplaintStatus.OPEN) {
      throw new BadRequestException('Complaint is not in OPEN status');
    }

    const updated = await this.prismaService.complaint.update({
      where: { id: complaintId },
      data: {
        status: ComplaintStatus.UNDER_REVIEW,
        acknowledgedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId: adminId,
      actorRole: 'admin',
      action: 'COMPLAINT_ACKNOWLEDGED',
      entityType: 'complaint',
      entityId: complaintId,
      targetUserId: complaint.userId,
      metadataJson: {} as Prisma.InputJsonObject,
    });

    return updated;
  }

  async resolve(
    complaintId: string,
    adminId: string,
    params: {
      decision: ComplaintDecision;
      resolutionNote: string;
      compensation?: number;
    },
  ) {
    const complaint = await this.prismaService.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    if (complaint.status === ComplaintStatus.RESOLVED || complaint.status === ComplaintStatus.REJECTED) {
      throw new BadRequestException('Complaint is already decided');
    }

    if (!params.resolutionNote.trim()) {
      throw new BadRequestException('Resolution note is required');
    }

    const finalStatus =
      params.decision === ComplaintDecision.REJECTED
        ? ComplaintStatus.REJECTED
        : ComplaintStatus.RESOLVED;

    // Credit compensation if awarded
    if (params.compensation && params.compensation > 0) {
      await this.prismaService.$transaction(async (tx) => {
        const account = await tx.account.findFirst({
          where: { userId: complaint.userId, isDefault: true },
        });

        if (!account) {
          throw new NotFoundException('Default account not found for user');
        }

        const balanceBefore = toNumber(account.balance) ?? 0;
        const balanceAfter = balanceBefore + params.compensation!;

        await tx.account.update({
          where: { id: account.id },
          data: { balance: { increment: toDecimal(params.compensation!) } },
        });

        await this.balanceLedgerService.appendEntry(
          {
            accountId: account.id,
            userId: complaint.userId,
            type: 'BONUS',
            amountChange: params.compensation!,
            balanceAfter,
            referenceId: complaint.id,
            referenceType: 'complaint',
            description: `Complaint compensation: ${params.resolutionNote.trim()}`,
          },
          tx,
        );
      });
    }

    const updated = await this.prismaService.complaint.update({
      where: { id: complaintId },
      data: {
        status: finalStatus,
        decision: params.decision,
        resolutionNote: params.resolutionNote.trim(),
        compensation: params.compensation ? toDecimal(params.compensation) : null,
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId: adminId,
      actorRole: 'admin',
      action: 'COMPLAINT_RESOLVED',
      entityType: 'complaint',
      entityId: complaintId,
      targetUserId: complaint.userId,
      metadataJson: {
        decision: params.decision,
        compensation: params.compensation ?? null,
        resolutionNote: params.resolutionNote.trim(),
      } as Prisma.InputJsonObject,
    });

    this.emailService
      .sendComplaintResolved(complaint.userId, params.decision, params.resolutionNote.trim())
      .catch((err: Error) => {
        this.logger.warn(
          `Failed to send complaint resolution email to ${complaint.userId}: ${err.message}`,
        );
      });

    this.webhookService
      .fireWebhook('complaint_resolved', complaint.userId, {
        complaintId: complaint.id,
        decision: params.decision,
        compensation: params.compensation ?? 0,
      })
      .catch((err: Error) => {
        this.logger.warn(`Failed to fire complaint_resolved webhook: ${err.message}`);
      });

    this.logger.log(
      `Complaint ${complaintId} resolved: ${params.decision} by admin ${adminId}`,
    );

    return updated;
  }
}

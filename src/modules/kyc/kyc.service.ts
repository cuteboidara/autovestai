import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycDocumentKind, KycStatus } from '@prisma/client';
import { extname } from 'path';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminChatService } from '../admin-chat/admin-chat.service';
import { AuditService } from '../audit/audit.service';
import { CrmService } from '../crm/crm.service';
import { EmailService } from '../email/email.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import {
  KYC_APPROVAL_REQUIRED_MESSAGE,
  UserKycAccessStatus,
} from './kyc.constants';

@Injectable()
export class KycService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
    private readonly crmService: CrmService,
    private readonly emailService: EmailService,
    private readonly adminChatService: AdminChatService,
  ) {}

  async submit(userId: string, dto: SubmitKycDto) {
    const existing = await this.prismaService.kycSubmission.findUnique({
      where: { userId },
    });

    if (existing?.status === KycStatus.APPROVED) {
      throw new BadRequestException('Approved KYC users do not need to resubmit');
    }

    if (existing?.status === KycStatus.PENDING) {
      throw new BadRequestException('KYC submission is already pending review');
    }

    const submission = existing
      ? await this.prismaService.kycSubmission.update({
          where: { userId },
          data: {
            ...dto,
            status: KycStatus.PENDING,
            rejectionReason: null,
            reviewedAt: null,
            reviewedById: null,
          },
        })
      : await this.prismaService.kycSubmission.create({
          data: {
            userId,
            ...dto,
            status: KycStatus.PENDING,
            rejectionReason: null,
            reviewedAt: null,
            reviewedById: null,
          },
        });

    await this.prismaService.kycDecisionLog.create({
      data: {
        submissionId: submission.id,
        userId,
        fromStatus: existing?.status ?? null,
        toStatus: KycStatus.PENDING,
        note: 'KYC submission received',
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'KYC_SUBMITTED',
      entityType: 'kyc_submission',
      entityId: submission.id,
      targetUserId: userId,
      metadataJson: {
        documentType: submission.documentType,
        country: submission.country,
      },
    });

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        accountNumber: true,
        email: true,
      },
    });

    if (user) {
      await this.adminChatService.postSystemAlert(
        'general',
        `${user.accountNumber} submitted KYC documents for review`,
      );
    }

    this.emailService.sendKycSubmitted(userId).catch(() => {});

    return submission;
  }

  async registerUploadedDocument(
    userId: string,
    file: {
      filename: string;
      path: string;
      mimetype: string;
      originalname: string;
    },
    kind: string,
    label?: string,
  ) {
    const documentKind = this.normalizeUploadKind(kind);
    const relativePath = this.normalizeFileUrl(file.path);
    const existingSubmission = await this.prismaService.kycSubmission.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (documentKind === KycDocumentKind.ADDITIONAL) {
      if (!existingSubmission) {
        throw new BadRequestException(
          'Submit the KYC form before uploading additional documents',
        );
      }

      const document = await this.prismaService.kycDocument.create({
        data: {
          submissionId: existingSubmission.id,
          kind: documentKind,
          label: label?.trim() || this.resolveDocumentLabel(documentKind, file.originalname),
          fileUrl: relativePath,
          mimeType: file.mimetype,
          originalName: file.originalname,
        },
      });

      return {
        url: relativePath,
        kind: document.kind,
        label: document.label,
        mimeType: document.mimeType,
        originalName: document.originalName,
      };
    }

    return {
      url: relativePath,
      kind: documentKind,
      label: label?.trim() || this.resolveDocumentLabel(documentKind, file.originalname),
      mimeType: file.mimetype,
      originalName: file.originalname,
    };
  }

  async getMine(userId: string) {
    const submission = await this.prismaService.kycSubmission.findUnique({
      where: { userId },
      include: {
        documents: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        decisionLogs: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    return (
      submission ?? {
        status: 'NOT_SUBMITTED',
      }
    );
  }

  async getStatusForUser(userId: string): Promise<UserKycAccessStatus> {
    const submission = await this.prismaService.kycSubmission.findUnique({
      where: { userId },
      select: { status: true },
    });

    return submission?.status ?? 'NOT_SUBMITTED';
  }

  async assertPlatformAccessApproved(userId: string): Promise<void> {
    const status = await this.getStatusForUser(userId);

    if (status !== KycStatus.APPROVED) {
      throw new BadRequestException(KYC_APPROVAL_REQUIRED_MESSAGE);
    }
  }

  async listForAdmin() {
    return this.prismaService.kycSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            accountNumber: true,
          },
        },
        documents: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async getAdminDetail(id: string) {
    const submission = await this.prismaService.kycSubmission.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            accountNumber: true,
          },
        },
        documents: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        decisionLogs: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            reviewer: {
              select: {
                id: true,
                email: true,
                accountNumber: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('KYC submission not found');
    }

    return submission;
  }

  async approve(id: string, adminId: string, note?: string) {
    const submission = await this.prismaService.kycSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('KYC submission not found');
    }

    if (submission.status === KycStatus.APPROVED) {
      return submission;
    }

    if (submission.status !== KycStatus.PENDING) {
      throw new BadRequestException('KYC submission has already been decided');
    }

    const approved = await this.prismaService.kycSubmission.update({
      where: { id },
      data: {
        status: KycStatus.APPROVED,
        rejectionReason: null,
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
    });

    await this.prismaService.kycDecisionLog.create({
      data: {
        submissionId: approved.id,
        userId: approved.userId,
        reviewerId: adminId,
        fromStatus: submission.status,
        toStatus: KycStatus.APPROVED,
        note: note?.trim() || 'KYC approved',
      },
    });

    await this.auditService.log({
      actorUserId: adminId,
      actorRole: 'admin',
      action: 'KYC_APPROVED',
      entityType: 'kyc_submission',
      entityId: approved.id,
      targetUserId: approved.userId,
      metadataJson: {
        note: note?.trim() || null,
      },
    });

    await this.crmService.sendKycDecisionEmail({
      userId: approved.userId,
      adminId,
      status: KycStatus.APPROVED,
    });

    this.emailService.sendKycApproved(approved.userId).catch(() => {});

    return approved;
  }

  async reject(id: string, adminId: string, reason?: string) {
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const submission = await this.prismaService.kycSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('KYC submission not found');
    }

    if (submission.status === KycStatus.REJECTED) {
      return submission;
    }

    if (submission.status !== KycStatus.PENDING) {
      throw new BadRequestException('KYC submission has already been decided');
    }

    const rejected = await this.prismaService.kycSubmission.update({
      where: { id },
      data: {
        status: KycStatus.REJECTED,
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
    });

    await this.prismaService.kycDecisionLog.create({
      data: {
        submissionId: rejected.id,
        userId: rejected.userId,
        reviewerId: adminId,
        fromStatus: submission.status,
        toStatus: KycStatus.REJECTED,
        note: reason,
      },
    });

    await this.auditService.log({
      actorUserId: adminId,
      actorRole: 'admin',
      action: 'KYC_REJECTED',
      entityType: 'kyc_submission',
      entityId: rejected.id,
      targetUserId: rejected.userId,
      metadataJson: {
        reason,
      },
    });

    await this.crmService.sendKycDecisionEmail({
      userId: rejected.userId,
      adminId,
      status: KycStatus.REJECTED,
      reason,
    });

    this.emailService
      .sendKycRejected(rejected.userId, reason ?? 'Additional information required')
      .catch(() => {});

    return rejected;
  }

  private normalizeUploadKind(kind: string): KycDocumentKind {
    const normalized = kind.trim().toLowerCase();

    switch (normalized) {
      case 'documentfront':
      case 'document_front':
      case 'front':
        return KycDocumentKind.DOCUMENT_FRONT;
      case 'documentback':
      case 'document_back':
      case 'back':
        return KycDocumentKind.DOCUMENT_BACK;
      case 'selfie':
        return KycDocumentKind.SELFIE;
      case 'proofofaddress':
      case 'proof_of_address':
      case 'proof':
        return KycDocumentKind.PROOF_OF_ADDRESS;
      case 'additional':
        return KycDocumentKind.ADDITIONAL;
      default:
        throw new BadRequestException(`Unsupported KYC upload kind: ${kind}`);
    }
  }

  private normalizeFileUrl(filePath: string) {
    const normalized = filePath.replace(/\\/g, '/');
    const uploadsIndex = normalized.lastIndexOf('/uploads/');

    if (uploadsIndex >= 0) {
      return normalized.slice(uploadsIndex);
    }

    return normalized.startsWith('/uploads/')
      ? normalized
      : `/uploads/kyc/${normalized.split('/').slice(-2).join('/')}`;
  }

  private resolveDocumentLabel(kind: KycDocumentKind, originalName: string) {
    switch (kind) {
      case KycDocumentKind.DOCUMENT_FRONT:
        return 'ID Front';
      case KycDocumentKind.DOCUMENT_BACK:
        return 'ID Back';
      case KycDocumentKind.SELFIE:
        return 'Selfie';
      case KycDocumentKind.PROOF_OF_ADDRESS:
        return 'Proof of Address';
      case KycDocumentKind.ADDITIONAL:
      default:
        return originalName.replace(extname(originalName), '') || 'Supporting Document';
    }
  }
}

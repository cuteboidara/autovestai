import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailStatus,
  KycStatus,
  NoteType,
  Prisma,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  accountSelect,
  orderSelect,
  positionSelect,
  transactionSelect,
} from '../../common/prisma/selects';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toNumber } from '../../common/utils/decimal';
import { getUserDisplayName } from '../../common/utils/email-recipient-identity';
import {
  serializeOrder,
  serializePosition,
  serializeTransaction,
} from '../../common/utils/serializers';
import { CreateClientNoteDto } from './dto/create-client-note.dto';
import { CreateEmailSenderConfigDto } from './dto/create-email-sender-config.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { SaveEmailTemplateDto } from './dto/save-email-template.dto';
import { SendCrmEmailDto } from './dto/send-crm-email.dto';
import { UpdateClientNoteDto } from './dto/update-client-note.dto';
import { UpdateEmailSenderConfigDto } from './dto/update-email-sender-config.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

type ClientListItem = {
  id: string;
  accountNumber: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  country: string | null;
  kycStatus: KycStatus | 'NOT_SUBMITTED';
  balance: number;
  accounts: number;
  registeredAt: Date;
  lastLoginAt: Date | null;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'MIXED' | 'NONE';
};

@Injectable()
export class CrmService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getClients(query: ListClientsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const users = await this.prismaService.user.findMany({
      where: this.buildClientListWhere(query),
      include: {
        accounts: {
          where: {
            status: {
              not: 'CLOSED',
            },
          },
          select: {
            id: true,
            type: true,
            status: true,
            balance: true,
          },
        },
        kycSubmission: {
          select: {
            status: true,
            fullName: true,
            country: true,
          },
        },
        sessions: {
          select: {
            lastSeenAt: true,
          },
          orderBy: {
            lastSeenAt: 'desc',
          },
          take: 1,
        },
      },
    });

    const items = users
      .map<ClientListItem>((user) => {
        const balance = user.accounts.reduce(
          (sum, account) => sum + (toNumber(account.balance) ?? 0),
          0,
        );
        const statuses = new Set(user.accounts.map((account) => account.status));
        const accountStatus =
          statuses.size === 0
            ? 'NONE'
            : statuses.size === 1
              ? (Array.from(statuses)[0] as ClientListItem['accountStatus'])
              : 'MIXED';

        return {
          id: user.id,
          accountNumber: user.accountNumber,
          email: user.email,
          fullName: user.kycSubmission?.fullName ?? null,
          phone: null,
          country: user.kycSubmission?.country ?? null,
          kycStatus: user.kycSubmission?.status ?? 'NOT_SUBMITTED',
          balance,
          accounts: user.accounts.length,
          registeredAt: user.createdAt,
          lastLoginAt: user.sessions[0]?.lastSeenAt ?? null,
          accountStatus,
        };
      })
      .sort((left, right) => this.compareClientRows(left, right, query.sortBy, query.sortOrder));

    const total = items.length;
    const start = (page - 1) * limit;

    return {
      items: items.slice(start, start + limit),
      total,
      page,
      limit,
    };
  }

  async getClientProfile(accountNumber: string) {
    const user = await this.prismaService.user.findFirst({
      where: {
        role: UserRole.USER,
        accountNumber,
      },
      select: {
        id: true,
        accountNumber: true,
        email: true,
        createdAt: true,
        kycSubmission: {
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
        },
        clientNotes: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            author: {
              select: {
                id: true,
                email: true,
                accountNumber: true,
              },
            },
          },
        },
        receivedEmailLogs: {
          orderBy: {
            sentAt: 'desc',
          },
          include: {
            sentBy: {
              select: {
                id: true,
                email: true,
                accountNumber: true,
              },
            },
          },
        },
        sessions: {
          select: {
            lastSeenAt: true,
          },
          orderBy: {
            lastSeenAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Client not found');
    }

    const [accounts, positions, orders, transactions, notes, emailLogs] = await Promise.all([
      this.prismaService.account.findMany({
        where: {
          userId: user.id,
          status: {
            not: 'CLOSED',
          },
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: {
          ...accountSelect,
          positions: {
            where: {
              status: 'OPEN',
            },
            select: {
              id: true,
            },
          },
        },
      }),
      this.prismaService.position.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          openedAt: 'desc',
        },
        select: positionSelect,
      }),
      this.prismaService.order.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: orderSelect,
      }),
      this.prismaService.transaction.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: transactionSelect,
      }),
      this.prismaService.clientNote.findMany({
        where: {
          clientId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              accountNumber: true,
            },
          },
        },
      }),
      this.prismaService.emailLog.findMany({
        where: {
          toUserId: user.id,
        },
        orderBy: {
          sentAt: 'desc',
        },
        include: {
          sentBy: {
            select: {
              id: true,
              email: true,
              accountNumber: true,
            },
          },
        },
      }),
    ]);

    const totalBalance = accounts.reduce(
      (sum, account) => sum + (toNumber(account.balance) ?? 0),
      0,
    );
    const totalDeposits = transactions
      .filter(
        (transaction) =>
          transaction.type === TransactionType.DEPOSIT &&
          (transaction.status === TransactionStatus.APPROVED ||
            transaction.status === TransactionStatus.COMPLETED),
      )
      .reduce((sum, transaction) => sum + (toNumber(transaction.amount) ?? 0), 0);
    const closedPositions = positions.filter((position) => position.status === 'CLOSED');

    return {
      id: user.id,
      accountNumber: user.accountNumber,
      email: user.email,
      fullName: user.kycSubmission?.fullName ?? null,
      phone: null,
      country: user.kycSubmission?.country ?? null,
      city: user.kycSubmission?.city ?? null,
      createdAt: user.createdAt,
      lastLoginAt: user.sessions[0]?.lastSeenAt ?? null,
      accountStatus: this.resolveAccountStatus(accounts.map((account) => account.status)),
      stats: {
        totalBalance,
        totalTrades: closedPositions.length,
        totalDeposits,
      },
      accounts: accounts.map((account) => ({
        id: account.id,
        type: account.type,
        name: account.name,
        accountNo: account.accountNo,
        balance: toNumber(account.balance) ?? 0,
        equity: toNumber(account.equity) ?? 0,
        status: account.status,
        openPositions: account.positions.length,
        createdAt: account.createdAt,
      })),
      kycSubmission: user.kycSubmission
        ? {
            ...user.kycSubmission,
            documents: user.kycSubmission.documents,
            decisionLogs: user.kycSubmission.decisionLogs.map((entry) => ({
              id: entry.id,
              fromStatus: entry.fromStatus,
              toStatus: entry.toStatus,
              note: entry.note,
              createdAt: entry.createdAt,
              reviewer: entry.reviewer
                ? {
                    id: entry.reviewer.id,
                    email: entry.reviewer.email,
                    accountNumber: entry.reviewer.accountNumber,
                    displayName: entry.reviewer.email.split('@')[0],
                  }
                : null,
            })),
          }
        : null,
      positions: positions.map((position) => serializePosition(position)),
      orders: orders.map((order) => serializeOrder(order)),
      transactions: transactions.map((transaction) => serializeTransaction(transaction)),
      notes: notes.map((note) => this.serializeNote(note)),
      emailLogs: emailLogs.map((log) => this.serializeEmailLog(log)),
    };
  }

  async addClientNote(clientId: string, admin: AuthenticatedUser, dto: CreateClientNoteDto) {
    await this.assertClientExists(clientId);

    const note = await this.prismaService.clientNote.create({
      data: {
        clientId,
        authorId: admin.id,
        content: dto.content.trim(),
        noteType: dto.noteType ?? NoteType.GENERAL,
        isInternal: true,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            accountNumber: true,
          },
        },
      },
    });

    return this.serializeNote(note);
  }

  async listClientNotes(clientId: string) {
    await this.assertClientExists(clientId);

    const notes = await this.prismaService.clientNote.findMany({
      where: {
        clientId,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            accountNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return notes.map((note) => this.serializeNote(note));
  }

  async updateClientNote(
    clientId: string,
    noteId: string,
    admin: AuthenticatedUser,
    dto: UpdateClientNoteDto,
  ) {
    const note = await this.prismaService.clientNote.findFirst({
      where: {
        id: noteId,
        clientId,
      },
    });

    if (!note) {
      throw new NotFoundException('Client note not found');
    }

    this.assertNoteEditable(note.authorId, admin);

    const updated = await this.prismaService.clientNote.update({
      where: {
        id: note.id,
      },
      data: {
        content: dto.content?.trim() ?? note.content,
        noteType: dto.noteType ?? note.noteType,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            accountNumber: true,
          },
        },
      },
    });

    return this.serializeNote(updated);
  }

  async deleteClientNote(clientId: string, noteId: string, admin: AuthenticatedUser) {
    const note = await this.prismaService.clientNote.findFirst({
      where: {
        id: noteId,
        clientId,
      },
    });

    if (!note) {
      throw new NotFoundException('Client note not found');
    }

    this.assertNoteEditable(note.authorId, admin);

    await this.prismaService.clientNote.delete({
      where: {
        id: note.id,
      },
    });

    return { success: true };
  }

  async sendEmail(admin: AuthenticatedUser, dto: SendCrmEmailDto) {
    const sender = dto.senderConfigId
      ? await this.getSenderConfigEntity(dto.senderConfigId)
      : await this.prismaService.emailSenderConfig.findFirst({
          where: {
            isDefault: true,
            isActive: true,
          },
        });

    if (!sender) {
      throw new NotFoundException('No active email sender is configured');
    }

    if (!sender.isActive) {
      throw new BadRequestException('Selected email sender is inactive');
    }

    const recipients = await this.resolveEmailRecipients(dto);
    const template = dto.templateId
      ? await this.prismaService.emailTemplate.findUnique({
          where: { id: dto.templateId },
        })
      : null;
    const subject = dto.subject?.trim() || template?.subject;
    const body = dto.body?.trim() || template?.body;

    if (!subject || !body) {
      throw new BadRequestException('Email subject and body are required');
    }

    const transport = this.createTransport(sender);
    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        this.sendSingleEmail({
          admin,
          recipient,
          sender,
          subject,
          body,
          transport,
        }),
      ),
    );

    return {
      total: recipients.length,
      sent: results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === EmailStatus.SENT,
      ).length,
      failed: results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === EmailStatus.FAILED,
      ).length,
      results: results.map((result) =>
        result.status === 'fulfilled'
          ? result.value
          : {
              status: EmailStatus.FAILED,
              error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            },
      ),
    };
  }

  async sendKycDecisionEmail(params: {
    userId: string;
    adminId: string;
    status: 'APPROVED' | 'REJECTED';
    reason?: string;
  }) {
    const sender = await this.prismaService.emailSenderConfig.findFirst({
      where: {
        isDefault: true,
        isActive: true,
      },
    });

    if (!sender) {
      return { skipped: true };
    }

    const user = await this.prismaService.user.findUnique({
      where: {
        id: params.userId,
      },
      select: {
        id: true,
        email: true,
        accountNumber: true,
        kycSubmission: {
          select: {
            fullName: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Client not found');
    }

    const subject =
      params.status === KycStatus.APPROVED
        ? 'Your KYC review has been approved'
        : 'Your KYC review has been rejected';
    const recipientName = getUserDisplayName(user);
    const body =
      params.status === KycStatus.APPROVED
        ? `<p>Hello ${recipientName},</p><p>Your KYC review has been approved. You can now access the client platform.</p>`
        : `<p>Hello ${recipientName},</p><p>Your KYC review has been rejected.</p><p>Reason: ${params.reason ?? 'Additional information is required.'}</p>`;
    const transport = this.createTransport(sender);

    try {
      await transport.sendMail({
        from: `${sender.name} <${sender.fromEmail}>`,
        to: user.email,
        subject,
        html: body,
      });

      await this.prismaService.emailLog.create({
        data: {
          toUserId: user.id,
          fromEmail: sender.fromEmail,
          subject,
          body,
          status: EmailStatus.SENT,
          sentById: params.adminId,
        },
      });

      return { success: true };
    } catch (error) {
      await this.prismaService.emailLog.create({
        data: {
          toUserId: user.id,
          fromEmail: sender.fromEmail,
          subject,
          body,
          status: EmailStatus.FAILED,
          sentById: params.adminId,
        },
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sendDirectEmailToUser(params: {
    toUserId: string;
    sentById: string;
    subject: string;
    body: string;
  }) {
    const sender = await this.prismaService.emailSenderConfig.findFirst({
      where: {
        isDefault: true,
        isActive: true,
      },
    });

    if (!sender) {
      return {
        success: false,
        skipped: true,
        error: 'No active email sender is configured',
      };
    }

    const user = await this.prismaService.user.findUnique({
      where: {
        id: params.toUserId,
      },
      select: {
        id: true,
        email: true,
        accountNumber: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Recipient user not found');
    }

    const transport = this.createTransport(sender);

    try {
      await transport.sendMail({
        from: `${sender.name} <${sender.fromEmail}>`,
        to: user.email,
        subject: params.subject,
        html: params.body,
      });

      await this.prismaService.emailLog.create({
        data: {
          toUserId: user.id,
          fromEmail: sender.fromEmail,
          subject: params.subject,
          body: params.body,
          status: EmailStatus.SENT,
          sentById: params.sentById,
        },
      });

      return { success: true };
    } catch (error) {
      await this.prismaService.emailLog.create({
        data: {
          toUserId: user.id,
          fromEmail: sender.fromEmail,
          subject: params.subject,
          body: params.body,
          status: EmailStatus.FAILED,
          sentById: params.sentById,
        },
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listEmailLogs(clientId?: string) {
    const logs = await this.prismaService.emailLog.findMany({
      where: clientId
        ? {
            toUserId: clientId,
          }
        : undefined,
      include: {
        toUser: {
          select: {
            id: true,
            email: true,
            accountNumber: true,
          },
        },
        sentBy: {
          select: {
            id: true,
            email: true,
            accountNumber: true,
          },
        },
      },
      orderBy: {
        sentAt: 'desc',
      },
    });

    return logs.map((log) => this.serializeEmailLog(log));
  }

  async createTemplate(dto: SaveEmailTemplateDto) {
    return this.prismaService.emailTemplate.create({
      data: {
        name: dto.name.trim(),
        subject: dto.subject.trim(),
        body: dto.body.trim(),
      },
    });
  }

  async listTemplates() {
    return this.prismaService.emailTemplate.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateTemplate(templateId: string, dto: UpdateEmailTemplateDto) {
    await this.assertTemplateExists(templateId);

    return this.prismaService.emailTemplate.update({
      where: {
        id: templateId,
      },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject.trim() } : {}),
        ...(dto.body !== undefined ? { body: dto.body.trim() } : {}),
      },
    });
  }

  async deleteTemplate(templateId: string) {
    await this.assertTemplateExists(templateId);

    await this.prismaService.emailTemplate.delete({
      where: {
        id: templateId,
      },
    });

    return { success: true };
  }

  async listSenderConfigs() {
    const senders = await this.prismaService.emailSenderConfig.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return senders.map((sender) => this.serializeSenderConfig(sender));
  }

  async createSenderConfig(dto: CreateEmailSenderConfigDto) {
    if (dto.isDefault) {
      await this.prismaService.emailSenderConfig.updateMany({
        data: {
          isDefault: false,
        },
        where: {
          isDefault: true,
        },
      });
    }

    const sender = await this.prismaService.emailSenderConfig.create({
      data: {
        name: dto.name.trim(),
        fromEmail: dto.fromEmail.trim().toLowerCase(),
        smtpHost: dto.smtpHost.trim(),
        smtpPort: dto.smtpPort,
        smtpUser: dto.smtpUser.trim(),
        smtpPass: this.encrypt(dto.smtpPass),
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
    });

    return this.serializeSenderConfig(sender);
  }

  async updateSenderConfig(senderId: string, dto: UpdateEmailSenderConfigDto) {
    const sender = await this.getSenderConfigEntity(senderId);

    if (dto.isDefault) {
      await this.prismaService.emailSenderConfig.updateMany({
        data: {
          isDefault: false,
        },
        where: {
          isDefault: true,
          id: {
            not: senderId,
          },
        },
      });
    }

    const updated = await this.prismaService.emailSenderConfig.update({
      where: {
        id: sender.id,
      },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.fromEmail !== undefined
          ? { fromEmail: dto.fromEmail.trim().toLowerCase() }
          : {}),
        ...(dto.smtpHost !== undefined ? { smtpHost: dto.smtpHost.trim() } : {}),
        ...(dto.smtpPort !== undefined ? { smtpPort: dto.smtpPort } : {}),
        ...(dto.smtpUser !== undefined ? { smtpUser: dto.smtpUser.trim() } : {}),
        ...(dto.smtpPass !== undefined ? { smtpPass: this.encrypt(dto.smtpPass) } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return this.serializeSenderConfig(updated);
  }

  async deleteSenderConfig(senderId: string) {
    await this.getSenderConfigEntity(senderId);

    await this.prismaService.emailSenderConfig.delete({
      where: {
        id: senderId,
      },
    });

    return { success: true };
  }

  async testSenderConfig(senderId: string, admin: AuthenticatedUser) {
    const sender = await this.getSenderConfigEntity(senderId);
    const transport = this.createTransport(sender);

    await transport.sendMail({
      from: `${sender.name} <${sender.fromEmail}>`,
      to: admin.email,
      subject: 'AutovestAI sender test',
      html: '<p>This is a test email from the AutovestAI CRM sender configuration.</p>',
    });

    return { success: true };
  }

  private buildClientListWhere(query: ListClientsQueryDto): Prisma.UserWhereInput {
    const filters: Prisma.UserWhereInput[] = [
      {
        role: UserRole.USER,
      },
    ];

    if (query.search?.trim()) {
      const search = query.search.trim();
      filters.push({
        OR: [
          {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            accountNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            kycSubmission: {
              is: {
                fullName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      });
    }

    if (query.kycStatus) {
      filters.push({
        kycSubmission: {
          is: {
            status: query.kycStatus,
          },
        },
      });
    }

    if (query.accountType) {
      filters.push({
        accounts: {
          some: {
            type: query.accountType,
            status: {
              not: 'CLOSED',
            },
          },
        },
      });
    }

    if (query.country?.trim()) {
      filters.push({
        kycSubmission: {
          is: {
            country: {
              equals: query.country.trim(),
              mode: 'insensitive',
            },
          },
        },
      });
    }

    if (query.registeredFrom || query.registeredTo) {
      filters.push({
        createdAt: {
          ...(query.registeredFrom ? { gte: new Date(query.registeredFrom) } : {}),
          ...(query.registeredTo ? { lte: new Date(query.registeredTo) } : {}),
        },
      });
    }

    return {
      AND: filters,
    };
  }

  private compareClientRows(
    left: ClientListItem,
    right: ClientListItem,
    sortBy: ListClientsQueryDto['sortBy'] = 'registration_date',
    sortOrder: ListClientsQueryDto['sortOrder'] = 'desc',
  ) {
    const direction = sortOrder === 'asc' ? 1 : -1;

    if (sortBy === 'balance') {
      return (left.balance - right.balance) * direction;
    }

    if (sortBy === 'last_login') {
      return (
        ((left.lastLoginAt?.getTime() ?? 0) - (right.lastLoginAt?.getTime() ?? 0)) * direction
      );
    }

    return (left.registeredAt.getTime() - right.registeredAt.getTime()) * direction;
  }

  private resolveAccountStatus(statuses: string[]) {
    const uniqueStatuses = new Set(statuses);

    if (uniqueStatuses.size === 0) {
      return 'NONE';
    }

    if (uniqueStatuses.size > 1) {
      return 'MIXED';
    }

    return Array.from(uniqueStatuses)[0];
  }

  private async resolveEmailRecipients(dto: SendCrmEmailDto) {
    if (dto.allClients) {
      return this.prismaService.user.findMany({
        where: {
          role: UserRole.USER,
        },
        select: {
          id: true,
          email: true,
          accountNumber: true,
        },
      });
    }

    const userIds = Array.from(new Set(dto.userIds ?? []));

    if (userIds.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }

    return this.prismaService.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        email: true,
        accountNumber: true,
      },
    });
  }

  private async sendSingleEmail(params: {
    admin: AuthenticatedUser;
    recipient: {
      id: string;
      email: string;
      accountNumber: string;
    };
    sender: {
      id: string;
      name: string;
      fromEmail: string;
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass: string;
      isDefault: boolean;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
    subject: string;
    body: string;
    transport: nodemailer.Transporter;
  }) {
    try {
      await params.transport.sendMail({
        from: `${params.sender.name} <${params.sender.fromEmail}>`,
        to: params.recipient.email,
        subject: params.subject,
        html: params.body,
      });

      const log = await this.prismaService.emailLog.create({
        data: {
          toUserId: params.recipient.id,
          fromEmail: params.sender.fromEmail,
          subject: params.subject,
          body: params.body,
          status: EmailStatus.SENT,
          sentById: params.admin.id,
        },
        include: {
          toUser: {
            select: {
              id: true,
              email: true,
              accountNumber: true,
            },
          },
          sentBy: {
            select: {
              id: true,
              email: true,
              accountNumber: true,
            },
          },
        },
      });

      return this.serializeEmailLog(log);
    } catch (error) {
      const log = await this.prismaService.emailLog.create({
        data: {
          toUserId: params.recipient.id,
          fromEmail: params.sender.fromEmail,
          subject: params.subject,
          body: params.body,
          status: EmailStatus.FAILED,
          sentById: params.admin.id,
        },
        include: {
          toUser: {
            select: {
              id: true,
              email: true,
              accountNumber: true,
            },
          },
          sentBy: {
            select: {
              id: true,
              email: true,
              accountNumber: true,
            },
          },
        },
      });

      return {
        ...this.serializeEmailLog(log),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async assertClientExists(clientId: string) {
    const client = await this.prismaService.user.findFirst({
      where: {
        id: clientId,
        role: UserRole.USER,
      },
      select: {
        id: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }
  }

  private assertNoteEditable(authorId: string, admin: AuthenticatedUser) {
    const isSuperAdmin = admin.adminRoles.some((role) => role.name === 'super_admin');

    if (authorId !== admin.id && !isSuperAdmin) {
      throw new ForbiddenException('Only the note author or a super admin can change this note');
    }
  }

  private async getSenderConfigEntity(senderId: string) {
    const sender = await this.prismaService.emailSenderConfig.findUnique({
      where: {
        id: senderId,
      },
    });

    if (!sender) {
      throw new NotFoundException('Email sender configuration not found');
    }

    return sender;
  }

  private async assertTemplateExists(templateId: string) {
    const template = await this.prismaService.emailTemplate.findUnique({
      where: {
        id: templateId,
      },
      select: {
        id: true,
      },
    });

    if (!template) {
      throw new NotFoundException('Email template not found');
    }
  }

  private createTransport(sender: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
  }) {
    return nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: {
        user: sender.smtpUser,
        pass: this.decrypt(sender.smtpPass),
      },
    });
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const key = createHash('sha256')
      .update(this.configService.get<string>('email.encryptionSecret') ?? 'local-dev-secret')
      .digest();
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
  }

  private decrypt(value: string) {
    const [ivHex, tagHex, encryptedHex] = value.split(':');

    if (!ivHex || !tagHex || !encryptedHex) {
      return value;
    }

    const key = createHash('sha256')
      .update(this.configService.get<string>('email.encryptionSecret') ?? 'local-dev-secret')
      .digest();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  private serializeNote(note: {
    id: string;
    clientId: string;
    authorId: string;
    content: string;
    noteType: NoteType;
    isInternal: boolean;
    createdAt: Date;
    updatedAt: Date;
    author?: {
      id: string;
      email: string;
      accountNumber: string;
    } | null;
  }) {
    return {
      id: note.id,
      clientId: note.clientId,
      authorId: note.authorId,
      content: note.content,
      noteType: note.noteType,
      isInternal: note.isInternal,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      author: note.author
        ? {
            id: note.author.id,
            email: note.author.email,
            accountNumber: note.author.accountNumber,
            displayName: note.author.email.split('@')[0],
          }
        : null,
    };
  }

  private serializeEmailLog(log: {
    id: string;
    toUserId: string;
    fromEmail: string;
    subject: string;
    body: string;
    status: EmailStatus;
    sentAt: Date;
    sentById: string;
    toUser?: {
      id: string;
      email: string;
      accountNumber: string;
    } | null;
    sentBy?: {
      id: string;
      email: string;
      accountNumber: string;
    } | null;
  }) {
    return {
      id: log.id,
      toUserId: log.toUserId,
      fromEmail: log.fromEmail,
      subject: log.subject,
      body: log.body,
      status: log.status,
      sentAt: log.sentAt,
      sentById: log.sentById,
      toUser: log.toUser
        ? {
            id: log.toUser.id,
            email: log.toUser.email,
            accountNumber: log.toUser.accountNumber,
          }
        : null,
      sentBy: log.sentBy
        ? {
            id: log.sentBy.id,
            email: log.sentBy.email,
            accountNumber: log.sentBy.accountNumber,
            displayName: log.sentBy.email.split('@')[0],
          }
        : null,
    };
  }

  private serializeSenderConfig(sender: {
    id: string;
    name: string;
    fromEmail: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    isDefault: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: sender.id,
      name: sender.name,
      fromEmail: sender.fromEmail,
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      smtpUser: sender.smtpUser,
      isDefault: sender.isDefault,
      isActive: sender.isActive,
      createdAt: sender.createdAt,
      updatedAt: sender.updatedAt,
    };
  }
}

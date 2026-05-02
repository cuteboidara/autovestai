import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { NotificationDeliveryStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService, EmailTemplate } from '../email/email.service';

type EmailVariableValue = string | number | undefined;
type EmailVariables = Record<string, EmailVariableValue>;

export interface EnqueueNotificationParams {
  userId: string;
  templateKey: EmailTemplate;
  payload: EmailVariables;
}

// Backoff schedule in minutes: immediate, 5m, 30m, 2h, 6h
const RETRY_DELAYS_MS = [0, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000];

@Injectable()
export class NotificationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);
  private timer?: NodeJS.Timeout;
  private isProcessing = false;
  private readonly pollIntervalMs = 30_000;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.processQueue();
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async enqueue(params: EnqueueNotificationParams): Promise<void> {
    await this.prismaService.notificationQueue.create({
      data: {
        userId: params.userId,
        templateKey: params.templateKey,
        payload: params.payload as Prisma.InputJsonObject,
        status: NotificationDeliveryStatus.PENDING,
        nextAttemptAt: new Date(),
      },
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const pending = await this.prismaService.notificationQueue.findMany({
        where: {
          status: NotificationDeliveryStatus.PENDING,
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: { nextAttemptAt: 'asc' },
        take: 50,
      });

      for (const notification of pending) {
        await this.processOne(notification.id);
      }
    } catch (error) {
      this.logger.error(`Notification queue processing failed: ${(error as Error).message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processOne(id: string): Promise<void> {
    const notification = await this.prismaService.notificationQueue.findUnique({
      where: { id },
    });

    if (!notification || notification.status !== NotificationDeliveryStatus.PENDING) {
      return;
    }

    const attempts = notification.attempts + 1;

    try {
      const payload = notification.payload as Record<string, EmailVariableValue>;
      await this.emailService.sendByTemplate(notification.userId, notification.templateKey as EmailTemplate, payload);

      await this.prismaService.notificationQueue.update({
        where: { id },
        data: {
          status: NotificationDeliveryStatus.SENT,
          attempts,
          sentAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Notification ${id} attempt ${attempts} failed: ${err.message}`);

      const maxAttempts = notification.maxAttempts;
      const delayMs = RETRY_DELAYS_MS[attempts] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];

      await this.prismaService.notificationQueue.update({
        where: { id },
        data: {
          attempts,
          lastError: err.message,
          status: attempts >= maxAttempts
            ? NotificationDeliveryStatus.FAILED
            : NotificationDeliveryStatus.PENDING,
          nextAttemptAt: attempts >= maxAttempts
            ? undefined
            : new Date(Date.now() + delayMs),
        },
      });
    }
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import axios, { AxiosError } from 'axios';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const VALID_WEBHOOK_EVENTS = [
  'margin_call',
  'position_liquidated',
  'deposit_confirmed',
  'withdrawal_settled',
  'trade_opened',
  'trade_closed',
  'kyc_approved',
  'complaint_resolved',
] as const;

export type WebhookEvent = (typeof VALID_WEBHOOK_EVENTS)[number];

export interface WebhookPayload {
  event: string;
  eventId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// Exponential backoff: immediate, 1m, 5m, 15m, 1h, 4h
const RETRY_DELAYS_MS = [0, 60_000, 5 * 60_000, 15 * 60_000, 3600_000, 4 * 3600_000];

@Injectable()
export class WebhookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookService.name);
  private deliveryTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit(): void {
    // Process queue every 60 seconds
    this.deliveryTimer = setInterval(() => {
      void this.processDeliveryQueue();
    }, 60_000);

    // Cleanup old deliveries daily
    this.cleanupTimer = setInterval(() => {
      void this.cleanupOldDeliveries();
    }, 24 * 3600_000);
  }

  onModuleDestroy(): void {
    if (this.deliveryTimer) clearInterval(this.deliveryTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async registerWebhook(userId: string, url: string, events: string[]) {
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid webhook URL');
    }

    if (!url.startsWith('https://')) {
      throw new BadRequestException('Webhook URL must use HTTPS');
    }

    const invalidEvents = events.filter(
      (e) => !VALID_WEBHOOK_EVENTS.includes(e as WebhookEvent),
    );
    if (invalidEvents.length > 0) {
      throw new BadRequestException(`Invalid events: ${invalidEvents.join(', ')}`);
    }

    const existing = await this.prismaService.webhookEndpoint.count({
      where: { userId, active: true },
    });
    if (existing >= 10) {
      throw new BadRequestException('Maximum of 10 active webhooks per user');
    }

    const secret = randomBytes(32).toString('hex');

    const webhook = await this.prismaService.webhookEndpoint.create({
      data: { userId, url, events, secret },
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'WEBHOOK_REGISTERED',
      entityType: 'webhook_endpoint',
      entityId: webhook.id,
      targetUserId: userId,
      metadataJson: { url, events },
    });

    return { id: webhook.id, secret, url, events };
  }

  async testWebhook(webhookId: string, userId: string) {
    const webhook = await this.prismaService.webhookEndpoint.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || webhook.userId !== userId) {
      throw new BadRequestException('Webhook not found');
    }

    const payload: WebhookPayload = {
      event: 'test',
      eventId: `test-${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook from AutovestAI' },
    };

    const signature = this.buildSignature(webhook.secret, payload);
    const startTime = Date.now();

    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': payload.event,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
        validateStatus: () => true,
      });

      const responseTime = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      await this.prismaService.webhookLog.create({
        data: {
          webhookId: webhook.id,
          event: 'test',
          success,
          httpStatus: response.status,
          responseTime,
        },
      });

      return { success, httpStatus: response.status, responseTime };
    } catch (err) {
      const error = err instanceof AxiosError ? `${err.code}: ${err.message}` : (err as Error).message;
      return { success: false, error, responseTime: Date.now() - startTime };
    }
  }

  async deleteWebhook(webhookId: string, userId: string) {
    const webhook = await this.prismaService.webhookEndpoint.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || webhook.userId !== userId) {
      throw new BadRequestException('Webhook not found');
    }

    await this.prismaService.webhookEndpoint.delete({ where: { id: webhookId } });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'WEBHOOK_DELETED',
      entityType: 'webhook_endpoint',
      entityId: webhookId,
      targetUserId: userId,
      metadataJson: { url: webhook.url },
    });

    return { success: true };
  }

  async listWebhooks(userId: string) {
    return this.prismaService.webhookEndpoint.findMany({
      where: { userId },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        lastSuccessAt: true,
        lastErrorAt: true,
        lastError: true,
        deliveryRate: true,
        totalDeliveries: true,
        failedDeliveries: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWebhookStats(webhookId: string, userId: string) {
    const webhook = await this.prismaService.webhookEndpoint.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || webhook.userId !== userId) {
      throw new BadRequestException('Webhook not found');
    }

    const [deliveryCounts, recentDeliveries] = await Promise.all([
      this.prismaService.webhookDelivery.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { webhookId },
      }),
      this.prismaService.webhookDelivery.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          event: true,
          status: true,
          httpStatus: true,
          attempts: true,
          createdAt: true,
          deliveredAt: true,
        },
      }),
    ]);

    const counts = Object.fromEntries(
      deliveryCounts.map((d) => [d.status, d._count.id]),
    );

    return {
      webhook: {
        id: webhook.id,
        url: webhook.url,
        active: webhook.active,
        deliveryRate: webhook.deliveryRate,
        totalDeliveries: webhook.totalDeliveries,
        failedDeliveries: webhook.failedDeliveries,
      },
      stats: {
        pending: counts['pending'] ?? 0,
        delivered: counts['delivered'] ?? 0,
        failed: counts['failed'] ?? 0,
      },
      lastError: webhook.lastError,
      lastErrorAt: webhook.lastErrorAt,
      lastSuccessAt: webhook.lastSuccessAt,
      recentDeliveries,
    };
  }

  async getDeliveryHistory(webhookId: string, userId: string) {
    const webhook = await this.prismaService.webhookEndpoint.findUnique({
      where: { id: webhookId },
      select: { userId: true },
    });

    if (!webhook || webhook.userId !== userId) {
      throw new BadRequestException('Webhook not found');
    }

    return this.prismaService.webhookDelivery.findMany({
      where: { webhookId },
      select: {
        id: true,
        event: true,
        status: true,
        httpStatus: true,
        error: true,
        attempts: true,
        createdAt: true,
        deliveredAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async fireWebhook(
    event: string,
    userId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const webhooks = await this.prismaService.webhookEndpoint.findMany({
      where: { userId, active: true, events: { has: event } },
    });

    if (webhooks.length === 0) return;

    const eventId = `${event}-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const payload: WebhookPayload = {
      event,
      eventId,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const webhook of webhooks) {
      const exists = await this.prismaService.webhookDelivery.findUnique({
        where: { webhookId_eventId: { webhookId: webhook.id, eventId } },
      });
      if (exists) continue;

      await this.prismaService.webhookDelivery.create({
        data: { webhookId: webhook.id, event, eventId, payload: payload as object },
      });

      this.logger.debug(`Queued webhook delivery: ${webhook.id} (${event})`);
    }
  }

  private async processDeliveryQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pending = await this.prismaService.webhookDelivery.findMany({
        where: {
          status: 'pending',
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
        },
        include: { webhook: true },
        take: 100,
      });

      for (const delivery of pending) {
        await this.sendDelivery(delivery);
      }

      if (pending.length > 0) {
        this.logger.log(`Processed ${pending.length} webhook deliveries`);
      }
    } catch (err) {
      this.logger.error(`Webhook queue processing error: ${(err as Error).message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async sendDelivery(delivery: {
    id: string;
    webhookId: string;
    event: string;
    eventId: string;
    payload: unknown;
    status: string;
    attempts: number;
    maxAttempts: number;
    createdAt: Date;
    webhook: {
      id: string;
      url: string;
      secret: string;
      rateLimit: number;
    };
  }): Promise<void> {
    const { webhook } = delivery;
    const payload = delivery.payload as WebhookPayload;

    // Per-minute rate limit check
    const recentCount = await this.prismaService.webhookDelivery.count({
      where: {
        webhookId: webhook.id,
        lastAttemptAt: { gte: new Date(Date.now() - 60_000) },
      },
    });

    if (recentCount >= webhook.rateLimit) {
      await this.prismaService.webhookDelivery.update({
        where: { id: delivery.id },
        data: { nextRetryAt: new Date(Date.now() + 60_000) },
      });
      return;
    }

    const startTime = Date.now();

    try {
      const signature = this.buildSignature(webhook.secret, payload);

      const response = await axios.post(webhook.url, payload, {
        headers: {
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': payload.event,
          'X-Webhook-Delivery-ID': delivery.id,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
        validateStatus: (status) => status >= 200 && status < 500,
      });

      const responseTime = Date.now() - startTime;
      const responseBody =
        typeof response.data === 'string'
          ? response.data.slice(0, 1000)
          : JSON.stringify(response.data).slice(0, 1000);

      await this.prismaService.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'delivered',
          httpStatus: response.status,
          response: responseBody,
          deliveredAt: new Date(),
          attempts: delivery.attempts + 1,
          lastAttemptAt: new Date(),
        },
      });

      await this.prismaService.webhookEndpoint.update({
        where: { id: webhook.id },
        data: {
          lastSuccessAt: new Date(),
          totalDeliveries: { increment: 1 },
          lastError: null,
        },
      });

      await this.prismaService.webhookLog.create({
        data: {
          webhookId: webhook.id,
          event: payload.event,
          success: true,
          httpStatus: response.status,
          responseTime,
        },
      });

      this.logger.log(
        `Webhook delivered: ${webhook.id} (${payload.event}) → ${response.status} in ${responseTime}ms`,
      );
    } catch (err) {
      const responseTime = Date.now() - startTime;
      const axiosErr = err instanceof AxiosError ? err : null;
      const errorMessage = axiosErr
        ? `${axiosErr.code ?? 'ERR'}: ${axiosErr.message}`
        : (err as Error).message;

      const isPermanent =
        axiosErr?.response?.status === 410 ||
        axiosErr?.code === 'ENOTFOUND' ||
        delivery.attempts + 1 >= delivery.maxAttempts;

      const nextStatus = isPermanent ? 'failed' : 'pending';
      const delayMs = RETRY_DELAYS_MS[delivery.attempts + 1] ?? RETRY_DELAYS_MS.at(-1)!;

      await this.prismaService.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: nextStatus,
          httpStatus: axiosErr?.response?.status ?? null,
          error: errorMessage.slice(0, 500),
          attempts: delivery.attempts + 1,
          lastAttemptAt: new Date(),
          nextRetryAt: nextStatus === 'pending' ? new Date(Date.now() + delayMs) : null,
        },
      });

      if (nextStatus === 'failed') {
        await this.prismaService.webhookEndpoint.update({
          where: { id: webhook.id },
          data: {
            lastErrorAt: new Date(),
            lastError: errorMessage.slice(0, 500),
            failedDeliveries: { increment: 1 },
          },
        });
      }

      await this.prismaService.webhookLog.create({
        data: {
          webhookId: webhook.id,
          event: payload.event,
          success: false,
          httpStatus: axiosErr?.response?.status ?? null,
          responseTime,
        },
      });

      this.logger.warn(
        `Webhook delivery failed (attempt ${delivery.attempts + 1}/${delivery.maxAttempts}): ${webhook.id} — ${errorMessage}`,
      );
    }
  }

  private buildSignature(secret: string, payload: WebhookPayload): string {
    const sig = createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return `sha256=${sig}`;
  }

  private async cleanupOldDeliveries(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 3600_000);
      const result = await this.prismaService.webhookDelivery.deleteMany({
        where: { status: 'delivered', deliveredAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} old webhook deliveries`);
      }
    } catch (err) {
      this.logger.error(`Webhook cleanup error: ${(err as Error).message}`);
    }
  }
}

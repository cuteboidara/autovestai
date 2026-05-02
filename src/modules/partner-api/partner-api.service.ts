import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PartnerApiService {
  private readonly logger = new Logger(PartnerApiService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async onboardPartner(data: { name: string; email: string; website?: string }) {
    const existing = await this.prismaService.apiPartner.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });

    if (existing) {
      throw new BadRequestException('A partner with this email already exists');
    }

    const apiKey = `pk_live_${randomBytes(24).toString('hex')}`;
    const apiSecret = randomBytes(32).toString('hex');
    const apiSecretHashed = await bcrypt.hash(apiSecret, 10);

    const partner = await this.prismaService.apiPartner.create({
      data: {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        website: data.website?.trim() || null,
        apiKey,
        apiSecret: apiSecretHashed,
        allowedEndpoints: ['/api/signals', '/api/execute', '/api/subscribe', '/api/stats'],
        ipWhitelist: [],
      },
    });

    this.logger.log(`Partner onboarded: ${partner.name} (${partner.id})`);

    return { id: partner.id, name: partner.name, apiKey, apiSecret };
  }

  async authenticatePartner(apiKey: string, ipAddress: string) {
    const partner = await this.prismaService.apiPartner.findUnique({
      where: { apiKey },
    });

    if (!partner) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (partner.status !== 'active') {
      throw new ForbiddenException(`Partner account is ${partner.status}`);
    }

    if (partner.ipWhitelist.length > 0 && !partner.ipWhitelist.includes(ipAddress)) {
      throw new ForbiddenException('IP address not whitelisted');
    }

    await this.prismaService.apiPartner.update({
      where: { id: partner.id },
      data: { lastApiCall: new Date() },
    });

    return partner;
  }

  async getSignals(partnerId: string, signalType: string) {
    const subscription = await this.prismaService.signalSubscription.findUnique({
      where: { partnerId_signalType: { partnerId, signalType } },
    });

    if (!subscription || !subscription.active) {
      throw new ForbiddenException(`Not subscribed to ${signalType} signals`);
    }

    // Signals are generated externally; this returns the latest from the signals system.
    // Extend this to query a signals table when the signal generation system is built.
    const signals = this.buildMockSignals(signalType, subscription.pairs);

    return {
      type: signalType,
      signals,
      timestamp: new Date().toISOString(),
    };
  }

  async recordSignalExecution(
    partnerId: string,
    data: {
      signalId: string;
      executed: boolean;
      executionPrice?: number;
      executionTime?: string;
    },
  ) {
    this.logger.log(
      `Partner ${partnerId} ${data.executed ? 'executed' : 'skipped'} signal ${data.signalId}` +
        (data.executionPrice ? ` at ${data.executionPrice}` : ''),
    );

    return { success: true };
  }

  async subscribeToSignals(
    partnerId: string,
    data: {
      signalType: string;
      deliveryMethod: string;
      minimumConfidence?: number;
      pairs?: string[];
    },
  ) {
    const validTypes = ['swing', 'scalp', 'sniper', 'apex_pro'];
    if (!validTypes.includes(data.signalType)) {
      throw new BadRequestException(
        `Invalid signalType. Valid values: ${validTypes.join(', ')}`,
      );
    }

    const validMethods = ['webhook', 'api_poll'];
    if (!validMethods.includes(data.deliveryMethod)) {
      throw new BadRequestException(
        `Invalid deliveryMethod. Valid values: ${validMethods.join(', ')}`,
      );
    }

    return this.prismaService.signalSubscription.upsert({
      where: { partnerId_signalType: { partnerId, signalType: data.signalType } },
      update: {
        deliveryMethod: data.deliveryMethod,
        minimumConfidence: data.minimumConfidence ?? 50,
        pairs: data.pairs ?? [],
        active: true,
      },
      create: {
        partnerId,
        signalType: data.signalType,
        deliveryMethod: data.deliveryMethod,
        minimumConfidence: data.minimumConfidence ?? 50,
        pairs: data.pairs ?? [],
      },
    });
  }

  async logApiCall(
    partnerId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    ipAddress: string,
  ): Promise<void> {
    await this.prismaService.apiCall.create({
      data: { partnerId, endpoint, method, statusCode, responseTime, ipAddress },
    });
  }

  async checkRateLimit(partnerId: string): Promise<void> {
    const partner = await this.prismaService.apiPartner.findUnique({
      where: { id: partnerId },
      select: { rateLimit: true },
    });

    if (!partner) return;

    const recentCalls = await this.prismaService.apiCall.count({
      where: { partnerId, createdAt: { gte: new Date(Date.now() - 60_000) } },
    });

    if (recentCalls >= partner.rateLimit) {
      throw new ForbiddenException('Rate limit exceeded. Try again in a minute.');
    }
  }

  async getPartnerStats(partnerId: string) {
    const [partner, callStats, subscriptions] = await Promise.all([
      this.prismaService.apiPartner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          name: true,
          status: true,
          lastApiCall: true,
          rateLimit: true,
        },
      }),
      this.prismaService.apiCall.groupBy({
        by: ['endpoint'],
        _count: { id: true },
        _avg: { responseTime: true },
        where: { partnerId, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
      }),
      this.prismaService.signalSubscription.findMany({
        where: { partnerId, active: true },
        select: { signalType: true, deliveryMethod: true, minimumConfidence: true },
      }),
    ]);

    if (!partner) {
      throw new BadRequestException('Partner not found');
    }

    return {
      id: partner.id,
      name: partner.name,
      status: partner.status,
      lastApiCall: partner.lastApiCall,
      rateLimit: partner.rateLimit,
      callsLast24h: callStats.reduce((sum, c) => sum + c._count.id, 0),
      endpoints: callStats.map((c) => ({
        endpoint: c.endpoint,
        calls: c._count.id,
        avgResponseTimeMs: Math.round(c._avg.responseTime ?? 0),
      })),
      subscriptions,
    };
  }

  private buildMockSignals(signalType: string, pairs: string[]) {
    // Placeholder — replace with real signal query when signal generation is built
    const activePairs = pairs.length > 0 ? pairs : ['EURUSD', 'GBPUSD'];
    return activePairs.slice(0, 3).map((pair, i) => ({
      id: `sig_${signalType}_${Date.now()}_${i}`,
      pair,
      signal: i % 2 === 0 ? 'buy' : 'sell',
      entryZone: [1.0940, 1.0960],
      stopLoss: 1.0900,
      takeProfit: 1.1050,
      confidence: 75 + i * 5,
      timestamp: new Date().toISOString(),
    }));
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { PartnerApiService } from './partner-api.service';

@Public()
@Controller('api')
export class PartnerApiController {
  constructor(private readonly partnerApiService: PartnerApiService) {}

  private async authenticate(req: Request) {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (!apiKey) {
      throw new BadRequestException('Missing X-API-Key header');
    }
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress
      ?? '';
    return this.partnerApiService.authenticatePartner(apiKey, ip);
  }

  @Post('signals')
  async getSignals(@Req() req: Request, @Body() body: { signalType?: string }) {
    const partner = await this.authenticate(req);

    if (!body.signalType) {
      throw new BadRequestException('signalType is required (swing, scalp, sniper, apex_pro)');
    }

    await this.partnerApiService.checkRateLimit(partner.id);

    const startTime = Date.now();
    const signals = await this.partnerApiService.getSignals(partner.id, body.signalType);

    void this.partnerApiService.logApiCall(
      partner.id,
      '/api/signals',
      'POST',
      200,
      Date.now() - startTime,
      req.socket.remoteAddress ?? '',
    );

    return signals;
  }

  @Post('execute')
  async recordExecution(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const partner = await this.authenticate(req);

    if (!body.signalId || typeof body.executed !== 'boolean') {
      throw new BadRequestException('signalId (string) and executed (boolean) are required');
    }

    await this.partnerApiService.checkRateLimit(partner.id);

    const startTime = Date.now();
    const result = await this.partnerApiService.recordSignalExecution(partner.id, {
      signalId: body.signalId as string,
      executed: body.executed,
      executionPrice: body.executionPrice as number | undefined,
      executionTime: body.executionTime as string | undefined,
    });

    void this.partnerApiService.logApiCall(
      partner.id,
      '/api/execute',
      'POST',
      200,
      Date.now() - startTime,
      req.socket.remoteAddress ?? '',
    );

    return result;
  }

  @Post('subscribe')
  async subscribe(
    @Req() req: Request,
    @Body()
    body: {
      signalType?: string;
      deliveryMethod?: string;
      minimumConfidence?: number;
      pairs?: string[];
    },
  ) {
    const partner = await this.authenticate(req);

    if (!body.signalType || !body.deliveryMethod) {
      throw new BadRequestException('signalType and deliveryMethod are required');
    }

    const startTime = Date.now();
    const subscription = await this.partnerApiService.subscribeToSignals(partner.id, {
      signalType: body.signalType,
      deliveryMethod: body.deliveryMethod,
      minimumConfidence: body.minimumConfidence,
      pairs: body.pairs,
    });

    void this.partnerApiService.logApiCall(
      partner.id,
      '/api/subscribe',
      'POST',
      200,
      Date.now() - startTime,
      req.socket.remoteAddress ?? '',
    );

    return subscription;
  }

  @Get('stats')
  async getStats(@Req() req: Request) {
    const partner = await this.authenticate(req);

    const startTime = Date.now();
    const stats = await this.partnerApiService.getPartnerStats(partner.id);

    void this.partnerApiService.logApiCall(
      partner.id,
      '/api/stats',
      'GET',
      200,
      Date.now() - startTime,
      req.socket.remoteAddress ?? '',
    );

    return stats;
  }
}

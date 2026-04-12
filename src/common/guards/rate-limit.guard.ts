import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { id?: string } }>();
    const identifier =
      request.user?.id ??
      request.ip ??
      request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ??
      'anonymous';
    const key = `rate-limit:${options.keyPrefix}:${identifier}`;
    const client = this.redisService.getClient();
    const counter = await client.incr(key);

    if (counter === 1) {
      await client.expire(key, options.ttlSeconds);
    }

    if (counter > options.limit) {
      throw new HttpException(
        `Rate limit exceeded for ${options.keyPrefix}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

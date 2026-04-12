import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  keyPrefix: string;
  limit: number;
  ttlSeconds: number;
}

export const RATE_LIMIT_KEY = 'rate-limit';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

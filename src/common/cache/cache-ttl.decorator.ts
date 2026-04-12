import { SetMetadata } from '@nestjs/common';

import { RESPONSE_CACHE_TTL_METADATA } from './cache.constants';

export const CacheTTL = (ttlSeconds: number) =>
  SetMetadata(RESPONSE_CACHE_TTL_METADATA, ttlSeconds);

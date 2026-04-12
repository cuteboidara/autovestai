import { applyDecorators, SetMetadata } from '@nestjs/common';

import { RESPONSE_CACHE_RESOURCE_METADATA, RESPONSE_CACHE_SCOPE_METADATA, ResponseCacheScope } from './cache.constants';

export const CacheResource = (resource: string, scope: ResponseCacheScope = 'public') => {
  return applyDecorators(
    SetMetadata(RESPONSE_CACHE_RESOURCE_METADATA, resource),
    SetMetadata(RESPONSE_CACHE_SCOPE_METADATA, scope),
  );
};

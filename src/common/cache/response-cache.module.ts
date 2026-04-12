import { Global, Module } from '@nestjs/common';

import { ResponseCacheInterceptor } from './response-cache.interceptor';
import { ResponseCacheService } from './response-cache.service';

@Global()
@Module({
  providers: [ResponseCacheService, ResponseCacheInterceptor],
  exports: [ResponseCacheService, ResponseCacheInterceptor],
})
export class ResponseCacheModule {}

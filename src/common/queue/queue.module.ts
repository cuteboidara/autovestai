import { Global, Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module';
import { OrderQueueService } from './order-queue.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [OrderQueueService],
  exports: [OrderQueueService],
})
export class QueueModule {}

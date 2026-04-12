import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

import { RedisService } from '../../common/redis/redis.service';
import {
  COPY_MASTER_CLOSE_JOB,
  COPY_MASTER_OPEN_JOB,
  COPY_TRADING_QUEUE,
} from './copy-trading.constants';
import { QueueMetricsSnapshot } from '../../common/queue/order-queue.service';
import {
  closeQueueQuietly,
  isRecoverableQueueError,
} from '../../common/queue/queue-recovery.util';

@Injectable()
export class CopyTradingQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(CopyTradingQueueService.name);
  private queue: Queue;
  private queueRecoveryPromise?: Promise<void>;

  constructor(private readonly redisService: RedisService) {
    this.queue = this.createQueue();
  }

  async enqueueMasterOpen(positionId: string) {
    await this.withRecoveredQueue((queue) =>
      queue.add(
        COPY_MASTER_OPEN_JOB,
        { positionId },
        {
          jobId: `copy-open-${positionId}`,
          attempts: 3,
        },
      ),
    );
  }

  async enqueueMasterClose(positionId: string) {
    await this.withRecoveredQueue((queue) =>
      queue.add(
        COPY_MASTER_CLOSE_JOB,
        { positionId },
        {
          jobId: `copy-close-${positionId}`,
          attempts: 3,
        },
      ),
    );
  }

  async getQueueMetrics(): Promise<QueueMetricsSnapshot> {
    const counts = await this.withRecoveredQueue((queue) =>
      queue.getJobCounts(
        'active',
        'waiting',
        'delayed',
        'failed',
        'completed',
      ),
    );

    return {
      name: COPY_TRADING_QUEUE,
      active: counts.active ?? 0,
      waiting: counts.waiting ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queueRecoveryPromise) {
      await this.queueRecoveryPromise;
    }

    await closeQueueQuietly(this.queue);
  }

  private createQueue(): Queue {
    const queue = new Queue(COPY_TRADING_QUEUE, {
      connection: this.redisService.getClient(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });

    queue.on('error', (error) => {
      this.logger.error(`Copy trading queue connection error: ${error.message}`);
    });

    return queue;
  }

  private async withRecoveredQueue<T>(
    operation: (queue: Queue) => Promise<T>,
  ): Promise<T> {
    try {
      return await operation(this.queue);
    } catch (error) {
      if (!isRecoverableQueueError(error)) {
        throw error;
      }

      await this.recoverQueue();
      return operation(this.queue);
    }
  }

  private async recoverQueue(): Promise<void> {
    if (this.queueRecoveryPromise) {
      await this.queueRecoveryPromise;
      return;
    }

    const staleQueue = this.queue;
    this.queueRecoveryPromise = (async () => {
      this.logger.warn('Copy trading queue connection closed. Recreating queue instance.');
      this.queue = this.createQueue();
      await closeQueueQuietly(staleQueue);
    })();

    try {
      await this.queueRecoveryPromise;
    } finally {
      this.queueRecoveryPromise = undefined;
    }
  }
}

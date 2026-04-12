import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

import { RedisService } from '../redis/redis.service';
import {
  EXECUTE_ORDER_JOB,
  ORDER_EXECUTION_QUEUE,
  SWEEP_LIMIT_ORDERS_JOB,
} from './order-queue.constants';
import { closeQueueQuietly, isRecoverableQueueError } from './queue-recovery.util';

export interface QueueMetricsSnapshot {
  name: string;
  active: number;
  waiting: number;
  delayed: number;
  failed: number;
  completed: number;
}

export interface FailedQueueJobRecord {
  id: string;
  name: string;
  data: Record<string, unknown>;
  attemptsMade: number;
  failedReason: string | null;
  stacktrace: string[];
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
}

export interface RetryAllFailedJobsResult {
  queue: string;
  totalFailed: number;
  retried: number;
  failedToRetry: Array<{
    id: string;
    reason: string;
  }>;
}

@Injectable()
export class OrderQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(OrderQueueService.name);
  private queue: Queue;
  private queueRecoveryPromise?: Promise<void>;

  constructor(private readonly redisService: RedisService) {
    this.queue = this.createQueue();
  }

  async enqueueOrderExecution(orderId: string): Promise<void> {
    await this.withRecoveredQueue((queue) =>
      queue.add(
        EXECUTE_ORDER_JOB,
        { orderId },
        {
          jobId: `order-${orderId}`,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2_000,
          },
        },
      ),
    );
  }

  async enqueueLimitSweep(
    symbol: string,
    options?: {
      delayMs?: number;
      attempts?: number;
    },
  ): Promise<void> {
    const delayMs = options?.delayMs ?? 0;
    const attempts = options?.attempts ?? 3;
    const jobWindow = Math.floor((Date.now() + delayMs) / 1_000);

    await this.withRecoveredQueue((queue) =>
      queue.add(
        SWEEP_LIMIT_ORDERS_JOB,
        { symbol },
        {
          // FIX: Collapse duplicate per-symbol sweeps into a 1s window to avoid Prisma pool exhaustion during quote bursts.
          jobId: `sweep-${symbol}-${jobWindow}`,
          delay: delayMs,
          attempts,
          backoff: {
            type: 'exponential',
            delay: 5_000,
          },
          removeOnComplete: true,
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
      name: ORDER_EXECUTION_QUEUE,
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

  async listFailedJobs(limit = 100): Promise<FailedQueueJobRecord[]> {
    const jobs = await this.withRecoveredQueue((queue) =>
      queue.getFailed(0, Math.max(limit, 1) - 1),
    );

    return jobs.map((job) => ({
      id: String(job.id),
      name: job.name,
      data:
        job.data && typeof job.data === 'object' && !Array.isArray(job.data)
          ? (job.data as Record<string, unknown>)
          : {},
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
      stacktrace: job.stacktrace ?? [],
      timestamp: job.timestamp,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
    }));
  }

  async retryAllFailedJobs(): Promise<RetryAllFailedJobsResult> {
    const jobs = await this.withRecoveredQueue((queue) => queue.getFailed(0, 999));
    const failedToRetry: RetryAllFailedJobsResult['failedToRetry'] = [];
    let retried = 0;

    for (const job of jobs) {
      try {
        await job.retry();
        retried += 1;
      } catch (error) {
        failedToRetry.push({
          id: String(job.id),
          reason: error instanceof Error ? error.message : 'Retry failed',
        });
      }
    }

    return {
      queue: ORDER_EXECUTION_QUEUE,
      totalFailed: jobs.length,
      retried,
      failedToRetry,
    };
  }

  private createQueue(): Queue {
    const queue = new Queue(ORDER_EXECUTION_QUEUE, {
      connection: this.redisService.getClient(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });

    queue.on('error', (error) => {
      this.logger.error(`Order queue connection error: ${error.message}`);
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
      this.logger.warn('Order queue connection closed. Recreating queue instance.');
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

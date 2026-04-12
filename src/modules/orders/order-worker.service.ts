import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';

import {
  EXECUTE_ORDER_JOB,
  ORDER_EXECUTION_QUEUE,
  SWEEP_LIMIT_ORDERS_JOB,
} from '../../common/queue/order-queue.constants';
import { OrderQueueService } from '../../common/queue/order-queue.service';
import { RedisService } from '../../common/redis/redis.service';
import { OrdersService } from './orders.service';

function isTransientWorkerError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P1001', 'P1017', 'P2024'].includes(error.code)
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Can't reach database server") ||
    message.includes('Timed out fetching a new connection from the connection pool')
  );
}

@Injectable()
export class OrderWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderWorkerService.name);
  private worker?: Worker;
  private workerConnection?: Redis;

  constructor(
    private readonly redisService: RedisService,
    private readonly ordersService: OrdersService,
    private readonly orderQueueService: OrderQueueService,
  ) {}

  onModuleInit(): void {
    this.workerConnection = this.redisService.createDuplicateConnection('order-worker');
    this.worker = new Worker(
      ORDER_EXECUTION_QUEUE,
      async (job: Job) => {
        try {
          if (job.name === EXECUTE_ORDER_JOB) {
            await this.ordersService.processOrderExecution(job.data.orderId as string);
            return;
          }

          if (job.name === SWEEP_LIMIT_ORDERS_JOB) {
            await this.ordersService.processLimitSweep(job.data.symbol as string);
            return;
          }

          this.logger.warn(`Unknown order queue job received: ${job.name}`);
        } catch (error) {
          if (
            job.name === SWEEP_LIMIT_ORDERS_JOB &&
            isTransientWorkerError(error)
          ) {
            const symbol = String(job.data.symbol ?? 'unknown');
            const reason = error instanceof Error ? error.message : String(error);

            // FIX: Transient Prisma outages should reschedule limit sweeps instead of creating permanent failed jobs.
            await this.orderQueueService.enqueueLimitSweep(symbol, {
              delayMs: 30_000,
              attempts: 3,
            });
            this.logger.warn(
              `Transient limit sweep failure for ${symbol}; rescheduled retry in 30000ms: ${reason}`,
            );
            return;
          }

          throw error;
        }
      },
      {
        connection: this.workerConnection,
        concurrency: 20,
      },
    );

    this.worker.on('failed', (job, error) => {
      const payload =
        job?.data && typeof job.data === 'object' && !Array.isArray(job.data)
          ? JSON.stringify(job.data)
          : '{}';
      this.logger.error(
        `Queue job failed (${job?.name ?? 'unknown'}:${job?.id ?? 'unknown'}) attempt ${job?.attemptsMade ?? 0}/${job?.opts.attempts ?? 1} payload=${payload}: ${error.message}`,
      );
    });
    this.worker.on('error', (error) => {
      this.logger.error(`Order worker connection error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }

    if (this.workerConnection) {
      await this.workerConnection.quit();
    }
  }
}

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';

import { RedisService } from '../../common/redis/redis.service';
import {
  COPY_MASTER_CLOSE_JOB,
  COPY_MASTER_OPEN_JOB,
  COPY_TRADING_QUEUE,
} from './copy-trading.constants';
import { CopyTradingService } from './copy-trading.service';

@Injectable()
export class CopyTradingWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopyTradingWorkerService.name);
  private worker?: Worker;
  private workerConnection?: Redis;

  constructor(
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => CopyTradingService))
    private readonly copyTradingService: CopyTradingService,
  ) {}

  onModuleInit(): void {
    this.workerConnection = this.redisService.createDuplicateConnection(
      'copy-trading-worker',
    );
    this.worker = new Worker(
      COPY_TRADING_QUEUE,
      async (job: Job) => {
        if (job.name === COPY_MASTER_OPEN_JOB) {
          await this.copyTradingService.processMasterOpen(job.data.positionId as string);
          return;
        }

        if (job.name === COPY_MASTER_CLOSE_JOB) {
          await this.copyTradingService.processMasterClose(job.data.positionId as string);
        }
      },
      {
        connection: this.workerConnection,
        concurrency: 10,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Copy trading job failed (${job?.name ?? 'unknown'}): ${error.message}`);
    });
    this.worker.on('error', (error) => {
      this.logger.error(`Copy trading worker connection error: ${error.message}`);
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

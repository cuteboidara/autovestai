import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { CopyTradingService } from './copy-trading.service';

const STATS_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class CopyTradingStatsCron implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopyTradingStatsCron.name);
  private refreshInterval?: NodeJS.Timeout;

  constructor(private readonly copyTradingService: CopyTradingService) {}

  onModuleInit(): void {
    this.refreshInterval = setInterval(() => {
      void this.run();
    }, STATS_REFRESH_INTERVAL_MS);

    void this.run();
  }

  onModuleDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  private async run() {
    try {
      await this.copyTradingService.refreshAllProviderStats();
    } catch (error) {
      this.logger.error(
        `Signal provider stats refresh failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DealingDeskService } from './dealing-desk.service';

@Injectable()
export class DealingDeskMonitorService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(private readonly dealingDeskService: DealingDeskService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.dealingDeskService.refreshAllExposure();
    }, 5000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

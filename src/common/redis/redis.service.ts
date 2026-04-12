import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redisUrl: string;
  private readonly redisOptions: RedisOptions;
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redisUrl =
      this.configService.get<string>('redis.url')?.trim() || 'redis://localhost:6379';
    this.redisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 5_000,
      retryStrategy: (attempt) => Math.min(Math.max(attempt, 1) * 1_000, 5_000),
    };
    this.client = this.createClient('primary');
  }

  getClient(): Redis {
    return this.client;
  }

  createDuplicateConnection(connectionLabel = 'worker'): Redis {
    return this.createClient(connectionLabel);
  }

  getRedisUrl(): string {
    return this.redisUrl;
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeClient(this.client);
  }

  private createClient(connectionLabel: string): Redis {
    const client = new Redis(this.redisUrl, this.redisOptions);

    client.on('error', (error) => {
      this.logger.error(
        `Redis ${connectionLabel} connection error at ${this.redisUrl}: ${error.message}`,
      );
    });
    client.on('reconnecting', (delay: number) => {
      this.logger.warn(
        `Redis ${connectionLabel} reconnect scheduled in ${delay}ms for ${this.redisUrl}`,
      );
    });
    client.on('ready', () => {
      this.logger.log(`Redis ${connectionLabel} connection ready at ${this.redisUrl}`);
    });

    return client;
  }

  private async closeClient(client: Redis): Promise<void> {
    if (client.status === 'end') {
      return;
    }

    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}

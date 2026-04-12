import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';

@Injectable()
export class ResponseCacheService {
  private readonly logger = new Logger(ResponseCacheService.name);

  constructor(private readonly redisService: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redisService.getClient().get(key);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.warn(
        `Failed to parse cached response for key ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.redisService.getClient().del(key);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redisService
      .getClient()
      .set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async invalidateUserResources(userId: string, resources: string[]): Promise<void> {
    await this.deleteByPatterns(
      resources.map((resource) => `response-cache:${resource}:user:${userId}:*`),
    );
  }

  async invalidateAccountResources(
    userId: string,
    accountId: string,
    resources: string[],
  ): Promise<void> {
    await this.deleteByPatterns([
      ...resources.map(
        (resource) => `response-cache:${resource}:user:${userId}:account:${accountId}:*`,
      ),
      ...resources.map(
        (resource) => `response-cache:${resource}:user:${userId}:account:default:*`,
      ),
      ...resources.map((resource) => `response-cache:${resource}:user:${userId}:*`),
    ]);
  }

  async invalidatePublicResource(resource: string): Promise<void> {
    await this.deleteByPatterns([`response-cache:${resource}:public:*`]);
  }

  private async deleteByPatterns(patterns: string[]): Promise<void> {
    const client = this.redisService.getClient();
    const keys = new Set<string>();

    for (const pattern of patterns) {
      let cursor = '0';

      do {
        const [nextCursor, matched] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        matched.forEach((key) => keys.add(key));
      } while (cursor !== '0');
    }

    if (keys.size > 0) {
      await client.del([...keys]);
    }
  }
}

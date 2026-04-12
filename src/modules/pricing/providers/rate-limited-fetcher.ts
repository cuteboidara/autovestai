import { Injectable, Logger } from '@nestjs/common';

interface FetchOptions {
  headers?: HeadersInit;
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

@Injectable()
export class RateLimitedFetcher {
  private readonly logger = new Logger(RateLimitedFetcher.name);
  private readonly queue: Array<() => void> = [];
  private readonly maxConcurrent = 2;
  private readonly minDelayMs = 1_000;
  private readonly defaultRetryDelayMs = 10_000;
  private readonly defaultTimeoutMs = 12_000;
  private running = 0;
  private nextSlotAt = 0;

  async fetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
    const response = await this.fetchResponse(url, options);
    return (await response.json()) as T;
  }

  async fetchText(url: string, options?: FetchOptions): Promise<string> {
    const response = await this.fetchResponse(url, options);
    return response.text();
  }

  private async fetchResponse(
    url: string,
    options?: FetchOptions,
  ): Promise<Response> {
    return this.enqueue(async () => {
      const retries = options?.retries ?? 1;
      const retryDelayMs = options?.retryDelayMs ?? this.defaultRetryDelayMs;
      const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            headers: {
              accept: 'application/json,text/plain,*/*',
              'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              ...options?.headers,
            },
            signal: controller.signal,
          });

          if (response.status === 429) {
            this.logger.warn(`Rate limit hit for ${url}. Retrying in ${retryDelayMs}ms.`);

            if (attempt >= retries) {
              throw new Error(`HTTP 429 for ${url}`);
            }

            await this.delay(retryDelayMs);
            continue;
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status} for ${url}`);
          }

          return response;
        } finally {
          clearTimeout(timer);
        }
      }

      throw new Error(`Unable to fetch ${url}`);
    });
  }

  private async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        void this.runTask(task, resolve, reject);
      });
      this.drainQueue();
    });
  }

  private async runTask<T>(
    task: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (reason?: unknown) => void,
  ) {
    const delayMs = this.reserveStartDelay();

    if (delayMs > 0) {
      await this.delay(delayMs);
    }

    this.running += 1;

    try {
      resolve(await task());
    } catch (error) {
      reject(error);
    } finally {
      this.running -= 1;
      this.drainQueue();
    }
  }

  private reserveStartDelay() {
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextSlotAt);
    this.nextSlotAt = scheduledAt + this.minDelayMs;
    return Math.max(scheduledAt - now, 0);
  }

  private drainQueue() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();

      if (!next) {
        return;
      }

      next();
    }
  }

  private async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

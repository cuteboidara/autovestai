import { Logger } from '@nestjs/common';

const logger = new Logger('DiskFullCircuitBreaker');

/**
 * Global circuit breaker that trips when PostgreSQL returns error code 53100
 * (insufficient_disk_space). Once tripped, all non-critical DB writes
 * (candles, exposure snapshots) are skipped until the process restarts.
 */
let tripped = false;

export function isDiskFullCircuitOpen(): boolean {
  return tripped;
}

/**
 * Inspect an error thrown by Prisma / pg and trip the breaker if it is
 * the "disk full" error (PG 53100). Returns true if the breaker was
 * just tripped (so the caller can decide whether to log).
 */
export function checkDiskFullError(error: unknown): boolean {
  if (tripped) {
    return false; // already tripped — no need to log again
  }

  const code =
    (error as { code?: string })?.code ??
    (error as { meta?: { code?: string } })?.meta?.code;

  if (code === '53100' || code === 'P2028') {
    tripped = true;
    logger.warn(
      'Database disk full (PG 53100) — circuit breaker OPEN. ' +
        'All candle and exposure snapshot writes are suspended until restart.',
    );
    return true;
  }

  return false;
}

import { Queue } from 'bullmq';

const RECOVERABLE_QUEUE_ERROR_PATTERNS = [
  /connection is closed/i,
  /connection closed/i,
  /connection is closing/i,
  /the client is closed/i,
];

export function isRecoverableQueueError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return RECOVERABLE_QUEUE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export async function closeQueueQuietly(queue?: Queue): Promise<void> {
  if (!queue) {
    return;
  }

  try {
    await queue.close();
  } catch {
    // Ignore close failures during recovery and shutdown.
  }
}

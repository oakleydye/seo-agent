import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries?: number;       // default 5
  baseDelayMs?: number;      // default 1000
  maxDelayMs?: number;       // default 60_000
  onRetry?: (attempt: number, waitMs: number, error: unknown) => void;
}

/**
 * Wraps an async function with exponential backoff retry logic.
 * Only retries on HTTP 429 (rate-limited) errors.
 * All other errors are thrown immediately without retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 60_000;

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as { status?: number; code?: number };
      const isRateLimited = err?.status === 429 || err?.code === 429;

      if (!isRateLimited || attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const exponentialMs = baseDelayMs * Math.pow(2, attempt);
      const jitterMs = Math.random() * baseDelayMs;
      const waitMs = Math.min(exponentialMs + jitterMs, maxDelayMs);

      logger.warn(
        { attempt: attempt + 1, maxRetries, waitMs: Math.round(waitMs) },
        'Rate limited — retrying with backoff',
      );

      options.onRetry?.(attempt + 1, waitMs, error);

      await new Promise<void>(r => setTimeout(r, waitMs));
      attempt++;
    }
  }

  // Unreachable but satisfies TypeScript
  throw new Error('withRetry: exhausted retries');
}

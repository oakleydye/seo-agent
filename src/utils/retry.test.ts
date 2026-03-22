import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry } from './retry.js';

describe('withRetry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately on first success (no retries)', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries when fn throws error with status 429', async () => {
    vi.useFakeTimers();
    const error429 = { status: 429, message: 'Rate limited' };
    const fn = vi.fn()
      .mockRejectedValueOnce(error429)
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('eventual-success');

    const promise = withRetry(fn, { maxRetries: 5, baseDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('eventual-success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries when fn throws error with code 429', async () => {
    vi.useFakeTimers();
    const error429 = { code: 429, message: 'Rate limited' };
    const fn = vi.fn()
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('success');

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after maxRetries exhausted (all 429s)', async () => {
    vi.useFakeTimers();
    const error429 = { status: 429, message: 'Rate limited' };
    const fn = vi.fn().mockRejectedValue(error429);

    const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 100 });
    // Attach rejection handler before running timers to avoid unhandled rejection
    const rejection = expect(promise).rejects.toEqual(error429);
    await vi.runAllTimersAsync();
    await rejection;
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does NOT retry on non-429 errors (throws immediately)', async () => {
    const error500 = { status: 500, message: 'Server error' };
    const fn = vi.fn().mockRejectedValue(error500);

    await expect(withRetry(fn, { maxRetries: 5 })).rejects.toEqual(error500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on generic errors', async () => {
    const error = new Error('Network failure');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 5 })).rejects.toThrow('Network failure');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry callback with attempt number and waitMs', async () => {
    vi.useFakeTimers();
    const error429 = { status: 429 };
    const fn = vi.fn()
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('done');

    const onRetry = vi.fn();
    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 1000, onRetry });
    await vi.runAllTimersAsync();
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    const [attempt, waitMs] = onRetry.mock.calls[0] as [number, number, unknown];
    expect(attempt).toBe(1);
    expect(waitMs).toBeGreaterThan(0);
  });

  it('waitMs approximately doubles each attempt (exponential backoff)', async () => {
    vi.useFakeTimers();
    const error429 = { status: 429 };
    const fn = vi.fn()
      .mockRejectedValueOnce(error429)
      .mockRejectedValueOnce(error429)
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('done');

    const waitTimes: number[] = [];
    const onRetry = vi.fn((_attempt: number, waitMs: number) => {
      waitTimes.push(waitMs);
    });

    const promise = withRetry(fn, { maxRetries: 5, baseDelayMs: 1000, onRetry });
    await vi.runAllTimersAsync();
    await promise;

    // Each wait should be roughly double the previous (base 1000ms)
    // attempt 0: ~1000ms + jitter, attempt 1: ~2000ms + jitter, attempt 2: ~4000ms + jitter
    expect(waitTimes).toHaveLength(3);
    expect(waitTimes[1]).toBeGreaterThan(waitTimes[0]!);
    expect(waitTimes[2]).toBeGreaterThan(waitTimes[1]!);
  });

  it('caps waitMs at maxDelayMs (60000ms default)', async () => {
    vi.useFakeTimers();
    const error429 = { status: 429 };
    const fn = vi.fn()
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('done');

    const onRetry = vi.fn();
    const promise = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100_000, // very high base to trigger cap
      maxDelayMs: 60_000,
      onRetry,
    });
    await vi.runAllTimersAsync();
    await promise;

    const [, waitMs] = onRetry.mock.calls[0] as [number, number, unknown];
    expect(waitMs).toBeLessThanOrEqual(60_000);
  });
});

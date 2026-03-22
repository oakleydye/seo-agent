import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ApiCache } from './cache.js';

describe('ApiCache', () => {
  let cache: ApiCache<string>;

  beforeEach(() => {
    cache = new ApiCache<string>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for unknown keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves a value within TTL', () => {
    cache.set('key1', 'value1', 60_000);
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns undefined after TTL expires', async () => {
    vi.useFakeTimers();
    cache.set('expiring', 'will-expire', 1000);
    expect(cache.get('expiring')).toBe('will-expire');
    await vi.advanceTimersByTimeAsync(1001);
    expect(cache.get('expiring')).toBeUndefined();
  });

  it('delete removes a specific entry', () => {
    cache.set('key-to-delete', 'value', 60_000);
    expect(cache.get('key-to-delete')).toBe('value');
    cache.delete('key-to-delete');
    expect(cache.get('key-to-delete')).toBeUndefined();
  });

  it('clear removes all entries', () => {
    cache.set('a', 'valueA', 60_000);
    cache.set('b', 'valueB', 60_000);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('size returns count of non-expired entries', async () => {
    vi.useFakeTimers();
    cache.set('long-lived', 'value', 120_000);
    cache.set('short-lived', 'value', 500);
    expect(cache.size()).toBe(2);
    await vi.advanceTimersByTimeAsync(600);
    expect(cache.size()).toBe(1);
  });

  it('size returns 0 for empty cache', () => {
    expect(cache.size()).toBe(0);
  });

  it('overwrites existing entry on re-set', () => {
    cache.set('key', 'old', 60_000);
    cache.set('key', 'new', 60_000);
    expect(cache.get('key')).toBe('new');
  });
});

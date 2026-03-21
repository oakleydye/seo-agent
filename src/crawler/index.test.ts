import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crawl } from './index.js';

// Mock node-fetch to avoid real network calls
vi.mock('node-fetch', () => {
  const mockFetch = vi.fn();
  return { default: mockFetch };
});

// Mock robots module to simplify tests
vi.mock('./robots.js', () => ({
  fetchRobotRules: vi.fn().mockResolvedValue({ disallowedPaths: [] }),
  isUrlAllowed: vi.fn().mockReturnValue(true),
}));

import fetch from 'node-fetch';
import { isUrlAllowed } from './robots.js';

const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
const mockIsAllowed = isUrlAllowed as unknown as ReturnType<typeof vi.fn>;

function makeResponse(status: number, body: string, headers: Record<string, string> = {}) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    text: () => Promise.resolve(body),
  });
}

describe('crawl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAllowed.mockReturnValue(true);
  });

  it('returns PageData for each fetched page', async () => {
    mockFetch.mockImplementation(() =>
      makeResponse(200, '<html><head><title>Test</title></head><body></body></html>')
    );

    const results = await crawl('https://example.com', { maxPages: 1, maxDepth: 0 });
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe('https://example.com/');
    expect(results[0]!.statusCode).toBe(200);
    expect(results[0]!.html).toContain('<title>Test</title>');
    expect(results[0]!.fetchedAt).toBeInstanceOf(Date);
    expect(results[0]!.redirectChain).toEqual([]);
  });

  it('stops crawling when maxPages is reached', async () => {
    mockFetch.mockImplementation(() =>
      makeResponse(200, '<html><body><a href="/page1">p1</a><a href="/page2">p2</a></body></html>')
    );

    const results = await crawl('https://example.com', { maxPages: 2, maxDepth: 1 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('records 404 statusCode for not found pages', async () => {
    mockFetch.mockImplementation(() => makeResponse(404, ''));

    const results = await crawl('https://example.com', { maxPages: 1, maxDepth: 0 });
    expect(results[0]!.statusCode).toBe(404);
    expect(results[0]!.html).toBe('');
  });

  it('skips disallowed URLs when respectRobotsTxt is true', async () => {
    mockIsAllowed.mockReturnValueOnce(false); // first URL is disallowed
    mockFetch.mockImplementation(() => makeResponse(200, '<html></html>'));

    const results = await crawl('https://example.com', { maxPages: 5, maxDepth: 0, respectRobotsTxt: true });
    expect(results).toHaveLength(0); // root URL was disallowed
  });

  it('does not visit the same URL twice', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      return makeResponse(200, '<html><body><a href="/">home</a></body></html>');
    });
    mockIsAllowed.mockReturnValue(true);

    await crawl('https://example.com', { maxPages: 10, maxDepth: 2 });
    // Should only fetch root once despite self-link
    expect(callCount).toBe(1);
  });
});

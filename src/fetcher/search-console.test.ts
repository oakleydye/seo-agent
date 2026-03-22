import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock googleapis before importing the module under test
vi.mock('googleapis', () => {
  const mockQuery = vi.fn();
  const MockGoogleAuth = vi.fn().mockImplementation(() => ({}));

  return {
    google: {
      auth: {
        GoogleAuth: MockGoogleAuth,
      },
      searchconsole: vi.fn().mockReturnValue({
        searchanalytics: {
          query: mockQuery,
        },
      }),
    },
    __mockQuery: mockQuery,
  };
});

// Mock withRetry to pass through by default
vi.mock('../utils/retry.js', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

import { google } from 'googleapis';
import { withRetry } from '../utils/retry.js';
import { SearchConsoleClient, createSearchConsoleClient } from './search-console.js';

// Access the internal mock query fn via module augmentation trick
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getMockQuery = () => (google as any).__mockQuery as ReturnType<typeof vi.fn>;

const mockRows = [
  { keys: ['seo optimization'], clicks: 50, impressions: 500, ctr: 0.1, position: 8.5 },
  { keys: ['next.js seo'], clicks: 20, impressions: 200, ctr: 0.1, position: 12.3 },
  { keys: ['low volume keyword'], clicks: 0, impressions: 5, ctr: 0.0, position: 45.0 },
];

describe('SearchConsoleClient', () => {
  let client: SearchConsoleClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-configure the withRetry mock to pass through
    vi.mocked(withRetry).mockImplementation((fn: () => Promise<unknown>) => fn());
    client = new SearchConsoleClient('/fake/service-account.json');
  });

  it('returns keyword opportunities with correct scoring', async () => {
    getMockQuery().mockResolvedValueOnce({ data: { rows: mockRows } });

    const results = await client.queryKeywords('https://example.com');

    expect(results).toHaveLength(2); // low volume keyword filtered out
    // Verify opportunityScore = impressions * (1 - ctr)
    const seoOpt = results.find(r => r.keyword === 'seo optimization');
    expect(seoOpt).toBeDefined();
    expect(seoOpt!.opportunityScore).toBeCloseTo(500 * (1 - 0.1)); // 450
  });

  it('filters keywords with impressions < 10 (default minImpressions)', async () => {
    getMockQuery().mockResolvedValueOnce({ data: { rows: mockRows } });

    const results = await client.queryKeywords('https://example.com');

    const keywords = results.map(r => r.keyword);
    expect(keywords).not.toContain('low volume keyword');
    expect(keywords).toContain('seo optimization');
    expect(keywords).toContain('next.js seo');
  });

  it('respects custom minImpressions threshold', async () => {
    getMockQuery().mockResolvedValueOnce({
      data: {
        rows: [
          { keys: ['keyword a'], clicks: 5, impressions: 300, ctr: 0.02, position: 20 },
          { keys: ['keyword b'], clicks: 0, impressions: 8, ctr: 0.0, position: 50 },
        ],
      },
    });

    const results = await client.queryKeywords('https://example.com', { minImpressions: 15 });

    expect(results).toHaveLength(1);
    expect(results[0]!.keyword).toBe('keyword a');
  });

  it('sorts keywords by opportunityScore descending', async () => {
    getMockQuery().mockResolvedValueOnce({ data: { rows: mockRows } });

    const results = await client.queryKeywords('https://example.com');

    // seo optimization: 500 * (1 - 0.1) = 450
    // next.js seo: 200 * (1 - 0.1) = 180
    expect(results[0]!.keyword).toBe('seo optimization');
    expect(results[1]!.keyword).toBe('next.js seo');
    expect(results[0]!.opportunityScore).toBeGreaterThan(results[1]!.opportunityScore);
  });

  it('returns cached response on second call without making an API call', async () => {
    getMockQuery().mockResolvedValue({ data: { rows: mockRows } });

    const first = await client.queryKeywords('https://example.com');
    const second = await client.queryKeywords('https://example.com');

    expect(getMockQuery()).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('makes separate API calls for different siteUrls', async () => {
    getMockQuery().mockResolvedValue({ data: { rows: mockRows } });

    await client.queryKeywords('https://site-a.com');
    await client.queryKeywords('https://site-b.com');

    expect(getMockQuery()).toHaveBeenCalledTimes(2);
  });

  it('calls withRetry wrapping the GSC API call', async () => {
    getMockQuery().mockResolvedValueOnce({ data: { rows: [] } });

    await client.queryKeywords('https://example.com');

    expect(withRetry).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 60_000,
      }),
    );
  });

  it('returns empty array when API returns no rows', async () => {
    getMockQuery().mockResolvedValueOnce({ data: { rows: undefined } });

    const results = await client.queryKeywords('https://example.com');

    expect(results).toEqual([]);
  });

  it('returns empty array when API returns empty rows array', async () => {
    getMockQuery().mockResolvedValueOnce({ data: { rows: [] } });

    const results = await client.queryKeywords('https://example.com');

    expect(results).toEqual([]);
  });

  it('filters out keywords with empty key string', async () => {
    getMockQuery().mockResolvedValueOnce({
      data: {
        rows: [
          { keys: [''], clicks: 10, impressions: 100, ctr: 0.1, position: 5 },
          { keys: ['valid keyword'], clicks: 5, impressions: 50, ctr: 0.1, position: 10 },
        ],
      },
    });

    const results = await client.queryKeywords('https://example.com');

    expect(results).toHaveLength(1);
    expect(results[0]!.keyword).toBe('valid keyword');
  });

  it('computes all KeywordOpportunity fields correctly', async () => {
    getMockQuery().mockResolvedValueOnce({
      data: {
        rows: [{ keys: ['test keyword'], clicks: 30, impressions: 300, ctr: 0.1, position: 5.7 }],
      },
    });

    const results = await client.queryKeywords('https://example.com');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      keyword: 'test keyword',
      clicks: 30,
      impressions: 300,
      ctr: 0.1,
      position: 5.7,
      opportunityScore: 300 * (1 - 0.1),
    });
  });
});

describe('createSearchConsoleClient', () => {
  it('returns a SearchConsoleClient instance', () => {
    const client = createSearchConsoleClient('/path/to/creds.json');
    expect(client).toBeInstanceOf(SearchConsoleClient);
  });
});

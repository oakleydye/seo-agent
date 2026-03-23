import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeCosineSimilarity,
  fetchTopSerpResults,
  checkOriginality,
} from './plagiarism-checker.js';

// ---------------------------------------------------------------------------
// Mock googleapis
// ---------------------------------------------------------------------------
const mockCseList = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    customsearch: () => ({
      cse: {
        list: mockCseList,
      },
    }),
  },
}));

// ---------------------------------------------------------------------------
// Mock fetch (used by fetchAndExtractText)
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSerpResponse(items: { link: string; title: string }[]) {
  return {
    data: {
      items: items.map(i => ({ link: i.link, title: i.title })),
    },
  };
}

const SERP_ITEMS = [
  { link: 'https://example.com/1', title: 'Result 1' },
  { link: 'https://example.com/2', title: 'Result 2' },
  { link: 'https://example.com/3', title: 'Result 3' },
  { link: 'https://example.com/4', title: 'Result 4' },
  { link: 'https://example.com/5', title: 'Result 5' },
];

function mockFetchHtml(html: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(html),
  });
}

// Build a long text with repeated words to create detectable TF-IDF similarity
function repeatText(text: string, times: number): string {
  return Array.from({ length: times }, () => text).join(' ');
}

describe('plagiarism-checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level serpCache between tests by resetting mocks
  });

  describe('computeCosineSimilarity', () => {
    it('returns 0 for orthogonal vectors', () => {
      expect(computeCosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
    });

    it('returns 1.0 for identical non-zero vectors', () => {
      expect(computeCosineSimilarity([1, 1, 0], [1, 1, 0])).toBeCloseTo(1.0, 5);
    });

    it('returns 0 for empty vectors', () => {
      expect(computeCosineSimilarity([], [])).toBe(0);
    });

    it('returns 0 when one vector is all zeros', () => {
      expect(computeCosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    });
  });

  describe('fetchTopSerpResults', () => {
    it('calls googleapis once for two calls with same keyword (cache hit on second)', async () => {
      mockCseList.mockResolvedValue(makeSerpResponse(SERP_ITEMS));

      const r1 = await fetchTopSerpResults('cache test keyword', 'cse-id', 'api-key');
      const r2 = await fetchTopSerpResults('cache test keyword', 'cse-id', 'api-key');

      expect(mockCseList).toHaveBeenCalledTimes(1);
      expect(r1).toEqual(r2);
      expect(r1.urls).toHaveLength(5);
    });

    it('returns empty arrays when API returns no items', async () => {
      mockCseList.mockResolvedValue({ data: { items: null } });

      const result = await fetchTopSerpResults('no results keyword', 'cse-id', 'api-key');
      expect(result.urls).toHaveLength(0);
      expect(result.titles).toHaveLength(0);
    });
  });

  describe('checkOriginality', () => {
    it('returns score 100 and passedThreshold=true when SERP returns no URLs', async () => {
      mockCseList.mockResolvedValue({ data: { items: [] } });

      const result = await checkOriginality(
        'some generated content',
        'empty serp keyword',
        'cse-id',
        'api-key',
      );

      expect(result.score).toBe(100);
      expect(result.passedThreshold).toBe(true);
    });

    it('returns low originality score when SERP text is very similar to post', async () => {
      const sharedText = repeatText(
        'page speed performance optimization lighthouse core web vitals render blocking resources',
        40,
      );
      mockCseList.mockResolvedValue(makeSerpResponse([SERP_ITEMS[0]!]));
      mockFetchHtml(`<html><body><p>${sharedText}</p></body></html>`);

      const result = await checkOriginality(sharedText, 'page speed', 'cse-id', 'api-key');

      // Same text → very high similarity → low originality score
      expect(result.score).toBeLessThan(30);
      expect(result.passedThreshold).toBe(false);
    });

    it('returns high originality score when SERP text is unrelated to post', async () => {
      const postText = repeatText(
        'javascript async await promises concurrency event loop microtask queue',
        30,
      );
      const serpText = repeatText(
        'baking sourdough bread flour yeast hydration fermentation crumb structure',
        30,
      );
      mockCseList.mockResolvedValue(makeSerpResponse([SERP_ITEMS[0]!]));
      mockFetchHtml(`<html><body><p>${serpText}</p></body></html>`);

      const result = await checkOriginality(postText, 'javascript async', 'cse-id', 'api-key');

      expect(result.score).toBeGreaterThan(70);
      expect(result.passedThreshold).toBe(true);
    });
  });
});

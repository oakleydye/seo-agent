import { describe, it, expect, vi } from 'vitest';
import { fetchCoreWebVitals } from './pagespeed.js';

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

import fetch from 'node-fetch';
const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;

function makeApiResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

const mockPSIResponse = {
  lighthouseResult: {
    categories: {
      performance: { score: 0.72 },
    },
    audits: {
      'largest-contentful-paint': { numericValue: 2800 },
      'max-potential-fid': { numericValue: 120 },
      'cumulative-layout-shift': { numericValue: 0.08 },
      'first-contentful-paint': { numericValue: 1500 },
      'server-response-time': { numericValue: 350 },
    },
  },
};

describe('fetchCoreWebVitals', () => {
  it('calls PageSpeed Insights API URL', async () => {
    mockFetch.mockImplementation(() => makeApiResponse(mockPSIResponse));
    await fetchCoreWebVitals('https://example.com', 'test-key');
    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('googleapis.com/pagespeedonline/v5/runPagespeed');
    expect(calledUrl).toContain(encodeURIComponent('https://example.com'));
  });

  it('returns CoreWebVitals with parsed metrics', async () => {
    mockFetch.mockImplementation(() => makeApiResponse(mockPSIResponse));
    const vitals = await fetchCoreWebVitals('https://example.com', 'test-key');
    expect(vitals).not.toBeNull();
    expect(vitals!.lcp).toBe(2800);
    expect(vitals!.performanceScore).toBe(72);
    expect(vitals!.source).toBe('pagespeed-insights');
  });

  it('returns null on 429 quota error without throwing', async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({ ok: false, status: 429 });
    const promise = fetchCoreWebVitals('https://example.com', 'test-key');
    // Advance timers to skip all exponential backoff delays (1s + 2s + 4s = 7s max)
    await vi.runAllTimersAsync();
    const vitals = await promise;
    vi.useRealTimers();
    expect(vitals).toBeNull();
  });

  it('returns null on 403 auth error without throwing', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });
    const vitals = await fetchCoreWebVitals('https://example.com', 'test-key');
    expect(vitals).toBeNull();
  });

  it('returns null when API key is not set', async () => {
    const vitals = await fetchCoreWebVitals('https://example.com', '');
    expect(vitals).toBeNull();
  });
});

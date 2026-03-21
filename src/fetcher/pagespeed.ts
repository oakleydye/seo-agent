import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import type { CoreWebVitals } from '../types/index.js';

const PAGESPEED_API_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// Retry config for quota/rate limiting
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch Core Web Vitals from PageSpeed Insights API v5.
 * Returns null on quota exhaustion, auth errors, or persistent failures.
 * Uses exponential backoff on 429 responses.
 */
export async function fetchCoreWebVitals(
  url: string,
  apiKey: string = process.env['GOOGLE_PAGESPEED_API_KEY'] ?? '',
): Promise<CoreWebVitals | null> {
  if (!apiKey) {
    logger.warn({ url }, 'GOOGLE_PAGESPEED_API_KEY not set — skipping PageSpeed fetch');
    return null;
  }

  const apiUrl = `${PAGESPEED_API_BASE}?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile&category=performance`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await fetch(apiUrl);
    } catch (err) {
      logger.warn({ url, attempt, error: (err as Error).message }, 'PageSpeed fetch network error');
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      return null;
    }

    if (response.status === 429) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      logger.warn({ url, attempt, delayMs: delay }, 'PageSpeed quota rate-limited, backing off');
      await sleep(delay);
      continue;
    }

    if (response.status === 403) {
      logger.error({ url, status: 403 }, 'PageSpeed API auth error — check GOOGLE_PAGESPEED_API_KEY');
      return null;
    }

    if (!response.ok) {
      logger.warn({ url, status: response.status }, 'PageSpeed API returned non-200');
      return null;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      logger.warn({ url }, 'PageSpeed API response is not valid JSON');
      return null;
    }

    return parsePageSpeedResponse(data);
  }

  logger.warn({ url }, 'PageSpeed fetch exhausted retries');
  return null;
}

/**
 * Parse the PageSpeed Insights API v5 response into CoreWebVitals.
 * Handles missing fields gracefully (returns null for each missing metric).
 */
function parsePageSpeedResponse(data: unknown): CoreWebVitals | null {
  if (typeof data !== 'object' || data === null) return null;

  const d = data as Record<string, unknown>;
  const categories = d['lighthouseResult'] as Record<string, unknown> | undefined;
  const audits = (d['lighthouseResult'] as Record<string, unknown> | undefined)?.['audits'] as Record<string, unknown> | undefined;

  function getMetricValue(auditId: string): number | null {
    const audit = audits?.[auditId] as Record<string, unknown> | undefined;
    const val = audit?.['numericValue'];
    return typeof val === 'number' ? Math.round(val) : null;
  }

  function getFloatMetric(auditId: string): number | null {
    const audit = audits?.[auditId] as Record<string, unknown> | undefined;
    const val = audit?.['numericValue'];
    return typeof val === 'number' ? Math.round(val * 1000) / 1000 : null;
  }

  const perfCategory = (categories?.['categories'] as Record<string, unknown> | undefined)?.['performance'] as Record<string, unknown> | undefined;

  const score = typeof perfCategory?.['score'] === 'number'
    ? Math.round((perfCategory['score'] as number) * 100)
    : null;

  return {
    lcp: getMetricValue('largest-contentful-paint'),
    fid: getMetricValue('max-potential-fid'),
    cls: getFloatMetric('cumulative-layout-shift'),
    fcp: getMetricValue('first-contentful-paint'),
    ttfb: getMetricValue('server-response-time'),
    performanceScore: score,
    source: 'pagespeed-insights',
  };
}

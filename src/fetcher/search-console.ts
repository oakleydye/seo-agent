import { google } from 'googleapis';
import { logger } from '../utils/logger.js';
import { ApiCache } from '../utils/cache.js';
import { withRetry } from '../utils/retry.js';
import type { KeywordOpportunity } from '../types/index.js';

// 24h in ms
const MIN_TTL_MS = 24 * 60 * 60 * 1000;
// Additional jitter: 0-24h (spreads cache expiry to avoid thundering herd)
const TTL_JITTER_MS = 24 * 60 * 60 * 1000;

export interface SearchConsoleQueryOptions {
  startDate?: string;      // YYYY-MM-DD, defaults to 28 days ago
  endDate?: string;        // YYYY-MM-DD, defaults to today
  minImpressions?: number; // minimum impressions to include, default 10
}

export class SearchConsoleClient {
  private cache = new ApiCache<KeywordOpportunity[]>();
  private auth: InstanceType<typeof google.auth.GoogleAuth>;

  constructor(private readonly serviceAccountPath: string) {
    this.auth = new google.auth.GoogleAuth({
      keyFilename: serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
  }

  async queryKeywords(
    siteUrl: string,
    options: SearchConsoleQueryOptions = {},
  ): Promise<KeywordOpportunity[]> {
    const today = new Date().toISOString().slice(0, 10);
    const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const startDate = options.startDate ?? twentyEightDaysAgo;
    const endDate = options.endDate ?? today;
    const minImpressions = options.minImpressions ?? 10;

    const cacheKey = `gsc-keywords-${siteUrl}-${startDate}-${endDate}`;

    // Return cached response if available
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug({ siteUrl, cacheKey }, 'Returning cached GSC response');
      return cached;
    }

    logger.info({ siteUrl, startDate, endDate }, 'Querying Google Search Console');

    const rows = await withRetry(
      async () => {
        const searchConsole = google.searchconsole({ version: 'v1', auth: this.auth });
        const response = await searchConsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate,
            endDate,
            dimensions: ['query'],
            rowLimit: 10_000,
          },
        });
        return response.data.rows ?? [];
      },
      {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 60_000,
        onRetry: (attempt, waitMs) => {
          logger.warn({ siteUrl, attempt, waitMs }, 'GSC API rate limited — retrying');
        },
      },
    );

    // Map to KeywordOpportunity, filter by min impressions, score, and sort
    const keywords: KeywordOpportunity[] = rows
      .filter(row => (row.impressions ?? 0) >= minImpressions)
      .map(row => {
        const clicks = row.clicks ?? 0;
        const impressions = row.impressions ?? 0;
        const ctr = row.ctr ?? 0;
        const position = row.position ?? 100;
        const opportunityScore = impressions * (1 - ctr);

        return {
          keyword: (row.keys?.[0] ?? '').trim(),
          clicks,
          impressions,
          ctr,
          position,
          opportunityScore,
        };
      })
      .filter(k => k.keyword.length > 0)
      .sort((a, b) => b.opportunityScore - a.opportunityScore);

    // Cache with 24-48h TTL (randomized to spread expiry across the window)
    const ttlMs = MIN_TTL_MS + Math.random() * TTL_JITTER_MS;
    this.cache.set(cacheKey, keywords, ttlMs);

    logger.info(
      { siteUrl, keywordCount: keywords.length, filtered: rows.length - keywords.length },
      'GSC keywords fetched and scored',
    );
    return keywords;
  }
}

/**
 * Factory function to create a SearchConsoleClient from a service account path.
 */
export function createSearchConsoleClient(serviceAccountPath: string): SearchConsoleClient {
  return new SearchConsoleClient(serviceAccountPath);
}

import * as cheerio from 'cheerio';
import { TfIdf } from 'natural';
import { google } from 'googleapis';
import { logger } from '../utils/logger.js';
import { ApiCache } from '../utils/cache.js';
import type { OriginalityCheck } from '../types/index.js';

// Cache SERP results for 24 hours to respect Google CSE free tier limits
const serpCache = new ApiCache<{ urls: string[]; titles: string[] }>();
const SERP_CACHE_TTL_MS = 86_400_000; // 24 hours

export interface SerpResults {
  urls: string[];
  titles: string[];
}

/**
 * Fetch top 5 Google SERP results for a keyword via Google Custom Search API.
 * Results are cached for 24 hours (SERP_CACHE_TTL_MS) using the keyword as cache key.
 */
export async function fetchTopSerpResults(
  keyword: string,
  cseId: string,
  googleApiKey: string,
): Promise<SerpResults> {
  const cacheKey = `serp:${keyword}`;
  const cached = serpCache.get(cacheKey);
  if (cached) {
    logger.debug({ keyword }, 'SERP results served from cache');
    return cached;
  }

  const customsearch = google.customsearch('v1');
  const response = await customsearch.cse.list({
    q: keyword,
    cx: cseId,
    auth: googleApiKey,
    num: 5,
  });

  const items = response.data.items ?? [];
  const result: SerpResults = {
    urls: items.map((item: { link?: string | null }) => item.link ?? '').filter(Boolean),
    titles: items.map((item: { title?: string | null }) => item.title ?? ''),
  };

  serpCache.set(cacheKey, result, SERP_CACHE_TTL_MS);
  logger.info({ keyword, resultCount: result.urls.length }, 'SERP results fetched');
  return result;
}

/**
 * Fetch a URL and extract its visible text content using cheerio.
 * Returns empty string on fetch failure (non-fatal — other URLs still compared).
 */
export async function fetchAndExtractText(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAgent/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return '';
    const html = await resp.text();
    const $ = cheerio.load(html);
    return $('p, h1, h2, h3, h4, li')
      .map((_: number, el: unknown) => $(el as Parameters<typeof $>[0]).text())
      .get()
      .join(' ')
      .trim();
  } catch (err) {
    logger.warn(
      { url, error: (err as Error).message },
      'Failed to fetch SERP URL for text extraction',
    );
    return '';
  }
}

/**
 * Compute cosine similarity between two TF-IDF term vectors.
 * Returns 0 for zero vectors (no shared vocabulary = no similarity).
 */
export function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecB.length === 0) return 0;
  const dot = vecA.reduce((sum, a, i) => sum + a * (vecB[i] ?? 0), 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/**
 * Check the originality of a generated blog post against the top 5 SERP results.
 *
 * Algorithm:
 * 1. Fetch top 5 SERP URLs for the keyword (cached 24h)
 * 2. Extract text from each SERP page
 * 3. Build TF-IDF vectors for post + each SERP text
 * 4. Compute cosine similarity: post vs. each SERP result
 * 5. Take the MAXIMUM similarity (most similar competitor)
 * 6. Originality score = (1 - maxSimilarity) * 100
 * 7. Passes if score > 70
 */
export async function checkOriginality(
  generatedPost: string,
  keyword: string,
  cseId: string,
  googleApiKey?: string,
  attempts: number = 1,
): Promise<OriginalityCheck> {
  const apiKey = googleApiKey ?? process.env['GOOGLE_API_KEY'] ?? '';

  logger.info({ keyword, attempts }, 'Running originality check');

  const serpResults = await fetchTopSerpResults(keyword, cseId, apiKey);

  if (serpResults.urls.length === 0) {
    logger.warn(
      { keyword },
      'No SERP results found — skipping originality check, treating as original',
    );
    return { score: 100, comparedSources: [], passedThreshold: true, attempts };
  }

  // Fetch text from each SERP URL (failures return empty string, non-fatal)
  const serpTexts = await Promise.all(serpResults.urls.map(url => fetchAndExtractText(url)));
  const validTexts = serpTexts.filter(t => t.length > 100);

  if (validTexts.length === 0) {
    logger.warn({ keyword }, 'Could not extract text from any SERP results — treating as original');
    return { score: 100, comparedSources: serpResults.urls, passedThreshold: true, attempts };
  }

  // Build TF-IDF model: doc 0 = generated post, docs 1..N = SERP results
  const tfidf = new TfIdf();
  tfidf.addDocument(generatedPost);
  validTexts.forEach(text => tfidf.addDocument(text));

  // Gather all terms across all documents to build consistent vectors
  const allTerms = new Set<string>();
  tfidf.documents.forEach((doc: Record<string, number>) => {
    Object.keys(doc).forEach(term => {
      if (term !== '__key') allTerms.add(term);
    });
  });
  const terms = Array.from(allTerms);

  // Build numeric vector for post (doc 0)
  const postVector = terms.map(term => tfidf.tfidf(term, 0));
  let maxSimilarity = 0;

  for (let i = 1; i < tfidf.documents.length; i++) {
    const serpVector = terms.map(term => tfidf.tfidf(term, i));
    const similarity = computeCosineSimilarity(postVector, serpVector);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  const score = Math.round((1 - maxSimilarity) * 100);
  const passedThreshold = score > 70;

  logger.info({ keyword, score, passedThreshold, attempts }, 'Originality check complete');

  return {
    score,
    comparedSources: serpResults.urls,
    passedThreshold,
    attempts,
  };
}

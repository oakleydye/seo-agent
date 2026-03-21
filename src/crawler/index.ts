import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';
import { fetchRobotRules, isUrlAllowed, type RobotRules } from './robots.js';
import type { PageData, CrawlOptions } from '../types/index.js';

const DEFAULT_OPTIONS: CrawlOptions = {
  maxPages: 500,
  maxDepth: 3,
  timeoutMs: 30000,
  respectRobotsTxt: true,
};

const MAX_REDIRECT_HOPS = 5;

/**
 * Normalize a URL: strip trailing slash (except root), remove fragments, lowercase host.
 */
function normalizeUrl(url: string, base?: string): string | null {
  try {
    const parsed = new URL(url, base);
    // Only crawl http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    // Strip fragment
    parsed.hash = '';
    // Remove trailing slash from non-root paths
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extract internal links from an HTML page.
 * Only returns links that share the same origin as rootUrl.
 */
function extractInternalLinks(html: string, pageUrl: string, rootUrl: string): string[] {
  const $ = cheerio.load(html);
  const rootOrigin = new URL(rootUrl).origin;
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const normalized = normalizeUrl(href, pageUrl);
    if (normalized && new URL(normalized).origin === rootOrigin) {
      links.push(normalized);
    }
  });

  return [...new Set(links)];
}

/**
 * Fetch a single URL, following redirects manually to detect loops.
 * Returns the final page data including the redirect chain.
 */
async function fetchPage(
  url: string,
  timeoutMs: number,
): Promise<PageData> {
  const redirectChain: string[] = [];
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    if (redirectChain.includes(currentUrl)) {
      // Redirect loop detected
      logger.warn({ url, redirectChain }, 'Redirect loop detected');
      return {
        url,
        statusCode: 0,
        html: '',
        redirectChain,
        finalUrl: currentUrl,
        fetchedAt: new Date(),
      };
    }

    if (hop > 0) redirectChain.push(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(currentUrl, {
        redirect: 'manual', // manual redirect following to detect loops
        signal: controller.signal as never,
        headers: { 'User-Agent': 'SEOAgent/1.0 (+https://github.com/seo-agent)' },
      });
    } catch (err) {
      clearTimeout(timer);
      logger.warn({ url: currentUrl, error: (err as Error).message }, 'Fetch failed');
      return {
        url,
        statusCode: 0,
        html: '',
        redirectChain,
        finalUrl: currentUrl,
        fetchedAt: new Date(),
      };
    }
    clearTimeout(timer);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) break;
      if (hop > 0) redirectChain.push(currentUrl);
      currentUrl = normalizeUrl(location, currentUrl) ?? location;
      continue;
    }

    const html = response.status >= 200 && response.status < 300
      ? await response.text()
      : '';

    return {
      url,
      statusCode: response.status,
      html,
      redirectChain,
      finalUrl: currentUrl,
      fetchedAt: new Date(),
    };
  }

  // Redirect chain exceeded MAX_REDIRECT_HOPS
  logger.warn({ url, redirectChain, hops: MAX_REDIRECT_HOPS }, 'Redirect chain too long');
  return {
    url,
    statusCode: 0,
    html: '',
    redirectChain,
    finalUrl: currentUrl,
    fetchedAt: new Date(),
  };
}

/**
 * Crawl a website starting from rootUrl.
 * Respects robots.txt, CrawlOptions limits, deduplicates URLs.
 */
export async function crawl(
  rootUrl: string,
  options: Partial<CrawlOptions> = {},
): Promise<PageData[]> {
  const opts: CrawlOptions = { ...DEFAULT_OPTIONS, ...options };
  const normalizedRoot = normalizeUrl(rootUrl);
  if (!normalizedRoot) throw new Error(`Invalid root URL: ${rootUrl}`);

  let robotRules: RobotRules = { disallowedPaths: [] };
  if (opts.respectRobotsTxt) {
    robotRules = await fetchRobotRules(normalizedRoot, opts.timeoutMs);
    logger.info({ disallowedCount: robotRules.disallowedPaths.length }, 'robots.txt loaded');
  }

  const visited = new Set<string>();
  const results: PageData[] = [];
  // Queue entries: [url, depth]
  const queue: Array<[string, number]> = [[normalizedRoot, 0]];

  while (queue.length > 0 && results.length < opts.maxPages) {
    const entry = queue.shift();
    if (!entry) break;
    const [url, depth] = entry;

    if (visited.has(url)) continue;
    visited.add(url);

    if (opts.respectRobotsTxt && !isUrlAllowed(url, robotRules)) {
      logger.debug({ url }, 'Skipping disallowed URL');
      continue;
    }

    logger.debug({ url, depth, pageCount: results.length }, 'Fetching page');
    const pageData = await fetchPage(url, opts.timeoutMs);
    results.push(pageData);

    // Only follow links from successful pages within depth limit
    if (pageData.statusCode === 200 && depth < opts.maxDepth && pageData.html) {
      const links = extractInternalLinks(pageData.html, pageData.finalUrl, normalizedRoot);
      for (const link of links) {
        if (!visited.has(link) && results.length + queue.length < opts.maxPages * 2) {
          queue.push([link, depth + 1]);
        }
      }
    }
  }

  logger.info({ siteUrl: rootUrl, pagesFound: results.length }, 'Crawl complete');
  return results;
}

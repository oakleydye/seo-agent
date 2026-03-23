import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { logger } from '../utils/logger.js';
import type { ContentCalendarEntry } from '../types/index.js';

export function getCalendarPath(siteId: string): string {
  return `.seo-agent/${siteId}/content-calendar.json`;
}

/**
 * Read the content calendar for a site.
 * Returns empty array if the calendar file doesn't exist yet.
 */
export async function getCalendar(siteId: string): Promise<ContentCalendarEntry[]> {
  const path = getCalendarPath(siteId);
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as ContentCalendarEntry[];
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Append a new ContentCalendarEntry to the site's content calendar.
 * Creates the .seo-agent/{siteId}/ directory if it does not exist.
 */
export async function recordPublishedPost(
  siteId: string,
  entry: ContentCalendarEntry,
): Promise<void> {
  const path = getCalendarPath(siteId);
  await mkdir(dirname(path), { recursive: true });

  const existing = await getCalendar(siteId);
  existing.push(entry);

  await writeFile(path, JSON.stringify(existing, null, 2), 'utf-8');
  logger.info({ siteId, keyword: entry.keyword, slug: entry.slug }, 'Content calendar entry recorded');
}

/**
 * Check whether this site is under the monthly post limit.
 * Returns true if the site can generate more posts this month.
 * maxPerMonth default = 3 (matches CONTEXT.md decision: 1-3 posts/site/month)
 */
export async function checkMonthlyLimit(
  siteId: string,
  maxPerMonth: number = 3,
): Promise<boolean> {
  const calendar = await getCalendar(siteId);
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  const thisMonthCount = calendar.filter(entry => entry.publishedDate.startsWith(currentMonth)).length;
  const underLimit = thisMonthCount < maxPerMonth;

  logger.info({ siteId, thisMonthCount, maxPerMonth, underLimit }, 'Monthly post limit check');
  return underLimit;
}

/**
 * Check for keyword cannibalization — returns true if the keyword was used
 * in this site within the past 90 days (blocks reuse in same quarter).
 */
export async function detectKeywordCannibalization(
  siteId: string,
  keyword: string,
): Promise<boolean> {
  const calendar = await getCalendar(siteId);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentMatch = calendar.some(entry => {
    if (entry.keyword.toLowerCase() !== keyword.toLowerCase()) return false;
    const entryDate = new Date(entry.publishedDate);
    return entryDate >= ninetyDaysAgo;
  });

  if (recentMatch) {
    logger.warn({ siteId, keyword }, 'Keyword cannibalization detected — skipping');
  }
  return recentMatch;
}

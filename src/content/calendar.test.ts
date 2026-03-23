import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContentCalendarEntry } from '../types/index.js';

// Mock logger to suppress output during tests
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// We use real fs operations with a temp directory so we test actual file I/O
// The siteId is set to the temp directory path to control where the calendar is written.
// We override the calendar path by using a test-specific siteId that maps to a tmp subdir.

let tmpDir: string;
let testSiteId: string;

// Import module functions — we'll test with real files in a temp dir
// We need to intercept the .seo-agent path — use a fake siteId that resolves to our tmp dir
// To do this cleanly, we mock path construction via the module's getCalendarPath.

// Approach: mock getCalendarPath to use tmpDir, then test all other functions.
// Alternative: use vi.spyOn on fs, but real I/O is more reliable for calendar tests.

// We'll use a simple approach: use a unique siteId that we set per test, store files in actual
// temp location by mocking the path module's relative resolution.

// Actually, the simplest approach: use actual temp files. Since getCalendarPath returns
// `.seo-agent/${siteId}/content-calendar.json`, we can set process.cwd() to our tmpDir.
// But that is fragile. Instead, we'll mock the getCalendarPath function within the module.

vi.mock('./calendar.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./calendar.js')>();
  return {
    ...original,
    getCalendarPath: (siteId: string) => join(tmpDir, `${siteId}-content-calendar.json`),
  };
});

import { getCalendar, recordPublishedPost, checkMonthlyLimit, detectKeywordCannibalization, getCalendarPath } from './calendar.js';

function makeEntry(overrides: Partial<ContentCalendarEntry> = {}): ContentCalendarEntry {
  return {
    siteId: 'test-site',
    keyword: 'test keyword',
    publishedDate: new Date().toISOString().slice(0, 10),
    slug: 'test-keyword',
    prUrl: 'https://github.com/org/repo/pull/1',
    ...overrides,
  };
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seo-agent-calendar-test-'));
  testSiteId = `site-${Date.now()}`;
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('checkMonthlyLimit', () => {
  it('returns true when calendar is empty (0 < 3)', async () => {
    const result = await checkMonthlyLimit(testSiteId);
    expect(result).toBe(true);
  });

  it('returns true when 2 entries this month (2 < 3)', async () => {
    const currentDate = new Date().toISOString().slice(0, 10);
    await recordPublishedPost(testSiteId, makeEntry({ siteId: testSiteId, publishedDate: currentDate, slug: 'post-1', keyword: 'kw1' }));
    await recordPublishedPost(testSiteId, makeEntry({ siteId: testSiteId, publishedDate: currentDate, slug: 'post-2', keyword: 'kw2' }));

    const result = await checkMonthlyLimit(testSiteId);
    expect(result).toBe(true);
  });

  it('returns false when 3 entries this month (3 >= 3)', async () => {
    const currentDate = new Date().toISOString().slice(0, 10);
    for (let i = 1; i <= 3; i++) {
      await recordPublishedPost(testSiteId, makeEntry({ siteId: testSiteId, publishedDate: currentDate, slug: `post-${i}`, keyword: `kw-${i}` }));
    }

    const result = await checkMonthlyLimit(testSiteId);
    expect(result).toBe(false);
  });
});

describe('recordPublishedPost and getCalendar', () => {
  it('writes entry to file and getCalendar returns it', async () => {
    const entry = makeEntry({ siteId: testSiteId, slug: 'my-post', keyword: 'my keyword' });
    await recordPublishedPost(testSiteId, entry);

    const calendar = await getCalendar(testSiteId);
    expect(calendar).toHaveLength(1);
    expect(calendar[0]).toMatchObject({ siteId: testSiteId, slug: 'my-post', keyword: 'my keyword' });
  });

  it('getCalendar returns empty array when file does not exist', async () => {
    const result = await getCalendar('nonexistent-site');
    expect(result).toEqual([]);
  });
});

describe('detectKeywordCannibalization', () => {
  it('returns true when same keyword posted within 90 days', async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30); // 30 days ago
    const dateStr = recentDate.toISOString().slice(0, 10);

    await recordPublishedPost(testSiteId, makeEntry({
      siteId: testSiteId,
      keyword: 'page speed',
      publishedDate: dateStr,
      slug: 'page-speed',
    }));

    const result = await detectKeywordCannibalization(testSiteId, 'page speed');
    expect(result).toBe(true);
  });

  it('returns false when keyword not in calendar', async () => {
    const result = await detectKeywordCannibalization(testSiteId, 'nonexistent keyword');
    expect(result).toBe(false);
  });

  it('returns false when same keyword used more than 90 days ago', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 100); // 100 days ago, outside window
    const dateStr = oldDate.toISOString().slice(0, 10);

    await recordPublishedPost(testSiteId, makeEntry({
      siteId: testSiteId,
      keyword: 'old keyword',
      publishedDate: dateStr,
      slug: 'old-keyword',
    }));

    const result = await detectKeywordCannibalization(testSiteId, 'old keyword');
    expect(result).toBe(false);
  });
});

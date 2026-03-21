import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing the module under test
vi.mock('./crawler/index.js', () => ({
  crawl: vi.fn(),
}));

vi.mock('./auditor/index.js', () => ({
  audit: vi.fn(),
}));

vi.mock('./fetcher/pagespeed.js', () => ({
  fetchCoreWebVitals: vi.fn(),
}));

vi.mock('./executor/github.js', () => ({
  createAuditPR: vi.fn(),
}));

vi.mock('./utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { crawl } from './crawler/index.js';
import { audit } from './auditor/index.js';
import { fetchCoreWebVitals } from './fetcher/pagespeed.js';
import { createAuditPR } from './executor/github.js';
import { runAuditForSite, runAuditForAllSites } from './index.js';
import type { SiteConfig, PageData, Issue } from './types/index.js';

const mockCrawl = crawl as ReturnType<typeof vi.fn>;
const mockAudit = audit as ReturnType<typeof vi.fn>;
const mockFetchCoreWebVitals = fetchCoreWebVitals as ReturnType<typeof vi.fn>;
const mockCreateAuditPR = createAuditPR as ReturnType<typeof vi.fn>;

const siteA: SiteConfig = {
  siteId: 'site-a',
  url: 'https://a.com',
  gitHubRepo: 'owner/site-a',
  crawlLimits: { maxPages: 10, maxDepth: 2, timeoutMs: 5000, respectRobotsTxt: true },
  googleCredentials: { serviceAccountPath: './creds.json' },
};

const siteB: SiteConfig = {
  ...siteA,
  siteId: 'site-b',
  url: 'https://b.com',
  gitHubRepo: 'owner/site-b',
};

const mockPages: PageData[] = [
  { url: 'https://a.com', statusCode: 200, html: '<html><head><title>Test</title></head></html>', redirectChain: [], finalUrl: 'https://a.com', fetchedAt: new Date() },
];

const mockIssues: Issue[] = [
  { id: 'AUDIT-01', rule: 'missing-meta-description', severity: 'warning', pageUrl: 'https://a.com', description: 'No meta description' },
];

describe('runAuditForSite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrawl.mockResolvedValue(mockPages);
    mockAudit.mockReturnValue(mockIssues);
    mockFetchCoreWebVitals.mockResolvedValue(null);
    mockCreateAuditPR.mockResolvedValue({ prUrl: 'https://github.com/owner/site-a/pull/1', prNumber: 1, wasExisting: false });
  });

  it('calls crawl, audit, fetchCoreWebVitals, createAuditPR in sequence', async () => {
    const callOrder: string[] = [];
    mockCrawl.mockImplementation(async () => { callOrder.push('crawl'); return mockPages; });
    mockAudit.mockImplementation(() => { callOrder.push('audit'); return mockIssues; });
    mockFetchCoreWebVitals.mockImplementation(async () => { callOrder.push('fetchCoreWebVitals'); return null; });
    mockCreateAuditPR.mockImplementation(async () => { callOrder.push('createAuditPR'); return { prUrl: 'https://github.com/owner/site-a/pull/1', prNumber: 1, wasExisting: false }; });

    await runAuditForSite(siteA, {});

    expect(callOrder).toEqual(['crawl', 'audit', 'fetchCoreWebVitals', 'createAuditPR']);
  });

  it('with dryRun=true calls crawl and audit but does NOT call createAuditPR', async () => {
    await runAuditForSite(siteA, { dryRun: true });

    expect(mockCrawl).toHaveBeenCalledOnce();
    expect(mockAudit).toHaveBeenCalledOnce();
    expect(mockCreateAuditPR).not.toHaveBeenCalled();
  });

  it('returns AuditRunState with executionState.prUrl set on success', async () => {
    const result = await runAuditForSite(siteA, {});

    expect(result.executionState.status).toBe('complete');
    expect(result.executionState.prUrl).toBe('https://github.com/owner/site-a/pull/1');
    expect(result.crawlState.status).toBe('complete');
    expect(result.analysisState.status).toBe('complete');
  });

  it('returns AuditRunState with executionState.status=failed when createAuditPR throws — does not re-throw', async () => {
    mockCreateAuditPR.mockRejectedValue(new Error('GITHUB_TOKEN required'));

    let result;
    await expect(async () => {
      result = await runAuditForSite(siteA, {});
    }).not.toThrow();

    expect(result!.executionState.status).toBe('failed');
    expect(result!.executionState.error).toBe('GITHUB_TOKEN required');
  });
});

describe('runAuditForAllSites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrawl.mockResolvedValue(mockPages);
    mockAudit.mockReturnValue(mockIssues);
    mockFetchCoreWebVitals.mockResolvedValue(null);
    mockCreateAuditPR.mockResolvedValue({ prUrl: 'https://github.com/owner/site-a/pull/1', prNumber: 1, wasExisting: false });
  });

  it('processes each site sequentially — second site starts after first completes', async () => {
    const order: string[] = [];
    mockCrawl.mockImplementation(async (url: string) => {
      order.push(`crawl-start:${url}`);
      await new Promise(r => setTimeout(r, 10));
      order.push(`crawl-end:${url}`);
      return mockPages;
    });

    await runAuditForAllSites([siteA, siteB], {});

    // Sequential: site A must fully complete before site B starts
    expect(order.indexOf('crawl-end:https://a.com')).toBeLessThan(order.indexOf('crawl-start:https://b.com'));
  });

  it('continues to site B even if site A fails', async () => {
    mockCrawl
      .mockRejectedValueOnce(new Error('Site A crawl failed'))
      .mockResolvedValueOnce(mockPages);

    const results = await runAuditForAllSites([siteA, siteB], {});

    expect(results).toHaveLength(2);
    expect(results[0]!.siteId).toBe('site-a');
    expect(results[0]!.crawlState.status).toBe('failed');
    expect(results[1]!.siteId).toBe('site-b');
    expect(results[1]!.executionState.status).toBe('complete');
  });
});

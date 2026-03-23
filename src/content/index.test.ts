import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock functions (must be defined before vi.mock calls) ─────────────

const {
  mockGenerateBlogPost,
  mockCheckOriginality,
  mockDiscoverInternalLinks,
  mockInsertInternalLinks,
  mockFlagClaims,
  mockCheckMonthlyLimit,
  mockDetectKeywordCannibalization,
  mockRecordPublishedPost,
  mockCreateBlogPR,
} = vi.hoisted(() => ({
  mockGenerateBlogPost: vi.fn(),
  mockCheckOriginality: vi.fn(),
  mockDiscoverInternalLinks: vi.fn(),
  mockInsertInternalLinks: vi.fn(),
  mockFlagClaims: vi.fn(),
  mockCheckMonthlyLimit: vi.fn(),
  mockDetectKeywordCannibalization: vi.fn(),
  mockRecordPublishedPost: vi.fn(),
  mockCreateBlogPR: vi.fn(),
}));

vi.mock('./generator.js', () => ({
  generateBlogPost: mockGenerateBlogPost,
  BlogGenerationError: class BlogGenerationError extends Error {
    keyword: string;
    constructor(msg: string, keyword: string) {
      super(msg);
      this.name = 'BlogGenerationError';
      this.keyword = keyword;
    }
  },
}));

vi.mock('./plagiarism-checker.js', () => ({
  checkOriginality: mockCheckOriginality,
}));

vi.mock('./internal-linker.js', () => ({
  discoverInternalLinks: mockDiscoverInternalLinks,
  insertInternalLinks: mockInsertInternalLinks,
}));

vi.mock('./claim-flagging.js', () => ({
  flagClaims: mockFlagClaims,
}));

vi.mock('./calendar.js', () => ({
  checkMonthlyLimit: mockCheckMonthlyLimit,
  detectKeywordCannibalization: mockDetectKeywordCannibalization,
  recordPublishedPost: mockRecordPublishedPost,
}));

vi.mock('../executor/blog-pr.js', () => ({
  createBlogPR: mockCreateBlogPR,
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { runBlogPipelineForSite, runBlogPipelineForAllSites } from './index.js';
import type { SiteConfig, KeywordOpportunity } from '../types/index.js';

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeSite(overrides?: Partial<SiteConfig>): SiteConfig {
  return {
    siteId: 'test-site',
    url: 'https://example.com',
    gitHubRepo: 'owner/repo',
    crawlLimits: { maxPages: 100, maxDepth: 3, timeoutMs: 10000, respectRobotsTxt: true },
    googleCredentials: { serviceAccountPath: '/path/to/creds.json' },
    blogDirectory: 'content/blog',
    ...overrides,
  };
}

function makeKeyword(keyword: string, opportunityScore: number): KeywordOpportunity {
  return {
    keyword,
    clicks: 100,
    impressions: 1000,
    ctr: 0.1,
    position: 8,
    opportunityScore,
  };
}

function makeBlogPost(keyword: string) {
  return {
    slug: keyword.replace(/\s+/g, '-').toLowerCase(),
    title: `Guide to ${keyword}`,
    description: `Complete guide about ${keyword} and related topics for SEO.`,
    keywords: [keyword],
    publishedDate: '2026-03-23',
    author: 'SEO Agent (AI-generated)',
    content: `# Guide to ${keyword}\n\nContent here...`,
    targetKeyword: keyword,
    wordCount: 600,
  };
}

function makeOriginalityCheck(passed = true) {
  return {
    score: passed ? 85 : 45,
    comparedSources: ['https://example.com'],
    passedThreshold: passed,
    attempts: 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: under monthly limit
  mockCheckMonthlyLimit.mockResolvedValue(true);
  // Default: no cannibalization
  mockDetectKeywordCannibalization.mockResolvedValue(false);
  // Default: originality passes
  mockCheckOriginality.mockResolvedValue(makeOriginalityCheck(true));
  // Default: no internal links
  mockDiscoverInternalLinks.mockResolvedValue([]);
  mockInsertInternalLinks.mockImplementation((content: string) => content);
  // Default: no flagged claims
  mockFlagClaims.mockReturnValue([]);
  // Default: successful PR
  mockCreateBlogPR.mockResolvedValue({
    prUrl: 'https://github.com/owner/repo/pull/1',
    prNumber: 1,
    wasExisting: false,
    filePath: 'content/blog/test.md',
  });
  mockRecordPublishedPost.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runBlogPipelineForSite', () => {
  it('Test 1: With 2 keywords and maxPostsPerSite=1 → generates only 1 post', async () => {
    const site = makeSite();
    const keywords = [
      makeKeyword('page speed', 90),
      makeKeyword('core web vitals', 80),
    ];

    mockGenerateBlogPost
      .mockResolvedValueOnce(makeBlogPost('page speed'));

    const state = await runBlogPipelineForSite(site, keywords, {
      maxPostsPerSite: 1,
      dryRun: true,
    });

    expect(state.contentState.postCount).toBe(1);
    // Only one generation attempt — stopped after maxPostsPerSite=1
    expect(mockGenerateBlogPost).toHaveBeenCalledTimes(1);
  });

  it('Test 2: Keyword failing originality after 3 attempts → skipped, postCount=0', async () => {
    const site = makeSite();
    const keywords = [makeKeyword('page speed', 90)];

    // generateBlogPost called 3 times, originality fails all 3
    mockGenerateBlogPost
      .mockResolvedValue(makeBlogPost('page speed'));
    mockCheckOriginality
      .mockResolvedValue(makeOriginalityCheck(false)); // Always fail

    const state = await runBlogPipelineForSite(site, keywords, { dryRun: true });

    expect(state.contentState.postCount).toBe(0);
    expect(mockGenerateBlogPost).toHaveBeenCalledTimes(3);
    expect(mockCheckOriginality).toHaveBeenCalledTimes(3);
  });

  it('Test 3: Monthly limit reached → returns state with postCount=0, no generation attempted', async () => {
    const site = makeSite();
    const keywords = [makeKeyword('page speed', 90)];

    // At monthly limit
    mockCheckMonthlyLimit.mockResolvedValue(false);

    const state = await runBlogPipelineForSite(site, keywords, {});

    expect(state.contentState.postCount).toBe(0);
    expect(state.contentState.status).toBe('complete');
    expect(mockGenerateBlogPost).not.toHaveBeenCalled();
  });

  it('Test 4: dryRun=true → submittedAsPR = false, createBlogPR never called', async () => {
    const site = makeSite();
    const keywords = [makeKeyword('page speed', 90)];

    mockGenerateBlogPost.mockResolvedValue(makeBlogPost('page speed'));

    const state = await runBlogPipelineForSite(site, keywords, { dryRun: true });

    expect(state.contentState.postCount).toBe(1);
    expect(mockCreateBlogPR).not.toHaveBeenCalled();
    expect(mockRecordPublishedPost).not.toHaveBeenCalled();
  });

  it('Test 6: BlogGenerationError from generator → site state status = failed', async () => {
    // Import the mocked BlogGenerationError class from the mocked module
    const generatorModule = await import('./generator.js');
    const { BlogGenerationError } = generatorModule;

    const site = makeSite();
    const keywords = [makeKeyword('page speed', 90)];

    mockGenerateBlogPost.mockRejectedValue(
      new (BlogGenerationError as new (msg: string, keyword: string) => Error)('LLM error: rate limit exceeded', 'page speed')
    );

    const state = await runBlogPipelineForSite(site, keywords, { dryRun: false });

    expect(state.contentState.status).toBe('failed');
    expect(state.contentState.error).toBeDefined();
  });
});

describe('runBlogPipelineForAllSites', () => {
  it('Test 5: runBlogPipelineForAllSites with 2 sites → processes both sequentially', async () => {
    const site1 = makeSite({ siteId: 'site-1' });
    const site2 = makeSite({ siteId: 'site-2' });
    const keywords = new Map([
      ['site-1', [makeKeyword('page speed', 90)]],
      ['site-2', [makeKeyword('core web vitals', 80)]],
    ]);

    mockGenerateBlogPost
      .mockResolvedValueOnce(makeBlogPost('page speed'))
      .mockResolvedValueOnce(makeBlogPost('core web vitals'));

    const results = await runBlogPipelineForAllSites([site1, site2], keywords, { dryRun: true });

    expect(results).toHaveLength(2);
    expect(results[0]!.siteId).toBe('site-1');
    expect(results[1]!.siteId).toBe('site-2');
    expect(results[0]!.contentState.postCount).toBe(1);
    expect(results[1]!.contentState.postCount).toBe(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBlogPR } from './blog-pr.js';
import { formatBlogPRBody, formatBlogPRTitle } from './pr-formatter.js';
import type { BlogPost, BlogPostResult, OriginalityCheck, InternalLink } from '../types/index.js';

// ─── Mock Octokit ─────────────────────────────────────────────────────────────

const mockOctokit = {
  pulls: {
    list: vi.fn(),
    create: vi.fn(),
  },
  repos: {
    get: vi.fn(),
    getBranch: vi.fn(),
    createOrUpdateFileContents: vi.fn(),
  },
  git: {
    createRef: vi.fn(),
  },
  issues: {
    createLabel: vi.fn(),
    addLabels: vi.fn(),
  },
};

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(() => mockOctokit),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeBlogPost(overrides?: Partial<BlogPost>): BlogPost {
  return {
    slug: 'how-to-improve-page-speed',
    title: 'How to Improve Page Speed',
    description: 'Learn the top techniques to dramatically improve your page speed and Core Web Vitals score.',
    keywords: ['page speed', 'core web vitals', 'performance'],
    publishedDate: '2026-03-23',
    author: 'SEO Agent (AI-generated)',
    content: '# How to Improve Page Speed\n\nContent here...',
    targetKeyword: 'page speed',
    wordCount: 520,
    ...overrides,
  };
}

function makeOriginalityCheck(overrides?: Partial<OriginalityCheck>): OriginalityCheck {
  return {
    score: 85,
    comparedSources: ['https://example.com/speed', 'https://web.dev/vitals'],
    passedThreshold: true,
    attempts: 1,
    ...overrides,
  };
}

function makeBlogPostResult(post: BlogPost, overrides?: Partial<BlogPostResult>): BlogPostResult {
  return {
    blogPost: post,
    originalityCheck: makeOriginalityCheck(),
    internalLinks: [
      { anchorText: 'Core Web Vitals guide', targetUrl: 'https://example.com/cwv', relevanceScore: 0.87 } as InternalLink,
    ],
    flaggedClaims: [],
    submittedAsPR: false,
    ...overrides,
  };
}

const TEST_REPO = 'owner/my-repo';
const TEST_SITE_ID = 'acme-website';

// ─── Setup default mock responses ─────────────────────────────────────────────

function setupHappyPath(post: BlogPost) {
  // No existing PRs
  mockOctokit.pulls.list.mockResolvedValue({ data: [] });
  // Repo info
  mockOctokit.repos.get.mockResolvedValue({ data: { default_branch: 'main' } });
  // Default branch SHA
  mockOctokit.repos.getBranch
    .mockResolvedValueOnce({ data: { commit: { sha: 'abc123sha' } } }) // default branch
    .mockRejectedValueOnce({ status: 404 }); // blog branch doesn't exist yet
  // Create file
  mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({ data: {} });
  // Create PR
  mockOctokit.pulls.create.mockResolvedValue({
    data: {
      html_url: `https://github.com/${TEST_REPO}/pull/42`,
      number: 42,
    },
  });
  // Label operations
  mockOctokit.issues.createLabel.mockResolvedValue({ data: {} });
  mockOctokit.issues.addLabels.mockResolvedValue({ data: {} });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env['GITHUB_TOKEN'] = 'test-token';
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createBlogPR', () => {
  it('Test 1: creates branch seo-blog/{slug}/{date} using git.createRef', async () => {
    const post = makeBlogPost();
    setupHappyPath(post);

    await createBlogPR({
      gitHubRepo: TEST_REPO,
      siteId: TEST_SITE_ID,
      blogPost: post,
      blogPostResult: makeBlogPostResult(post),
    });

    const createRefCall = mockOctokit.git.createRef.mock.calls[0];
    expect(createRefCall).toBeDefined();
    expect(createRefCall[0].ref).toBe('refs/heads/seo-blog/how-to-improve-page-speed/2026-03-23');
    expect(createRefCall[0].sha).toBe('abc123sha');
  });

  it('Test 2: writes file with gray-matter frontmatter via repos.createOrUpdateFileContents', async () => {
    const post = makeBlogPost();
    setupHappyPath(post);

    await createBlogPR({
      gitHubRepo: TEST_REPO,
      siteId: TEST_SITE_ID,
      blogPost: post,
      blogPostResult: makeBlogPostResult(post),
    });

    const createFileCall = mockOctokit.repos.createOrUpdateFileContents.mock.calls[0][0];
    expect(createFileCall.path).toBe('content/blog/how-to-improve-page-speed.md');

    // Decode base64 content and verify YAML frontmatter
    const decoded = Buffer.from(createFileCall.content, 'base64').toString('utf-8');
    expect(decoded).toContain('title:');
    expect(decoded).toContain('slug:');
    expect(decoded).toContain('targetKeyword:');
    expect(decoded).toContain('How to Improve Page Speed');
  });

  it('Test 3: returns existing PR if branch already has open PR (idempotent)', async () => {
    const post = makeBlogPost();

    // Simulate existing open PR
    mockOctokit.pulls.list.mockResolvedValue({
      data: [{ html_url: 'https://github.com/owner/my-repo/pull/7', number: 7 }],
    });

    const result = await createBlogPR({
      gitHubRepo: TEST_REPO,
      siteId: TEST_SITE_ID,
      blogPost: post,
      blogPostResult: makeBlogPostResult(post),
    });

    expect(result.prUrl).toBe('https://github.com/owner/my-repo/pull/7');
    expect(result.prNumber).toBe(7);
    expect(result.wasExisting).toBe(true);
    // Should NOT create a new PR
    expect(mockOctokit.pulls.create).not.toHaveBeenCalled();
    expect(mockOctokit.git.createRef).not.toHaveBeenCalled();
  });
});

describe('formatBlogPRBody', () => {
  it('Test 4: includes originality score and passedThreshold indication', () => {
    const post = makeBlogPost();
    const result = makeBlogPostResult(post, {
      originalityCheck: makeOriginalityCheck({ score: 92, passedThreshold: true, attempts: 2 }),
    });

    const body = formatBlogPRBody(result, TEST_SITE_ID);

    expect(body).toContain('92% original');
    expect(body).toContain('PASS');
    expect(body).toContain('>70%');
  });

  it('Test 5: lists flaggedClaims when present', () => {
    const post = makeBlogPost();
    const result = makeBlogPostResult(post, {
      flaggedClaims: [
        'Studies show 40% of users abandon pages that take more than 3 seconds to load.',
        'Google confirmed that page speed is a ranking factor since 2010.',
      ],
    });

    const body = formatBlogPRBody(result, TEST_SITE_ID);

    expect(body).toContain('Flagged Claims');
    expect(body).toContain('Studies show 40% of users');
    expect(body).toContain('Google confirmed');
    expect(body).toContain('Require Verification');
  });

  it('Test 6: shows "None flagged" when no claims', () => {
    const post = makeBlogPost();
    const result = makeBlogPostResult(post, { flaggedClaims: [] });

    const body = formatBlogPRBody(result, TEST_SITE_ID);

    expect(body).toContain('None flagged');
    expect(body).not.toContain('Require Verification');
  });
});

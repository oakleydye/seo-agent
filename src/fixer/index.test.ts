import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { runFixForSite, runFixForAllSites } from './index.js';
import type { SiteConfig, AuditFindings, Issue } from '../types/index.js';

// ── Mock all external dependencies ────────────────────────────────────────────

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./generator.js', () => ({
  generateFixedFile: vi.fn(),
  groupIssuesBySourceFile: vi.fn(),
  FixGenerationError: class FixGenerationError extends Error {
    filePath: string;
    issueIds: string[];
    constructor(message: string, filePath: string, issueIds: string[]) {
      super(message);
      this.name = 'FixGenerationError';
      this.filePath = filePath;
      this.issueIds = issueIds;
    }
  },
}));

vi.mock('./validator.js', () => ({
  validateFixedCode: vi.fn(),
}));

vi.mock('../executor/github.js', () => ({
  createFixPR: vi.fn(),
}));

vi.mock('../generator/schema.js', () => ({
  generateSchemaMarkup: vi.fn(),
}));

// ── Import mocked modules ─────────────────────────────────────────────────────

import { generateFixedFile, groupIssuesBySourceFile, FixGenerationError } from './generator.js';
import { validateFixedCode } from './validator.js';
import { createFixPR } from '../executor/github.js';

const mockGenerateFixedFile = generateFixedFile as Mock;
const mockGroupIssuesBySourceFile = groupIssuesBySourceFile as Mock;
const mockValidateFixedCode = validateFixedCode as Mock;
const mockCreateFixPR = createFixPR as Mock;

// ── Test fixtures ─────────────────────────────────────────────────────────────

const baseSite: SiteConfig = {
  siteId: 'test-site',
  url: 'https://example.com',
  gitHubRepo: 'acme/website',
  crawlLimits: { maxPages: 100, maxDepth: 3, timeoutMs: 30000, respectRobotsTxt: true },
  googleCredentials: { serviceAccountPath: '/credentials.json' },
  fixPRTracking: { submittedCount: 0, firstRunLimit: 5 },
};

const issueInFileA1: Issue = {
  id: 'AUDIT-01',
  rule: 'missing-title-tag',
  severity: 'critical',
  pageUrl: 'https://example.com/about',
  description: 'Missing title tag',
};

const issueInFileA2: Issue = {
  id: 'AUDIT-02',
  rule: 'missing-title-tag',
  severity: 'critical',
  pageUrl: 'https://example.com/about',
  description: 'Another title issue',
};

const issueInFileB: Issue = {
  id: 'AUDIT-03',
  rule: 'missing-meta-description',
  severity: 'warning',
  pageUrl: 'https://example.com/contact',
  description: 'Missing meta description',
};

const unmappedIssue: Issue = {
  id: 'AUDIT-04',
  rule: 'broken-link',
  severity: 'warning',
  pageUrl: 'https://example.com/',
  description: 'Broken link found',
};

const baseFindings: AuditFindings = {
  siteId: 'test-site',
  auditDate: '2026-03-22',
  pagesAudited: 3,
  issues: [issueInFileA1, issueInFileA2, issueInFileB, unmappedIssue],
};

// ── Helper: set up default mocks ──────────────────────────────────────────────

function setupDefaultMocks() {
  // groupIssuesBySourceFile: simulate real grouping behavior for test control
  // Note: index.ts calls groupIssuesBySourceFile(issues, (issue) => resolveSourceFileFromUrl(issue.pageUrl))
  // so the resolver receives Issue objects
  mockGroupIssuesBySourceFile.mockImplementation(
    (issues: Issue[], resolver: (i: Issue) => string | null) => {
      const groups = new Map<string, Issue[]>();
      for (const issue of issues) {
        const filePath = resolver(issue);
        if (filePath === null) continue;
        const existing = groups.get(filePath) ?? [];
        existing.push(issue);
        groups.set(filePath, existing);
      }
      return groups;
    },
  );

  mockGenerateFixedFile.mockResolvedValue('// fixed content');

  mockValidateFixedCode.mockResolvedValue({ success: true, buildOutput: '' });

  mockCreateFixPR.mockResolvedValue({
    prUrl: 'https://github.com/acme/website/pull/1',
    prNumber: 1,
    wasExisting: false,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runFixForSite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('skips issues with unmapped rules — no LLM call, no PR for broken-link', async () => {
    const findingsWithOnlyUnmapped: AuditFindings = {
      ...baseFindings,
      issues: [unmappedIssue],
    };

    const result = await runFixForSite(baseSite, findingsWithOnlyUnmapped);

    expect(mockGenerateFixedFile).not.toHaveBeenCalled();
    expect(mockCreateFixPR).not.toHaveBeenCalled();
    expect(result.fixState.status).toBe('complete');
    expect(result.fixState.fixCount).toBe(0);
    expect(result.fixState.prUrls).toHaveLength(0);
  });

  it('calls generateFixedFile once per source file (batch-per-file, not once per issue)', async () => {
    // fileA has 2 issues (issueInFileA1 + issueInFileA2), fileB has 1 issue
    const result = await runFixForSite(baseSite, baseFindings);

    // groupIssuesBySourceFile called with the fixable issues (3), not including unmapped
    expect(mockGroupIssuesBySourceFile).toHaveBeenCalledTimes(1);

    // generateFixedFile called once per file, not once per issue
    // Two files: app/about/page.tsx and app/contact/page.tsx
    expect(mockGenerateFixedFile).toHaveBeenCalledTimes(2);

    expect(result.fixState.status).toBe('complete');
  });

  it('calls createFixPR once per fix category (not once per file)', async () => {
    // issueInFileA1 + issueInFileA2 are both title-tag → 1 PR
    // issueInFileB is meta-description → 1 PR
    // Total: 2 PR calls
    await runFixForSite(baseSite, baseFindings);

    expect(mockCreateFixPR).toHaveBeenCalledTimes(2);

    const categories = mockCreateFixPR.mock.calls.map(
      (call: [{ category: string }]) => call[0].category,
    );
    expect(categories).toContain('title-tag');
    expect(categories).toContain('meta-description');
  });

  it('dryRun=true: createFixPR NOT called, prUrls is empty', async () => {
    const result = await runFixForSite(baseSite, baseFindings, { dryRun: true });

    expect(mockCreateFixPR).not.toHaveBeenCalled();
    expect(result.fixState.prUrls).toHaveLength(0);
    expect(result.fixState.status).toBe('complete');
  });

  it('FixGenerationError from LLM: skips that file, continues with others, fixState reflects partial fix', async () => {
    // Make file A fail, file B succeed
    mockGenerateFixedFile
      .mockRejectedValueOnce(
        new FixGenerationError('LLM failed', 'app/about/page.tsx', ['AUDIT-01', 'AUDIT-02']),
      )
      .mockResolvedValueOnce('// fixed contact page');

    const result = await runFixForSite(baseSite, baseFindings);

    // File B (contact) should still generate a fix
    expect(mockGenerateFixedFile).toHaveBeenCalledTimes(2);
    // Only meta-description PR created (title-tag skipped due to LLM error)
    expect(mockCreateFixPR).toHaveBeenCalledTimes(1);
    expect(result.fixState.status).toBe('complete');
  });

  it('validateFixedCode result.success=false: buildPassed=false on FixResults, PR still created (soft gate)', async () => {
    mockValidateFixedCode.mockResolvedValue({
      success: false,
      buildOutput: 'Error: build failed',
      error: 'Build failed with exit code 1',
    });

    const findingsSimple: AuditFindings = {
      ...baseFindings,
      issues: [issueInFileB], // single issue, single category
    };

    const result = await runFixForSite(baseSite, findingsSimple);

    // PR still created even on build failure (soft gate)
    expect(mockCreateFixPR).toHaveBeenCalledTimes(1);
    expect(result.fixState.status).toBe('complete');
  });

  it('returns FixRunState with siteId and runDate', async () => {
    const result = await runFixForSite(baseSite, baseFindings);

    expect(result.siteId).toBe('test-site');
    expect(result.runDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('never throws — captures unexpected errors in fixState.error', async () => {
    mockGroupIssuesBySourceFile.mockImplementation(() => {
      throw new Error('Unexpected internal error');
    });

    const result = await runFixForSite(baseSite, baseFindings);

    expect(result.fixState.status).toBe('failed');
    expect(result.fixState.error).toContain('Unexpected internal error');
  });

  it('populates prUrls in fixState from PR creation results', async () => {
    mockCreateFixPR
      .mockResolvedValueOnce({ prUrl: 'https://github.com/acme/website/pull/10', prNumber: 10, wasExisting: false })
      .mockResolvedValueOnce({ prUrl: 'https://github.com/acme/website/pull/11', prNumber: 11, wasExisting: false });

    const result = await runFixForSite(baseSite, baseFindings);

    expect(result.fixState.prUrls).toHaveLength(2);
    expect(result.fixState.prUrls).toContain('https://github.com/acme/website/pull/10');
    expect(result.fixState.prUrls).toContain('https://github.com/acme/website/pull/11');
  });

  it('uses default fixPRTracking when not set on SiteConfig', async () => {
    const siteWithoutTracking: SiteConfig = {
      ...baseSite,
      fixPRTracking: undefined,
    };

    const findingsSimple: AuditFindings = {
      ...baseFindings,
      issues: [issueInFileB],
    };

    await runFixForSite(siteWithoutTracking, findingsSimple);

    // createFixPR should be called with fixPRTracking defaults
    const call = mockCreateFixPR.mock.calls[0][0] as { fixPRTracking: { submittedCount: number; firstRunLimit: number } };
    expect(call.fixPRTracking).toEqual({ submittedCount: 0, firstRunLimit: 5 });
  });
});

describe('runFixForAllSites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('runs runFixForSite for each site sequentially', async () => {
    const site2: SiteConfig = { ...baseSite, siteId: 'site-2', gitHubRepo: 'acme/site2' };
    const allFindings = new Map([
      ['test-site', baseFindings],
      ['site-2', { ...baseFindings, siteId: 'site-2' }],
    ]);

    const results = await runFixForAllSites([baseSite, site2], allFindings);

    expect(results).toHaveLength(2);
    expect(results[0]!.siteId).toBe('test-site');
    expect(results[1]!.siteId).toBe('site-2');
  });

  it('returns failed status for sites with no findings', async () => {
    const allFindings = new Map<string, AuditFindings>(); // empty

    const results = await runFixForAllSites([baseSite], allFindings);

    expect(results[0]!.fixState.status).toBe('failed');
    expect(results[0]!.fixState.error).toContain('No audit findings');
  });

  it('processes remaining sites when one site has no findings', async () => {
    const site2: SiteConfig = { ...baseSite, siteId: 'site-2', gitHubRepo: 'acme/site2' };
    const allFindings = new Map([
      ['site-2', { ...baseFindings, siteId: 'site-2' }],
      // test-site intentionally missing
    ]);

    const results = await runFixForAllSites([baseSite, site2], allFindings);

    expect(results).toHaveLength(2);
    expect(results[0]!.fixState.status).toBe('failed'); // test-site missing findings
    expect(results[1]!.fixState.status).toBe('complete'); // site-2 succeeds
  });
});

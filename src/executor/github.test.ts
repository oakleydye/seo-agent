import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuditPR, createFixPR } from './github.js';
import type { AuditFindings, FixResult, FixPRTracking } from '../types/index.js';

// Mock Octokit
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));

const mockOctokit = {
  pulls: {
    list: vi.fn(),
    create: vi.fn(),
  },
  repos: {
    get: vi.fn(),
    getBranch: vi.fn(),
  },
  git: {
    createRef: vi.fn(),
  },
  issues: {
    createLabel: vi.fn(),
    addLabels: vi.fn(),
  },
};

const baseFindings: AuditFindings = {
  siteId: 'test-site',
  auditDate: '2024-01-15',
  pagesAudited: 5,
  issues: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockOctokit.pulls.list.mockResolvedValue({ data: [] });
  mockOctokit.repos.get.mockResolvedValue({ data: { default_branch: 'main' } });
  // First getBranch call: default branch (returns sha), second: audit branch (404 = doesn't exist)
  mockOctokit.repos.getBranch
    .mockResolvedValueOnce({ data: { commit: { sha: 'deadbeef' } } })
    .mockRejectedValueOnce({ status: 404 });
  mockOctokit.git.createRef.mockResolvedValue({});
  mockOctokit.pulls.create.mockResolvedValue({
    data: { html_url: 'https://github.com/owner/repo/pull/1', number: 1 },
  });
});

describe('createAuditPR', () => {
  it('throws when GITHUB_TOKEN is not provided', async () => {
    await expect(
      createAuditPR({ gitHubRepo: 'owner/repo', findings: baseFindings, githubToken: '' }),
    ).rejects.toThrow(/GITHUB_TOKEN/);
  });

  it('creates branch with seo-audit/YYYY-MM-DD naming', async () => {
    await createAuditPR({ gitHubRepo: 'owner/repo', findings: baseFindings, githubToken: 'tok' });
    expect(mockOctokit.git.createRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'refs/heads/seo-audit/2024-01-15' }),
    );
  });

  it('creates PR and returns URL', async () => {
    const result = await createAuditPR({ gitHubRepo: 'owner/repo', findings: baseFindings, githubToken: 'tok' });
    expect(result.prUrl).toBe('https://github.com/owner/repo/pull/1');
    expect(result.wasExisting).toBe(false);
  });

  it('returns existing PR without creating new one when open PR exists', async () => {
    mockOctokit.pulls.list.mockResolvedValue({
      data: [{ html_url: 'https://github.com/owner/repo/pull/99', number: 99 }],
    });

    const result = await createAuditPR({ gitHubRepo: 'owner/repo', findings: baseFindings, githubToken: 'tok' });
    expect(result.prUrl).toBe('https://github.com/owner/repo/pull/99');
    expect(result.wasExisting).toBe(true);
    expect(mockOctokit.pulls.create).not.toHaveBeenCalled();
    expect(mockOctokit.git.createRef).not.toHaveBeenCalled();
  });

  it('skips branch creation if branch already exists', async () => {
    // Override beforeEach getBranch mocks: default branch returns sha, audit branch exists (no 404)
    mockOctokit.repos.getBranch.mockReset();
    mockOctokit.repos.getBranch
      .mockResolvedValueOnce({ data: { commit: { sha: 'abc123' } } }) // default branch
      .mockResolvedValueOnce({ data: {} }); // audit branch exists (no 404 = exists)

    await createAuditPR({ gitHubRepo: 'owner/repo', findings: baseFindings, githubToken: 'tok' });
    expect(mockOctokit.git.createRef).not.toHaveBeenCalled();
  });

  it('PR title includes siteId from formatPRTitle', async () => {
    await createAuditPR({ gitHubRepo: 'owner/repo', findings: baseFindings, githubToken: 'tok' });
    const callArgs = mockOctokit.pulls.create.mock.calls[0]![0] as { title: string };
    expect(callArgs.title).toContain('test-site');
  });
});

// ─── Phase 2: createFixPR tests ────────────────────────────────────────────────

const baseFixResult: FixResult = {
  fix: {
    id: 'fix-meta-description-2026-03-21',
    category: 'meta-description',
    risk: 'low-risk',
    sourceFile: 'app/about/page.tsx',
    originalContent: '<head></head>',
    fixedContent: '<head><meta name="description" content="About" /></head>',
    issueIds: ['AUDIT-01'],
  },
  buildPassed: true,
  submittedAsPR: false,
};

const baseTracking: FixPRTracking = { submittedCount: 6, firstRunLimit: 5 };

function setupFixMocks() {
  mockOctokit.pulls.list.mockResolvedValue({ data: [] });
  mockOctokit.repos.get.mockResolvedValue({ data: { default_branch: 'main' } });
  mockOctokit.repos.getBranch
    .mockResolvedValueOnce({ data: { commit: { sha: 'deadbeef' } } }) // default branch
    .mockRejectedValueOnce({ status: 404 }); // fix branch does not exist
  mockOctokit.git.createRef.mockResolvedValue({});
  mockOctokit.pulls.create.mockResolvedValue({
    data: { html_url: 'https://github.com/owner/repo/pull/2', number: 2 },
  });
  mockOctokit.issues.createLabel.mockResolvedValue({});
  mockOctokit.issues.addLabels.mockResolvedValue({});
}

describe('createFixPR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFixMocks();
  });

  it('throws when GITHUB_TOKEN is not provided', async () => {
    await expect(
      createFixPR({
        gitHubRepo: 'owner/repo',
        category: 'meta-description',
        fixResults: [baseFixResult],
        siteId: 'acme',
        date: '2026-03-21',
        fixPRTracking: baseTracking,
        githubToken: '',
      }),
    ).rejects.toThrow(/GITHUB_TOKEN/);
  });

  it('creates branch with seo-fix/{category}/{date} naming', async () => {
    await createFixPR({
      gitHubRepo: 'owner/repo',
      category: 'meta-description',
      fixResults: [baseFixResult],
      siteId: 'acme',
      date: '2026-03-21',
      fixPRTracking: baseTracking,
      githubToken: 'tok',
    });
    expect(mockOctokit.git.createRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'refs/heads/seo-fix/meta-description/2026-03-21' }),
    );
  });

  it('returns existing PR without creating new one when open PR exists', async () => {
    mockOctokit.pulls.list.mockResolvedValue({
      data: [{ html_url: 'https://github.com/owner/repo/pull/99', number: 99 }],
    });

    const result = await createFixPR({
      gitHubRepo: 'owner/repo',
      category: 'meta-description',
      fixResults: [baseFixResult],
      siteId: 'acme',
      date: '2026-03-21',
      fixPRTracking: baseTracking,
      githubToken: 'tok',
    });
    expect(result.prUrl).toBe('https://github.com/owner/repo/pull/99');
    expect(result.wasExisting).toBe(true);
    expect(mockOctokit.pulls.create).not.toHaveBeenCalled();
    expect(mockOctokit.git.createRef).not.toHaveBeenCalled();
  });

  it('creates PR and returns URL and wasExisting=false', async () => {
    const result = await createFixPR({
      gitHubRepo: 'owner/repo',
      category: 'meta-description',
      fixResults: [baseFixResult],
      siteId: 'acme',
      date: '2026-03-21',
      fixPRTracking: baseTracking,
      githubToken: 'tok',
    });
    expect(result.prUrl).toBe('https://github.com/owner/repo/pull/2');
    expect(result.wasExisting).toBe(false);
    expect(result.prNumber).toBe(2);
  });

  it('calls createLabel for each label', async () => {
    await createFixPR({
      gitHubRepo: 'owner/repo',
      category: 'meta-description',
      fixResults: [baseFixResult],
      siteId: 'acme',
      date: '2026-03-21',
      fixPRTracking: baseTracking,
      githubToken: 'tok',
    });
    expect(mockOctokit.issues.createLabel).toHaveBeenCalled();
    const labelArgs = mockOctokit.issues.createLabel.mock.calls.map(
      (c: [{ name: string }]) => c[0]!.name,
    );
    expect(labelArgs).toContain('seo-auto-fix');
  });

  it('continues if createLabel returns 422 (label already exists)', async () => {
    mockOctokit.issues.createLabel.mockRejectedValue({ status: 422 });

    await expect(
      createFixPR({
        gitHubRepo: 'owner/repo',
        category: 'meta-description',
        fixResults: [baseFixResult],
        siteId: 'acme',
        date: '2026-03-21',
        fixPRTracking: baseTracking,
        githubToken: 'tok',
      }),
    ).resolves.toBeDefined();
  });

  it('applies labels to the created PR via addLabels', async () => {
    await createFixPR({
      gitHubRepo: 'owner/repo',
      category: 'meta-description',
      fixResults: [baseFixResult],
      siteId: 'acme',
      date: '2026-03-21',
      fixPRTracking: baseTracking,
      githubToken: 'tok',
    });
    expect(mockOctokit.issues.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'owner',
        repo: 'repo',
        issue_number: 2,
        labels: expect.arrayContaining(['seo-auto-fix']),
      }),
    );
  });

  it('uses GITHUB_TOKEN env var when githubToken option not provided', async () => {
    process.env['GITHUB_TOKEN'] = 'env-token';
    await createFixPR({
      gitHubRepo: 'owner/repo',
      category: 'meta-description',
      fixResults: [baseFixResult],
      siteId: 'acme',
      date: '2026-03-21',
      fixPRTracking: baseTracking,
    });
    expect(mockOctokit.pulls.create).toHaveBeenCalled();
    delete process.env['GITHUB_TOKEN'];
  });

  it('skips branch creation if branch already exists', async () => {
    mockOctokit.repos.getBranch.mockReset();
    mockOctokit.repos.getBranch
      .mockResolvedValueOnce({ data: { commit: { sha: 'abc123' } } }) // default branch
      .mockResolvedValueOnce({ data: {} }); // fix branch exists

    await createFixPR({
      gitHubRepo: 'owner/repo',
      category: 'meta-description',
      fixResults: [baseFixResult],
      siteId: 'acme',
      date: '2026-03-21',
      fixPRTracking: baseTracking,
      githubToken: 'tok',
    });
    expect(mockOctokit.git.createRef).not.toHaveBeenCalled();
  });
});

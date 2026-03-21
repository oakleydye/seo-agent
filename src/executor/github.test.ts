import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuditPR } from './github.js';
import type { AuditFindings } from '../types/index.js';

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
  mockOctokit.repos.getBranch.mockRejectedValueOnce({ status: 404 }); // branch doesn't exist
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
    mockOctokit.repos.getBranch
      .mockResolvedValueOnce({ data: { commit: { sha: 'abc123' } } }) // default branch
      .mockResolvedValueOnce({ data: {} }); // audit branch exists

    await createAuditPR({ gitHubRepo: 'owner/repo', findings: baseFindings, githubToken: 'tok' });
    expect(mockOctokit.git.createRef).not.toHaveBeenCalled();
  });

  it('PR title includes siteId from formatPRTitle', async () => {
    await createAuditPR({ gitHubRepo: 'owner/repo', findings: baseFindings, githubToken: 'tok' });
    const callArgs = mockOctokit.pulls.create.mock.calls[0]![0] as { title: string };
    expect(callArgs.title).toContain('test-site');
  });
});

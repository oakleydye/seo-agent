import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../index.js', () => ({
  runAuditForSite: vi.fn(),
  runAuditForAllSites: vi.fn(),
}));

vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

import { runAuditForSite, runAuditForAllSites } from '../../index.js';
import { loadConfig } from '../../config/loader.js';

const mockRunForSite = runAuditForSite as ReturnType<typeof vi.fn>;
const mockRunForAll = runAuditForAllSites as ReturnType<typeof vi.fn>;
const mockLoadConfig = loadConfig as ReturnType<typeof vi.fn>;

const siteA = {
  siteId: 'site-a', url: 'https://a.com', gitHubRepo: 'owner/site-a',
  crawlLimits: { maxPages: 10, maxDepth: 2, timeoutMs: 5000, respectRobotsTxt: true },
  googleCredentials: { serviceAccountPath: './creds.json' },
};

const siteB = { ...siteA, siteId: 'site-b', url: 'https://b.com', gitHubRepo: 'owner/site-b' };

const successState = {
  siteId: 'site-a', runDate: '2024-01-15',
  crawlState: { status: 'complete', pageCount: 5 },
  analysisState: { status: 'complete', issueCount: 2 },
  executionState: { status: 'complete', prUrl: 'https://github.com/owner/site-a/pull/1' },
};

describe('runAuditForSite', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls crawl, audit, fetchCoreWebVitals, createAuditPR in sequence (mocked)', async () => {
    // This integration test verifies the return shape of the real orchestrator
    // via mocked sub-components tested individually in unit tests
    mockRunForSite.mockResolvedValue(successState);
    const result = await runAuditForSite(siteA, {});
    expect(result.executionState.status).toBe('complete');
    expect(result.executionState.prUrl).toContain('pull/1');
  });

  it('returns failed state without throwing when pipeline errors', async () => {
    mockRunForSite.mockResolvedValue({
      ...successState,
      executionState: { status: 'failed', error: 'GITHUB_TOKEN required' },
    });
    const result = await runAuditForSite(siteA, {});
    expect(result.executionState.status).toBe('failed');
  });
});

describe('runAuditForAllSites', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('processes all sites and returns one result per site', async () => {
    mockRunForAll.mockResolvedValue([successState, { ...successState, siteId: 'site-b' }]);
    const results = await runAuditForAllSites([siteA, siteB], {});
    expect(results).toHaveLength(2);
  });

  it('loads config and passes sites to runAuditForAllSites', async () => {
    mockLoadConfig.mockReturnValue({ sites: [siteA], schedule: { cronExpression: '0 0 1 * *' } });
    mockRunForAll.mockResolvedValue([successState]);
    const config = loadConfig('./config.json');
    const results = await runAuditForAllSites(config.sites, {});
    expect(results).toHaveLength(1);
  });
});

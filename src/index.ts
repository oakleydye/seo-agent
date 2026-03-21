import 'dotenv/config';
import { logger } from './utils/logger.js';
import { crawl } from './crawler/index.js';
import { audit } from './auditor/index.js';
import { fetchCoreWebVitals } from './fetcher/pagespeed.js';
import { createAuditPR } from './executor/github.js';
import type { SiteConfig, AuditRunState, AuditFindings } from './types/index.js';

export interface RunAuditOptions {
  dryRun?: boolean;
  githubToken?: string;
  pagespeedApiKey?: string;
}

/**
 * Run the full audit pipeline for a single site.
 * Returns AuditRunState describing the outcome of each pipeline stage.
 * Never throws — all errors captured in AuditRunState.
 */
export async function runAuditForSite(
  site: SiteConfig,
  options: RunAuditOptions = {},
): Promise<AuditRunState> {
  const runDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const state: AuditRunState = {
    siteId: site.siteId,
    runDate,
    crawlState: { status: 'pending', pageCount: 0 },
    analysisState: { status: 'pending', issueCount: 0 },
    executionState: { status: 'pending' },
  };

  logger.info({ siteId: site.siteId, url: site.url }, 'Starting audit pipeline');

  // ─── Stage 1: Crawl ───────────────────────────────────────────────────────
  let pages;
  try {
    pages = await crawl(site.url, site.crawlLimits);
    state.crawlState = { status: 'complete', pageCount: pages.length };
    logger.info({ siteId: site.siteId, pageCount: pages.length }, 'Crawl complete');
  } catch (err) {
    const message = (err as Error).message;
    state.crawlState = { status: 'failed', pageCount: 0, error: message };
    state.analysisState = { status: 'failed', issueCount: 0, error: 'Skipped — crawl failed' };
    state.executionState = { status: 'failed', error: 'Skipped — crawl failed' };
    logger.error({ siteId: site.siteId, error: message }, 'Crawl failed');
    return state;
  }

  // ─── Stage 2: Audit ───────────────────────────────────────────────────────
  let issues;
  try {
    issues = audit(pages);
    state.analysisState = { status: 'complete', issueCount: issues.length };
  } catch (err) {
    const message = (err as Error).message;
    state.analysisState = { status: 'failed', issueCount: 0, error: message };
    state.executionState = { status: 'failed', error: 'Skipped — audit failed' };
    logger.error({ siteId: site.siteId, error: message }, 'Audit failed');
    return state;
  }

  // ─── Stage 3: PageSpeed Insights (optional — failure does not abort) ─────
  const vitals = await fetchCoreWebVitals(site.url, options.pagespeedApiKey).catch(err => {
    logger.warn({ siteId: site.siteId, error: (err as Error).message }, 'PageSpeed fetch failed — continuing without vitals');
    return null;
  });

  const findings: AuditFindings = {
    siteId: site.siteId,
    auditDate: runDate,
    pagesAudited: pages.length,
    issues,
    coreWebVitals: vitals ?? undefined,
  };

  // ─── Stage 4: Create PR (or skip in dry-run mode) ─────────────────────────
  if (options.dryRun) {
    logger.info({ siteId: site.siteId }, 'Dry run — skipping PR creation');
    state.executionState = { status: 'complete', error: 'dry-run: no PR created' };
    return state;
  }

  try {
    const pr = await createAuditPR({
      gitHubRepo: site.gitHubRepo,
      findings,
      githubToken: options.githubToken,
    });
    state.executionState = {
      status: 'complete',
      prUrl: pr.prUrl,
      prCreatedAt: new Date().toISOString(),
    };
    logger.info({ siteId: site.siteId, prUrl: pr.prUrl }, 'Audit PR created');
  } catch (err) {
    const message = (err as Error).message;
    state.executionState = { status: 'failed', error: message };
    logger.error({ siteId: site.siteId, error: message }, 'PR creation failed');
  }

  return state;
}

/**
 * Run the audit pipeline for all sites in the config sequentially.
 * Each site is processed independently — failure on one site does not prevent others.
 * Returns an array of AuditRunState, one per site.
 */
export async function runAuditForAllSites(
  sites: SiteConfig[],
  options: RunAuditOptions = {},
): Promise<AuditRunState[]> {
  const results: AuditRunState[] = [];

  for (const site of sites) {
    logger.info({ siteId: site.siteId }, 'Processing site');
    const state = await runAuditForSite(site, options);
    results.push(state);

    const finalStatus = state.executionState.status;
    if (finalStatus === 'complete') {
      logger.info({ siteId: site.siteId, prUrl: state.executionState.prUrl }, 'Site audit complete');
    } else {
      logger.error({ siteId: site.siteId, stage: 'execution', error: state.executionState.error }, 'Site audit failed');
    }
  }

  const succeeded = results.filter(r => r.executionState.status === 'complete').length;
  logger.info({ total: sites.length, succeeded, failed: sites.length - succeeded }, 'All sites processed');

  return results;
}

import { logger } from '../utils/logger.js';
import { generateFixedFile, groupIssuesBySourceFile, FixGenerationError } from './generator.js';
import { validateFixedCode } from './validator.js';
import { createFixPR } from '../executor/github.js';
import {
  categorizeFixRisk,
  type Issue,
  type Fix,
  type FixResult,
  type FixRunState,
  type FixCategory,
  type FixPRTracking,
  type SiteConfig,
  type AuditFindings,
} from '../types/index.js';

export interface RunFixOptions {
  dryRun?: boolean;
  githubToken?: string;
  auditPRNumber?: number;
  includeSchemaMarkup?: boolean;
}

/** Map from Phase 1 auditor rule IDs to Phase 2 FixCategory values. */
const RULE_TO_CATEGORY: Record<string, FixCategory> = {
  'missing-title-tag': 'title-tag',
  'missing-meta-description': 'meta-description',
  'missing-og-tags': 'og-tags',
  'missing-alt-text': 'alt-text',
  'duplicate-heading': 'heading-hierarchy',
  'heading-hierarchy': 'heading-hierarchy',
  'invalid-heading-hierarchy': 'heading-hierarchy',
};

/**
 * Map a page URL to its most likely Next.js App Router source file path.
 * Heuristic: strip domain, convert path segments to 'app/{path}/page.tsx'.
 * Returns null for URLs that can't be mapped (external, non-page).
 */
function resolveSourceFileFromUrl(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl);
    const pathname = url.pathname;

    if (pathname === '/' || pathname === '') {
      return 'app/page.tsx';
    }

    // Strip leading/trailing slashes, map to app/{path}/page.tsx
    const segments = pathname.replace(/^\/|\/$/g, '');
    return `app/${segments}/page.tsx`;
  } catch {
    return null;
  }
}

/**
 * Run the fix pipeline for a single site.
 * Reads issues from AuditFindings, groups by source file, generates fixes via LLM,
 * validates build, and submits one PR per fix category.
 *
 * Never throws — all errors captured in FixRunState.
 */
export async function runFixForSite(
  site: SiteConfig,
  findings: AuditFindings,
  options: RunFixOptions = {},
): Promise<FixRunState> {
  const runDate = new Date().toISOString().slice(0, 10);
  const state: FixRunState = {
    siteId: site.siteId,
    runDate,
    fixState: { status: 'pending', fixCount: 0, prUrls: [] },
  };

  const fixPRTracking: FixPRTracking = site.fixPRTracking ?? {
    submittedCount: 0,
    firstRunLimit: 5,
  };

  logger.info({ siteId: site.siteId, issueCount: findings.issues.length }, 'Starting fix pipeline');

  try {
    // ── Filter to fixable issues ────────────────────────────────────────────
    const fixableIssues = findings.issues.filter(issue => issue.rule in RULE_TO_CATEGORY);
    logger.info({ siteId: site.siteId, fixableCount: fixableIssues.length }, 'Fixable issues identified');

    // ── Group issues by source file ────────────────────────────────────────
    const fileGroups = groupIssuesBySourceFile(
      fixableIssues,
      (issue: Issue) => resolveSourceFileFromUrl(issue.pageUrl),
    );

    // ── Generate fixes per file (batch-per-file LLM calls) ────────────────
    const allFixes: Fix[] = [];

    for (const [filePath, issues] of fileGroups) {
      // Build source code context from issue information
      // (The actual file content is available in the cloned repo during validation)
      const sourceCodeContext = issues
        .map(i => `// Page: ${i.pageUrl}\n// Issue: ${i.rule}: ${i.description}`)
        .join('\n');

      let fixedContent: string;
      try {
        fixedContent = await generateFixedFile({
          filePath,
          sourceCode: sourceCodeContext,
          issues,
        });
      } catch (err: unknown) {
        if (err instanceof FixGenerationError) {
          logger.warn({ filePath, error: err.message }, 'Fix generation failed for file — skipping');
          continue;
        }
        throw err;
      }

      for (const issue of issues) {
        const category = RULE_TO_CATEGORY[issue.rule]!;
        const fix: Fix = {
          id: `fix-${category}-${issue.id}-${runDate}`,
          category,
          risk: categorizeFixRisk(issue),
          sourceFile: filePath,
          originalContent: sourceCodeContext,
          fixedContent,
          issueIds: [issue.id],
        };
        allFixes.push(fix);
      }
    }

    // ── Group fixes by category for one-PR-per-category ───────────────────
    const fixesByCategory = new Map<FixCategory, Fix[]>();
    for (const fix of allFixes) {
      const existing = fixesByCategory.get(fix.category) ?? [];
      existing.push(fix);
      fixesByCategory.set(fix.category, existing);
    }

    // ── Validate and submit one PR per category ────────────────────────────
    const allResults: FixResult[] = [];

    for (const [category, fixes] of fixesByCategory) {
      // Build validation (soft gate)
      const validation = await validateFixedCode({
        gitHubRepo: site.gitHubRepo,
        fixes,
        githubToken: options.githubToken,
      });

      const results: FixResult[] = fixes.map(fix => ({
        fix,
        buildPassed: validation.success,
        buildError: validation.error,
        submittedAsPR: false,
      }));

      if (!options.dryRun) {
        const pr = await createFixPR({
          gitHubRepo: site.gitHubRepo,
          category,
          fixResults: results,
          siteId: site.siteId,
          date: runDate,
          auditPRNumber: options.auditPRNumber,
          fixPRTracking,
          githubToken: options.githubToken,
        });

        for (const result of results) {
          result.submittedAsPR = true;
          result.prUrl = pr.prUrl;
          result.prNumber = pr.prNumber;
        }

        state.fixState.prUrls.push(pr.prUrl);
        logger.info({ category, prUrl: pr.prUrl }, 'Fix PR created');
      }

      allResults.push(...results);
    }

    state.fixState.status = 'complete';
    state.fixState.fixCount = allResults.length;
    logger.info({ siteId: site.siteId, fixCount: allResults.length }, 'Fix pipeline complete');
  } catch (err: unknown) {
    const message = (err as Error).message;
    state.fixState.status = 'failed';
    state.fixState.error = message;
    logger.error({ siteId: site.siteId, error: message }, 'Fix pipeline failed');
  }

  return state;
}

/**
 * Run the fix pipeline for all sites sequentially.
 * Failure on one site does not prevent others from running.
 */
export async function runFixForAllSites(
  sites: SiteConfig[],
  allFindings: Map<string, AuditFindings>,
  options: RunFixOptions = {},
): Promise<FixRunState[]> {
  const results: FixRunState[] = [];

  for (const site of sites) {
    const findings = allFindings.get(site.siteId);
    if (!findings) {
      logger.warn({ siteId: site.siteId }, 'No audit findings for site — skipping fix');
      results.push({
        siteId: site.siteId,
        runDate: new Date().toISOString().slice(0, 10),
        fixState: { status: 'failed', fixCount: 0, prUrls: [], error: 'No audit findings available' },
      });
      continue;
    }

    const state = await runFixForSite(site, findings, options);
    results.push(state);
  }

  const succeeded = results.filter(r => r.fixState.status === 'complete').length;
  logger.info(
    { total: sites.length, succeeded, failed: sites.length - succeeded },
    'All sites fix pipeline complete',
  );

  return results;
}

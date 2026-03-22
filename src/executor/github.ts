import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger.js';
import { formatPRTitle, formatPRBody, formatFixPRTitle, formatFixPRBody, getFixPRLabels } from './pr-formatter.js';
import type { AuditFindings, FixCategory, RiskCategory, FixResult, FixPRTracking } from '../types/index.js';

export interface CreatePROptions {
  gitHubRepo: string;  // "owner/repo" format
  findings: AuditFindings;
  githubToken?: string;
}

export interface PRResult {
  prUrl: string;
  prNumber: number;
  wasExisting: boolean;
}

/**
 * Create (or find existing) audit PR for the given findings.
 * Branch naming: seo-audit/YYYY-MM-DD
 * Idempotent: returns existing PR if branch/PR already exists for today.
 */
export async function createAuditPR(options: CreatePROptions): Promise<PRResult> {
  const { gitHubRepo, findings } = options;
  const token = options.githubToken ?? process.env['GITHUB_TOKEN'];

  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required for PR creation');
  }

  const [owner, repo] = gitHubRepo.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid gitHubRepo format: "${gitHubRepo}" — expected "owner/repo"`);
  }

  const octokit = new Octokit({ auth: token });
  const branchName = `seo-audit/${findings.auditDate}`;
  const title = formatPRTitle(findings);
  const body = formatPRBody(findings);

  // ─── Check for existing PR ───────────────────────────────────────────────
  const existingPRs = await octokit.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${branchName}`,
    per_page: 1,
  });

  if (existingPRs.data.length > 0) {
    const existing = existingPRs.data[0]!;
    logger.info({ branchName, prUrl: existing.html_url }, 'Existing PR found — skipping creation');
    return {
      prUrl: existing.html_url,
      prNumber: existing.number,
      wasExisting: true,
    };
  }

  // ─── Get default branch SHA (needed to create new branch) ────────────────
  const repoData = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.data.default_branch;

  const defaultBranchData = await octokit.repos.getBranch({
    owner,
    repo,
    branch: defaultBranch,
  });
  const baseSha = defaultBranchData.data.commit.sha;

  // ─── Create branch if it doesn't exist ───────────────────────────────────
  let branchExists = false;
  try {
    await octokit.repos.getBranch({ owner, repo, branch: branchName });
    branchExists = true;
    logger.info({ branchName }, 'Branch already exists, skipping creation');
  } catch (err: unknown) {
    const octokitErr = err as { status?: number };
    if (octokitErr?.status !== 404) throw err;
    // Branch does not exist — create it
  }

  if (!branchExists) {
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
    logger.info({ branchName }, 'Branch created');
  }

  // ─── Create PR ────────────────────────────────────────────────────────────
  const prResponse = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head: branchName,
    base: defaultBranch,
  });

  logger.info({ prUrl: prResponse.data.html_url, prNumber: prResponse.data.number }, 'PR created');

  return {
    prUrl: prResponse.data.html_url,
    prNumber: prResponse.data.number,
    wasExisting: false,
  };
}

// ─── Phase 2: Fix PR creation ─────────────────────────────────────────────────

export interface FixPROptions {
  gitHubRepo: string;          // "owner/repo"
  category: FixCategory;
  fixResults: FixResult[];     // all fix results for this category PR
  siteId: string;              // for PR title
  date: string;                // YYYY-MM-DD
  auditPRNumber?: number;      // PR number from the audit that found these issues
  fixPRTracking: FixPRTracking; // for first-run label logic
  githubToken?: string;
}

/**
 * Create (or find existing) fix PR for a given fix category.
 * Branch naming: seo-fix/{category}/YYYY-MM-DD
 * Idempotent: returns existing PR if branch/PR already exists for today.
 * Applies labels: seo-auto-fix, needs-review (if applicable), first-run (if applicable).
 */
export async function createFixPR(options: FixPROptions): Promise<PRResult> {
  const { gitHubRepo, category, fixResults, siteId, date, auditPRNumber, fixPRTracking } = options;
  const token = options.githubToken ?? process.env['GITHUB_TOKEN'];

  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required for PR creation');
  }

  const [owner, repo] = gitHubRepo.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid gitHubRepo format: "${gitHubRepo}" — expected "owner/repo"`);
  }

  const octokit = new Octokit({ auth: token });
  const branchName = `seo-fix/${category}/${date}`;
  const title = formatFixPRTitle(category, date, siteId);
  const body = formatFixPRBody(fixResults, auditPRNumber);
  const risk: RiskCategory = fixResults[0]?.fix.risk ?? 'needs-review';
  const labels = getFixPRLabels(risk, fixPRTracking, fixResults);

  // ─── Check for existing PR ───────────────────────────────────────────────
  const existingPRs = await octokit.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${branchName}`,
    per_page: 1,
  });

  if (existingPRs.data.length > 0) {
    const existing = existingPRs.data[0]!;
    logger.info({ branchName, prUrl: existing.html_url }, 'Existing fix PR found — skipping creation');
    return {
      prUrl: existing.html_url,
      prNumber: existing.number,
      wasExisting: true,
    };
  }

  // ─── Get default branch SHA ───────────────────────────────────────────────
  const repoData = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.data.default_branch;

  const defaultBranchData = await octokit.repos.getBranch({ owner, repo, branch: defaultBranch });
  const baseSha = defaultBranchData.data.commit.sha;

  // ─── Create branch if it doesn't exist ───────────────────────────────────
  let branchExists = false;
  try {
    await octokit.repos.getBranch({ owner, repo, branch: branchName });
    branchExists = true;
    logger.info({ branchName }, 'Fix branch already exists, skipping creation');
  } catch (err: unknown) {
    const octokitErr = err as { status?: number };
    if (octokitErr?.status !== 404) throw err;
  }

  if (!branchExists) {
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
    logger.info({ branchName }, 'Fix branch created');
  }

  // ─── Ensure labels exist on the repo ─────────────────────────────────────
  const labelColors: Record<string, string> = {
    'seo-auto-fix': '0075ca',
    'needs-review': 'e4e669',
    'first-run': 'd93f0b',
  };

  for (const label of labels) {
    try {
      await octokit.issues.createLabel({
        owner,
        repo,
        name: label,
        color: labelColors[label] ?? 'ededed',
      });
    } catch (err: unknown) {
      // 422 = label already exists — expected, ignore
      const octokitErr = err as { status?: number };
      if (octokitErr?.status !== 422) {
        logger.warn({ label, error: (err as Error).message }, 'Failed to create label — continuing');
      }
    }
  }

  // ─── Create PR ────────────────────────────────────────────────────────────
  const prResponse = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head: branchName,
    base: defaultBranch,
  });

  // Apply labels
  if (labels.length > 0) {
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: prResponse.data.number,
      labels,
    });
  }

  logger.info(
    { prUrl: prResponse.data.html_url, prNumber: prResponse.data.number, labels },
    'Fix PR created',
  );

  return {
    prUrl: prResponse.data.html_url,
    prNumber: prResponse.data.number,
    wasExisting: false,
  };
}

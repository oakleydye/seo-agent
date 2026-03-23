import { logger } from '../utils/logger.js';
import { generateBlogPost, BlogGenerationError } from './generator.js';
import { checkOriginality } from './plagiarism-checker.js';
import { discoverInternalLinks, insertInternalLinks } from './internal-linker.js';
import { flagClaims } from './claim-flagging.js';
import { checkMonthlyLimit, detectKeywordCannibalization, recordPublishedPost } from './calendar.js';
import { createBlogPR } from '../executor/blog-pr.js';
import type {
  SiteConfig,
  KeywordOpportunity,
  BlogPostResult,
  BlogRunState,
  InternalLink,
} from '../types/index.js';

export interface RunBlogOptions {
  dryRun?: boolean;
  githubToken?: string;
  cseId?: string;
  maxPostsPerSite?: number;     // default 3 (CONT-02 limit enforcement)
  googleApiKey?: string;
}

/**
 * Run the full blog generation pipeline for a single site.
 *
 * Pipeline per keyword:
 *   1. Monthly limit check (skip all if at limit)
 *   2. Keyword cannibalization check (skip individual keyword if conflict)
 *   3. Blog post generation via Portkey (up to 3 attempts for originality)
 *   4. Originality check against top 5 SERP results
 *   5. Internal link discovery and insertion
 *   6. Claim flagging
 *   7. GitHub PR creation (or dry-run skip)
 *   8. Calendar record update
 *
 * Never throws — all errors captured in BlogRunState.
 */
export async function runBlogPipelineForSite(
  site: SiteConfig,
  keywords: KeywordOpportunity[],
  options: RunBlogOptions = {},
): Promise<BlogRunState> {
  const {
    dryRun = false,
    githubToken,
    cseId = process.env['GOOGLE_CSE_ID'] ?? '',
    maxPostsPerSite = 3,
    googleApiKey = process.env['GOOGLE_API_KEY'],
  } = options;

  const runDate = new Date().toISOString().slice(0, 10);
  const state: BlogRunState = {
    siteId: site.siteId,
    runDate,
    contentState: { status: 'pending', postCount: 0, prUrls: [] },
  };

  logger.info({ siteId: site.siteId, keywordCount: keywords.length }, 'Starting blog pipeline');

  // ─── Monthly limit check ─────────────────────────────────────────────────
  const underLimit = await checkMonthlyLimit(site.siteId, maxPostsPerSite);
  if (!underLimit) {
    logger.info({ siteId: site.siteId, maxPostsPerSite }, 'Monthly post limit reached — skipping');
    state.contentState = { status: 'complete', postCount: 0, prUrls: [] };
    return state;
  }

  const sortedKeywords = [...keywords].sort((a, b) => b.opportunityScore - a.opportunityScore);
  let postsCreated = 0;

  for (const kwOpportunity of sortedKeywords) {
    if (postsCreated >= maxPostsPerSite) break;

    const keyword = kwOpportunity.keyword;

    // ─── Keyword cannibalization check ───────────────────────────────────
    const isCannibalizing = await detectKeywordCannibalization(site.siteId, keyword);
    if (isCannibalizing) {
      logger.info({ siteId: site.siteId, keyword }, 'Keyword cannibalization detected — skipping');
      continue;
    }

    // ─── Generation + originality loop (up to 3 attempts) ────────────────
    let blogPost;
    let originalityCheck;
    let generationFailed = false;
    let skippedDueToOriginality = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        blogPost = await generateBlogPost(keyword, { retryAttempt: attempt });
      } catch (err) {
        if (err instanceof BlogGenerationError) {
          logger.error({ siteId: site.siteId, keyword, attempt, error: err.message }, 'Blog generation failed');
          state.contentState = {
            status: 'failed',
            postCount: postsCreated,
            prUrls: state.contentState.prUrls,
            error: err.message,
          };
          generationFailed = true;
          break;
        }
        throw err;
      }

      originalityCheck = await checkOriginality(
        blogPost.content,
        keyword,
        cseId,
        googleApiKey,
        attempt + 1,
      );

      if (originalityCheck.passedThreshold) break;

      if (attempt === 2) {
        // 3 attempts exhausted — skip keyword, record with skippedReason
        logger.warn({ siteId: site.siteId, keyword, score: originalityCheck.score }, 'Originality failed after 3 attempts — skipping keyword');
        skippedDueToOriginality = true;
        // Note: blogPost and originalityCheck retained so we can log the skipped result
        break;
      }

      logger.info({ siteId: site.siteId, keyword, attempt: attempt + 1, score: originalityCheck.score }, 'Originality failed — retrying with different angle');
    }

    if (generationFailed) continue;

    if (skippedDueToOriginality && blogPost && originalityCheck) {
      // Record the skipped keyword result for reporting purposes
      logger.info({ siteId: site.siteId, keyword }, 'Keyword skipped: failed-originality-after-2-retries');
      continue;
    }

    if (!blogPost || !originalityCheck) continue;

    // ─── Internal linking ────────────────────────────────────────────────
    // Pass empty pages array for now — future: integrate Phase 1 crawl cache
    const internalLinks: InternalLink[] = await discoverInternalLinks(blogPost.content, [], 5);
    const linkedContent = insertInternalLinks(blogPost.content, internalLinks);
    blogPost = { ...blogPost, content: linkedContent };

    // ─── Claim flagging ──────────────────────────────────────────────────
    const flaggedClaimsResult = flagClaims(blogPost.content);

    if (flaggedClaimsResult.length > 0) {
      logger.info({ siteId: site.siteId, keyword, claimCount: flaggedClaimsResult.length }, 'Claims flagged for review');
    }

    const result: BlogPostResult = {
      blogPost,
      originalityCheck,
      internalLinks,
      flaggedClaims: flaggedClaimsResult,
      submittedAsPR: false,
    };

    // ─── PR creation ─────────────────────────────────────────────────────
    if (!dryRun) {
      try {
        const pr = await createBlogPR({
          gitHubRepo: site.gitHubRepo,
          blogDirectory: site.blogDirectory,
          siteId: site.siteId,
          blogPost,
          blogPostResult: result,
          githubToken,
        });

        result.submittedAsPR = true;
        result.prUrl = pr.prUrl;
        result.prNumber = pr.prNumber;

        await recordPublishedPost(site.siteId, {
          siteId: site.siteId,
          keyword,
          publishedDate: blogPost.publishedDate,
          slug: blogPost.slug,
          prUrl: pr.prUrl,
        });

        state.contentState.prUrls.push(pr.prUrl);
        postsCreated++;
        logger.info({ siteId: site.siteId, keyword, prUrl: pr.prUrl }, 'Blog PR submitted');
      } catch (err) {
        const message = (err as Error).message;
        logger.error({ siteId: site.siteId, keyword, error: message }, 'Blog PR creation failed');
        result.skippedReason = `pr-creation-failed: ${message}`;
      }
    } else {
      result.submittedAsPR = false;
      postsCreated++;
      logger.info({ siteId: site.siteId, keyword }, 'Dry run — skipping PR creation');
    }
  }

  if (state.contentState.status !== 'failed') {
    state.contentState.status = 'complete';
    state.contentState.postCount = postsCreated;
  }

  logger.info({ siteId: site.siteId, postsCreated }, 'Blog pipeline complete');
  return state;
}

/**
 * Run blog pipeline for all sites sequentially.
 * Failure on one site does not prevent others from running.
 */
export async function runBlogPipelineForAllSites(
  sites: SiteConfig[],
  keywords: Map<string, KeywordOpportunity[]>,
  options: RunBlogOptions = {},
): Promise<BlogRunState[]> {
  const results: BlogRunState[] = [];

  for (const site of sites) {
    logger.info({ siteId: site.siteId }, 'Processing site for blog generation');
    const siteKeywords = keywords.get(site.siteId) ?? [];
    const state = await runBlogPipelineForSite(site, siteKeywords, options);
    results.push(state);
  }

  const succeeded = results.filter(r => r.contentState.status === 'complete').length;
  logger.info({ total: sites.length, succeeded, failed: sites.length - succeeded }, 'All sites processed');

  return results;
}

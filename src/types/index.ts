import { z } from 'zod';

// ============================================================
// TypeScript type definitions
// ============================================================

export type Severity = 'critical' | 'warning' | 'info';

export interface Issue {
  id: string;               // e.g. "AUDIT-01"
  rule: string;             // e.g. "missing-title-tag"
  severity: Severity;
  pageUrl: string;
  description: string;
  details?: string;
}

export interface PageData {
  url: string;
  statusCode: number;
  html: string;
  redirectChain: string[];  // empty if no redirects
  finalUrl: string;         // after redirects
  fetchedAt: Date;
}

export interface CrawlOptions {
  maxPages: number;         // default 500
  maxDepth: number;         // default 3
  timeoutMs: number;        // default 30000
  respectRobotsTxt: boolean; // default true
}

export interface SiteConfig {
  siteId: string;
  url: string;              // root URL of Next.js site
  gitHubRepo: string;       // owner/repo format e.g. "acme/website"
  crawlLimits: CrawlOptions;
  googleCredentials: {
    serviceAccountPath: string; // path to Google service account JSON
  };
  fixPRTracking?: {
    submittedCount: number;
    firstRunLimit: number;
  };
  blogDirectory?: string;       // e.g. "content/blog", "posts", "app/blog"
}

export interface Config {
  sites: SiteConfig[];
  schedule: {
    cronExpression: string; // e.g. "0 0 1 * *" = 1st of month
  };
}

export interface CoreWebVitals {
  lcp: number | null;       // Largest Contentful Paint (ms)
  fid: number | null;       // First Input Delay (ms)
  cls: number | null;       // Cumulative Layout Shift (unitless)
  fcp: number | null;       // First Contentful Paint (ms)
  ttfb: number | null;      // Time to First Byte (ms)
  performanceScore: number | null; // 0-100
  source: 'pagespeed-insights';
}

export interface AuditFindings {
  siteId: string;
  auditDate: string;        // ISO date string YYYY-MM-DD
  pagesAudited: number;
  issues: Issue[];
  coreWebVitals?: CoreWebVitals;
}

export interface AuditRunState {
  siteId: string;
  runDate: string;
  crawlState: {
    status: 'pending' | 'complete' | 'failed';
    pageCount: number;
    error?: string;
  };
  analysisState: {
    status: 'pending' | 'complete' | 'failed';
    issueCount: number;
    error?: string;
  };
  executionState: {
    status: 'pending' | 'complete' | 'failed';
    prUrl?: string;
    prCreatedAt?: string;
    error?: string;
  };
}

// ============================================================
// Zod schemas for runtime validation
// ============================================================

export const SeveritySchema = z.enum(['critical', 'warning', 'info']);

export const IssueSchema = z.object({
  id: z.string(),
  rule: z.string(),
  severity: SeveritySchema,
  pageUrl: z.string().url(),
  description: z.string(),
  details: z.string().optional(),
});

export const CrawlOptionsSchema = z.object({
  maxPages: z.number().int().positive().default(500),
  maxDepth: z.number().int().positive().default(3),
  timeoutMs: z.number().int().positive().default(30000),
  respectRobotsTxt: z.boolean().default(true),
});

export const SiteConfigSchema = z.object({
  siteId: z.string().min(1),
  url: z.string().url(),
  gitHubRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  crawlLimits: CrawlOptionsSchema,
  googleCredentials: z.object({
    serviceAccountPath: z.string(),
  }),
  fixPRTracking: z.object({
    submittedCount: z.number().int().nonnegative().default(0),
    firstRunLimit: z.number().int().positive().default(5),
  }).default({ submittedCount: 0, firstRunLimit: 5 }).optional(),
  blogDirectory: z.string().optional(),
});

export const ConfigSchema = z.object({
  sites: z.array(SiteConfigSchema).min(1),
  schedule: z.object({
    cronExpression: z.string().min(1),
  }),
});

// ============================================================
// Phase 2: Auto-Fix types
// ============================================================

export type FixCategory =
  | 'title-tag'
  | 'meta-description'
  | 'og-tags'
  | 'alt-text'
  | 'heading-hierarchy'
  | 'schema-markup';

export type RiskCategory = 'low-risk' | 'needs-review';

export interface FixPRTracking {
  submittedCount: number;
  firstRunLimit: number; // default 5 — first N PRs get 'first-run' label regardless of risk
}

export interface Fix {
  id: string;               // unique ID for this fix, e.g. "fix-title-tag-2026-03-21"
  category: FixCategory;
  risk: RiskCategory;
  sourceFile: string;       // relative path in client repo, e.g. "app/about/page.tsx"
  originalContent: string;  // full file content before fix
  fixedContent: string;     // full file content after LLM fix
  issueIds: string[];       // Issue IDs that prompted this fix
}

export interface FixResult {
  fix: Fix;
  buildPassed: boolean;
  buildError?: string;      // stderr/stdout from next build if it failed
  submittedAsPR: boolean;
  prUrl?: string;
  prNumber?: number;
}

export interface FixRunState {
  siteId: string;
  runDate: string;          // ISO date string YYYY-MM-DD
  fixState: {
    status: 'pending' | 'complete' | 'failed';
    fixCount: number;
    prUrls: string[];
    error?: string;
  };
}

// ============================================================
// Phase 2: Keyword opportunity types
// ============================================================

export interface KeywordOpportunity {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;              // click-through rate, 0-1
  position: number;         // average position in SERPs
  opportunityScore: number; // derived: impressions * (1 - ctr) — higher = more untapped traffic
}

// ============================================================
// Phase 2: Risk classification
// ============================================================

/** Rules from the auditor that are safe to auto-fix (do not affect visible rendering). */
export const LOW_RISK_RULES = [
  'missing-title-tag',
  'missing-meta-description',
  'missing-og-tags',
  'missing-alt-text',
  'missing-canonical',
  'invalid-schema-markup',
] as const;

/**
 * Classify an audit issue as low-risk (auto-submittable) or needs-review.
 * Low-risk: meta tags, alt text, canonical, schema — do not affect page rendering.
 * Needs-review: heading hierarchy, structural HTML — affects visible content.
 */
export function categorizeFixRisk(issue: Issue): RiskCategory {
  return (LOW_RISK_RULES as readonly string[]).includes(issue.rule) ? 'low-risk' : 'needs-review';
}

// ============================================================
// Phase 2: Zod schemas
// ============================================================

export const FixCategorySchema = z.enum([
  'title-tag',
  'meta-description',
  'og-tags',
  'alt-text',
  'heading-hierarchy',
  'schema-markup',
]);

export const RiskCategorySchema = z.enum(['low-risk', 'needs-review']);

export const KeywordOpportunitySchema = z.object({
  keyword: z.string().min(1),
  clicks: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  ctr: z.number().min(0).max(1),
  position: z.number().positive(),
  opportunityScore: z.number().nonnegative(),
});

// ============================================================
// Phase 3: Blog post generation types
// ============================================================

export interface InternalLink {
  anchorText: string;
  targetUrl: string;
  relevanceScore: number;   // 0-1, cosine similarity
}

export interface OriginalityCheck {
  score: number;            // 0-100, originality %
  comparedSources: string[]; // URLs of top 5 SERP results compared
  passedThreshold: boolean; // score > 70
  attempts: number;         // how many generation attempts were made (1-3)
}

export interface BlogPost {
  slug: string;             // URL-safe, e.g. "how-to-improve-page-speed"
  title: string;            // H1/page title with target keyword
  description: string;      // SEO meta description (150-160 chars)
  keywords: string[];       // primary + secondary keywords
  publishedDate: string;    // ISO date string YYYY-MM-DD
  author: string;           // e.g. "SEO Agent (AI-generated)"
  content: string;          // Full Markdown body (500+ words)
  targetKeyword: string;    // Primary keyword this post targets
  wordCount: number;        // Computed: content.split(/\s+/).length
}

export interface BlogPostResult {
  blogPost: BlogPost;
  originalityCheck: OriginalityCheck;
  internalLinks: InternalLink[];
  flaggedClaims: string[];  // sentences flagged for human verification
  submittedAsPR: boolean;
  prUrl?: string;
  prNumber?: number;
  skippedReason?: string;   // e.g. "failed-originality-after-2-retries"
}

export interface ContentCalendarEntry {
  siteId: string;
  keyword: string;
  publishedDate: string;    // ISO date string YYYY-MM-DD
  slug: string;
  prUrl: string;
}

export interface BlogRunState {
  siteId: string;
  runDate: string;          // ISO date string YYYY-MM-DD
  contentState: {
    status: 'pending' | 'complete' | 'failed';
    postCount: number;
    prUrls: string[];
    error?: string;
  };
}

// ============================================================
// Phase 3: Zod schemas
// ============================================================

export const InternalLinkSchema = z.object({
  anchorText: z.string().min(1),
  targetUrl: z.string().url(),
  relevanceScore: z.number().min(0).max(1),
});

export const OriginalityCheckSchema = z.object({
  score: z.number().min(0).max(100),
  comparedSources: z.array(z.string()),
  passedThreshold: z.boolean(),
  attempts: z.number().int().min(1).max(3),
});

export const BlogPostSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(10).max(100),
  description: z.string().min(50).max(165),
  keywords: z.array(z.string().min(1)).min(1),
  publishedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  author: z.string().min(1),
  content: z.string().min(2000, 'content must be at least 2000 characters (~500 words)'),
  targetKeyword: z.string().min(1),
  wordCount: z.number().int().min(500),
});

export const BlogPostResultSchema = z.object({
  blogPost: BlogPostSchema,
  originalityCheck: OriginalityCheckSchema,
  internalLinks: z.array(InternalLinkSchema),
  flaggedClaims: z.array(z.string()),
  submittedAsPR: z.boolean(),
  prUrl: z.string().url().optional(),
  prNumber: z.number().int().positive().optional(),
  skippedReason: z.string().optional(),
});

export const ContentCalendarEntrySchema = z.object({
  siteId: z.string().min(1),
  keyword: z.string().min(1),
  publishedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slug: z.string().min(1),
  prUrl: z.string().url(),
});

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

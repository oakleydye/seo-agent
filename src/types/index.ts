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
});

export const ConfigSchema = z.object({
  sites: z.array(SiteConfigSchema).min(1),
  schedule: z.object({
    cronExpression: z.string().min(1),
  }),
});

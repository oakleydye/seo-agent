import { describe, it, expect } from 'vitest';
import { formatPRTitle, formatPRBody, formatFixPRTitle, formatFixPRBody, getFixPRLabels } from './pr-formatter.js';
import type { AuditFindings, FixResult, FixPRTracking } from '../types/index.js';

const baseFindings: AuditFindings = {
  siteId: 'test-site',
  auditDate: '2024-01-15',
  pagesAudited: 10,
  issues: [],
};

const findingsWithIssues: AuditFindings = {
  ...baseFindings,
  issues: [
    { id: 'AUDIT-01', rule: 'missing-title-tag', severity: 'critical', pageUrl: 'https://a.com/', description: 'Missing title' },
    { id: 'AUDIT-02', rule: 'missing-meta-description', severity: 'warning', pageUrl: 'https://a.com/about', description: 'Missing description' },
    { id: 'AUDIT-07', rule: 'missing-canonical', severity: 'info', pageUrl: 'https://a.com/blog', description: 'No canonical' },
  ],
};

describe('formatPRTitle', () => {
  it('starts with "SEO Audit:"', () => {
    expect(formatPRTitle(baseFindings)).toMatch(/^SEO Audit:/);
  });

  it('includes siteId in title', () => {
    expect(formatPRTitle(baseFindings)).toContain('test-site');
  });

  it('includes critical count when there are critical issues', () => {
    expect(formatPRTitle(findingsWithIssues)).toContain('1 critical issue');
  });

  it('does not include critical count when no critical issues', () => {
    expect(formatPRTitle(baseFindings)).not.toContain('critical');
  });
});

describe('formatPRBody', () => {
  it('contains Executive Summary section', () => {
    expect(formatPRBody(baseFindings)).toContain('## Executive Summary');
  });

  it('contains issue counts', () => {
    const body = formatPRBody(findingsWithIssues);
    expect(body).toContain('| 🔴 Critical | 1 |');
    expect(body).toContain('| 🟡 Warning | 1 |');
    expect(body).toContain('| 🔵 Info | 1 |');
  });

  it('contains All Findings table with column headers', () => {
    const body = formatPRBody(findingsWithIssues);
    expect(body).toContain('| Page URL | Rule | Severity | Description |');
  });

  it('includes Core Web Vitals section when vitals provided', () => {
    const findings: AuditFindings = {
      ...baseFindings,
      coreWebVitals: { lcp: 2500, fid: 100, cls: 0.05, fcp: 1200, ttfb: 300, performanceScore: 85, source: 'pagespeed-insights' },
    };
    expect(formatPRBody(findings)).toContain('## Core Web Vitals');
    expect(formatPRBody(findings)).toContain('2500ms');
  });

  it('omits Core Web Vitals section when vitals not provided', () => {
    expect(formatPRBody(baseFindings)).not.toContain('## Core Web Vitals');
  });

  it('escapes pipe characters in issue descriptions to prevent broken tables', () => {
    const findingsWithPipe: AuditFindings = {
      ...baseFindings,
      issues: [{
        id: 'AUDIT-01', rule: 'test', severity: 'info', pageUrl: 'https://a.com/',
        description: 'Issue with | pipe character in description',
      }],
    };
    const body = formatPRBody(findingsWithPipe);
    expect(body).toContain('\\|');
  });
});

// ─── Phase 2: Fix PR formatter tests ──────────────────────────────────────────

const baseFixResult: FixResult = {
  fix: {
    id: 'fix-meta-description-2026-03-21',
    category: 'meta-description',
    risk: 'low-risk',
    sourceFile: 'app/about/page.tsx',
    originalContent: '<head></head>',
    fixedContent: '<head><meta name="description" content="About us" /></head>',
    issueIds: ['AUDIT-01', 'AUDIT-02'],
  },
  buildPassed: true,
  submittedAsPR: false,
};

const failedFixResult: FixResult = {
  ...baseFixResult,
  fix: {
    ...baseFixResult.fix,
    id: 'fix-meta-description-fail',
    sourceFile: 'app/contact/page.tsx',
  },
  buildPassed: false,
  buildError: 'Module not found: ./missing-import',
};

describe('formatFixPRTitle', () => {
  it('returns correctly formatted title', () => {
    expect(formatFixPRTitle('meta-description', '2026-03-21', 'acme')).toBe(
      'SEO Fix [meta-description]: acme — 2026-03-21',
    );
  });

  it('includes category in brackets', () => {
    expect(formatFixPRTitle('title-tag', '2026-03-21', 'mysite')).toContain('[title-tag]');
  });

  it('includes siteId', () => {
    expect(formatFixPRTitle('alt-text', '2026-03-22', 'acme-website')).toContain('acme-website');
  });
});

describe('formatFixPRBody', () => {
  it('contains "## What Was Fixed" section', () => {
    expect(formatFixPRBody([baseFixResult])).toContain('## What Was Fixed');
  });

  it('contains "## Why This Was Applied" section', () => {
    expect(formatFixPRBody([baseFixResult])).toContain('## Why This Was Applied');
  });

  it('contains "## Changes Made" section with table header', () => {
    const body = formatFixPRBody([baseFixResult]);
    expect(body).toContain('## Changes Made');
    expect(body).toContain('| File | Issues Fixed | Build Status |');
  });

  it('contains "## Build Validation" section', () => {
    expect(formatFixPRBody([baseFixResult])).toContain('## Build Validation');
  });

  it('contains "## Discovery" section', () => {
    expect(formatFixPRBody([baseFixResult])).toContain('## Discovery');
  });

  it('includes "Discovered by audit PR #42" when auditPRNumber=42', () => {
    expect(formatFixPRBody([baseFixResult], 42)).toContain('Discovered by audit PR #42');
  });

  it('includes "Run manually" when no auditPRNumber provided', () => {
    expect(formatFixPRBody([baseFixResult])).toContain('Run manually');
  });

  it('shows "✓ Passed" for passing builds in table', () => {
    expect(formatFixPRBody([baseFixResult])).toContain('✓ Passed');
  });

  it('shows "✗ Failed" for failing builds in table', () => {
    expect(formatFixPRBody([failedFixResult])).toContain('✗ Failed');
  });

  it('shows "Build failed" text when any fixResult has buildPassed=false', () => {
    const body = formatFixPRBody([baseFixResult, failedFixResult]);
    expect(body).toContain('Build failed');
  });

  it('shows "Build passed" text when all fixResults passed', () => {
    const body = formatFixPRBody([baseFixResult]);
    expect(body).toContain('passed');
  });

  it('contains "Generated by SEO Agent" footer', () => {
    expect(formatFixPRBody([baseFixResult])).toContain('Generated by SEO Agent');
  });

  it('lists file count per category in What Was Fixed', () => {
    const body = formatFixPRBody([baseFixResult]);
    expect(body).toContain('meta-description');
    expect(body).toContain('1 file');
  });
});

describe('getFixPRLabels', () => {
  const tracking5: FixPRTracking = { submittedCount: 2, firstRunLimit: 5 };
  const trackingOver: FixPRTracking = { submittedCount: 6, firstRunLimit: 5 };

  it('always includes "seo-auto-fix" label', () => {
    expect(getFixPRLabels('low-risk', tracking5)).toContain('seo-auto-fix');
  });

  it('low-risk within firstRunLimit returns ["seo-auto-fix", "first-run"]', () => {
    expect(getFixPRLabels('low-risk', tracking5)).toEqual(['seo-auto-fix', 'first-run']);
  });

  it('low-risk over firstRunLimit returns ["seo-auto-fix"]', () => {
    expect(getFixPRLabels('low-risk', trackingOver)).toEqual(['seo-auto-fix']);
  });

  it('needs-review risk returns ["seo-auto-fix", "needs-review"] when over firstRunLimit', () => {
    expect(getFixPRLabels('needs-review', trackingOver)).toEqual(['seo-auto-fix', 'needs-review']);
  });

  it('needs-review within firstRunLimit returns all three labels', () => {
    expect(getFixPRLabels('needs-review', tracking5)).toEqual(['seo-auto-fix', 'needs-review', 'first-run']);
  });

  it('adds "needs-review" when any fixResult has buildPassed=false', () => {
    const labels = getFixPRLabels('low-risk', trackingOver, [failedFixResult]);
    expect(labels).toContain('needs-review');
  });

  it('does not add "needs-review" for low-risk when all builds pass', () => {
    const labels = getFixPRLabels('low-risk', trackingOver, [baseFixResult]);
    expect(labels).not.toContain('needs-review');
  });
});

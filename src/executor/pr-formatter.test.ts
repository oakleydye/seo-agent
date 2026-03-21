import { describe, it, expect } from 'vitest';
import { formatPRTitle, formatPRBody } from './pr-formatter.js';
import type { AuditFindings } from '../types/index.js';

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

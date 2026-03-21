import { describe, it, expect } from 'vitest';
import { SeveritySchema, IssueSchema, SiteConfigSchema, ConfigSchema } from './index.js';

describe('Severity schema', () => {
  it('accepts valid severity values', () => {
    expect(SeveritySchema.parse('critical')).toBe('critical');
    expect(SeveritySchema.parse('warning')).toBe('warning');
    expect(SeveritySchema.parse('info')).toBe('info');
  });

  it('rejects invalid severity values', () => {
    expect(() => SeveritySchema.parse('high')).toThrow();
    expect(() => SeveritySchema.parse('')).toThrow();
  });
});

describe('SiteConfig schema', () => {
  const validSite = {
    siteId: 'test-site',
    url: 'https://example.com',
    gitHubRepo: 'owner/repo',
    crawlLimits: { maxPages: 100, maxDepth: 2, timeoutMs: 15000, respectRobotsTxt: true },
    googleCredentials: { serviceAccountPath: './creds.json' },
  };

  it('accepts valid site config', () => {
    const result = SiteConfigSchema.parse(validSite);
    expect(result.siteId).toBe('test-site');
  });

  it('rejects missing siteId', () => {
    const { siteId, ...withoutId } = validSite;
    expect(() => SiteConfigSchema.parse(withoutId)).toThrow();
  });

  it('rejects invalid gitHubRepo format', () => {
    expect(() => SiteConfigSchema.parse({ ...validSite, gitHubRepo: 'not-a-repo' })).toThrow();
  });
});

describe('Config schema', () => {
  it('rejects empty sites array', () => {
    expect(() => ConfigSchema.parse({ sites: [], schedule: { cronExpression: '0 0 1 * *' } })).toThrow();
  });
});

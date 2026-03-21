import { describe, it, expect } from 'vitest';
import { parseRobotsTxt, isUrlAllowed } from './robots.js';

describe('parseRobotsTxt', () => {
  it('returns empty rules for empty content', () => {
    const rules = parseRobotsTxt('');
    expect(rules.disallowedPaths).toEqual([]);
  });

  it('parses User-agent: * Disallow rules', () => {
    const content = 'User-agent: *\nDisallow: /admin/\nDisallow: /private/';
    const rules = parseRobotsTxt(content);
    expect(rules.disallowedPaths).toContain('/admin/');
    expect(rules.disallowedPaths).toContain('/private/');
  });

  it('ignores rules for other user agents', () => {
    const content = 'User-agent: Googlebot\nDisallow: /test/\n\nUser-agent: *\nDisallow: /allowed-only-for-us/';
    const rules = parseRobotsTxt(content);
    expect(rules.disallowedPaths).not.toContain('/test/');
    expect(rules.disallowedPaths).toContain('/allowed-only-for-us/');
  });

  it('ignores empty Disallow lines (allow all)', () => {
    const content = 'User-agent: *\nDisallow:';
    const rules = parseRobotsTxt(content);
    expect(rules.disallowedPaths).toEqual([]);
  });
});

describe('isUrlAllowed', () => {
  const rules = { disallowedPaths: ['/admin/', '/private/'] };

  it('blocks URLs matching a Disallow path', () => {
    expect(isUrlAllowed('https://example.com/admin/', rules)).toBe(false);
    expect(isUrlAllowed('https://example.com/admin/users', rules)).toBe(false);
    expect(isUrlAllowed('https://example.com/private/data', rules)).toBe(false);
  });

  it('allows URLs not matching any Disallow path', () => {
    expect(isUrlAllowed('https://example.com/blog/', rules)).toBe(true);
    expect(isUrlAllowed('https://example.com/', rules)).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(isUrlAllowed('not-a-url', rules)).toBe(false);
  });
});

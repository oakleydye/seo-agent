import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadConfig } from './loader.js';

const TMP = '/tmp/seo-agent-test';

const validConfig = {
  sites: [{
    siteId: 'test',
    url: 'https://example.com',
    gitHubRepo: 'owner/repo',
    crawlLimits: { maxPages: 10, maxDepth: 2, timeoutMs: 5000, respectRobotsTxt: true },
    googleCredentials: { serviceAccountPath: './creds.json' },
  }],
  schedule: { cronExpression: '0 0 1 * *' },
};

describe('loadConfig', () => {
  it('loads and validates a valid config file', () => {
    mkdirSync(TMP, { recursive: true });
    const path = join(TMP, 'valid.json');
    writeFileSync(path, JSON.stringify(validConfig));
    const config = loadConfig(path);
    expect(config.sites[0].siteId).toBe('test');
  });

  it('throws on missing config file', () => {
    expect(() => loadConfig('/tmp/nonexistent-seo-agent-config.json')).toThrow(/Failed to read/);
  });

  it('throws on invalid config structure', () => {
    mkdirSync(TMP, { recursive: true });
    const path = join(TMP, 'invalid.json');
    writeFileSync(path, JSON.stringify({ sites: [] }));
    expect(() => loadConfig(path)).toThrow(/Invalid config/);
  });
});

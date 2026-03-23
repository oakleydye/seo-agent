import { describe, it, expect } from 'vitest';
import type { PageData } from '../types/index.js';

// Mock logger to suppress output during tests
import { vi } from 'vitest';
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { discoverInternalLinks, insertInternalLinks } from './internal-linker.js';

function makePage(overrides: Partial<PageData> & { html: string; url: string }): PageData {
  return {
    statusCode: 200,
    redirectChain: [],
    finalUrl: overrides.url,
    fetchedAt: new Date(),
    ...overrides,
  };
}

describe('discoverInternalLinks', () => {
  it('returns only relevant pages when some match blog topic (relevanceScore > 0.1)', async () => {
    const blogPost = `
      Page speed optimization is critical for SEO performance.
      Improving load time reduces bounce rate and increases conversions.
      Core Web Vitals measure performance metrics for page speed.
      Fast loading pages rank better in search results.
    `;

    const pages: PageData[] = [
      makePage({
        url: 'https://example.com/page-speed-guide',
        html: '<html><body><h1>Page Speed Guide</h1><p>Optimize your page speed and loading performance with these tips. Core Web Vitals and load time improvements for better SEO rankings.</p></body></html>',
      }),
      makePage({
        url: 'https://example.com/css-colors',
        html: '<html><body><h1>CSS Colors</h1><p>A guide to using colors in CSS stylesheets. Color theory and design principles for web development.</p></body></html>',
      }),
      makePage({
        url: 'https://example.com/web-performance',
        html: '<html><body><h1>Web Performance Metrics</h1><p>Page speed metrics, performance scores, loading times, and Core Web Vitals optimization strategies.</p></body></html>',
      }),
    ];

    const result = await discoverInternalLinks(blogPost, pages);

    // Should return the 2 performance-related pages, not the CSS colors page
    expect(result.length).toBeGreaterThanOrEqual(1);
    const urls = result.map(r => r.targetUrl);
    expect(urls).toContain('https://example.com/page-speed-guide');
    expect(urls).not.toContain('https://example.com/css-colors');
    // Verify scores are above threshold
    result.forEach(link => {
      expect(link.relevanceScore).toBeGreaterThan(0.1);
    });
  });

  it('insertInternalLinks embeds exactly 2 Markdown link patterns when given 2 links', () => {
    const content = `# Blog Post About Performance

Page speed is important for user experience. Fast websites rank better.

Core Web Vitals are metrics defined by Google. They measure loading and interactivity.

Improving performance can reduce bounce rates significantly.`;

    const links = [
      { anchorText: 'Performance Guide', targetUrl: 'https://example.com/performance', relevanceScore: 0.8 },
      { anchorText: 'Core Web Vitals', targetUrl: 'https://example.com/core-web-vitals', relevanceScore: 0.7 },
    ];

    const result = insertInternalLinks(content, links);

    // Should contain exactly 2 Markdown link patterns [text](url)
    const markdownLinks = result.match(/\[.+?\]\(https?:\/\/.+?\)/g);
    expect(markdownLinks).not.toBeNull();
    expect(markdownLinks!.length).toBe(2);
    expect(result).toContain('[Performance Guide](https://example.com/performance)');
    expect(result).toContain('[Core Web Vitals](https://example.com/core-web-vitals)');
  });

  it('returns empty array when existingPages is empty', async () => {
    const blogPost = 'Some blog post content about any topic.';
    const result = await discoverInternalLinks(blogPost, []);
    expect(result).toEqual([]);
  });

  it('returns at most maxLinks results when maxLinks is specified', async () => {
    const blogPost = `
      Page speed optimization performance metrics web vitals loading time.
      Core web vitals score SEO ranking performance optimization.
    `;

    const pages: PageData[] = Array.from({ length: 5 }, (_, i) => makePage({
      url: `https://example.com/page-${i}`,
      html: `<html><body><h1>Page Speed Article ${i}</h1><p>Page speed performance optimization and web vitals for article ${i}. Loading time metrics SEO ranking.</p></body></html>`,
    }));

    const result = await discoverInternalLinks(blogPost, pages, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });
});

describe('insertInternalLinks', () => {
  it('returns content unchanged when links array is empty', () => {
    const content = '# Blog Post\n\nSome content here.\n\nAnother paragraph.';
    const result = insertInternalLinks(content, []);
    expect(result).toBe(content);
  });
});

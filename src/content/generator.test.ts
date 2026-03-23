import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateBlogPost,
  BlogGenerationError,
  slugify,
  extractTitle,
  extractDescription,
  countWords,
} from './generator.js';

// Hoisted mock factory reference
const mockCreate = vi.fn();

vi.mock('../portkey/client.js', () => ({
  getPortkeyClient: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
}));

const VALID_MARKDOWN = `# How to Improve Page Speed

Page speed is a critical ranking factor in modern SEO. When your site loads slowly, users bounce and search engines penalise it. In this guide we will walk through the most impactful optimizations you can make today to dramatically improve your site's performance metrics and user experience.

## Why Page Speed Matters for SEO

Studies show that a 1-second delay in page load time can reduce conversions by 7% [FACT-CHECK]. Google has used page speed as a ranking signal since 2010, and with Core Web Vitals now part of the algorithm, it has never been more important for your website's search performance and overall visibility.

Fast sites also improve user experience across all devices. Mobile users in particular expect near-instant responses — more than half abandon a page that takes longer than 3 seconds to load [FACT-CHECK]. Reducing your time-to-first-byte (TTFB) alone can have measurable impact on both rankings and revenue.

Search engines crawl faster sites more efficiently too. A slow site wastes crawl budget, meaning Google may not index all your pages in a timely fashion. This is especially relevant for large e-commerce sites with thousands of product pages.

## Key Optimizations to Implement Today

The most impactful steps for page speed improvement are: compressing images (use WebP format where possible), enabling browser caching with appropriate cache-control headers, minifying CSS and JavaScript bundles, and using a content delivery network (CDN) to serve assets from edge locations close to your users.

Server-side improvements matter too. Upgrading to HTTP/2, optimising database queries to reduce execution time, enabling GZIP or Brotli compression on your web server, and implementing lazy loading for below-the-fold images can all cut load times dramatically. Consider moving to a faster hosting provider if your current infrastructure is the bottleneck.

Critical rendering path optimization is another area worth investigating. Eliminating render-blocking resources, inlining critical CSS, and deferring non-essential JavaScript can shave hundreds of milliseconds off your perceived load time — which matters enormously for user experience.

## Measuring Your Progress

Use Google PageSpeed Insights to benchmark your current score and track improvements over time. Aim for a Lighthouse performance score above 90. Tools like WebPageTest let you run tests from multiple global locations so you can see how real-world users experience your site regardless of where they are located.

Set up monitoring with Real User Monitoring (RUM) tools to capture actual performance data from live visitors. Synthetic monitoring gives you a baseline, but real user data reveals the full picture including slow connections and older devices that your lab environment may not simulate accurately.

## Conclusion

Improving page speed is one of the highest-ROI technical SEO investments you can make. Start with image compression and browser caching, measure your baseline with PageSpeed Insights, and work through the optimization checklist systematically. Small wins compound: even shaving 200ms from your load time can measurably improve your Core Web Vitals scores and search rankings. Your users — and your conversion rates — will thank you.
`;

describe('generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('slugify', () => {
    it('converts "How to Improve Page Speed" to lowercase-hyphenated slug', () => {
      expect(slugify('How to Improve Page Speed')).toBe('how-to-improve-page-speed');
    });

    it('strips special characters from "SEO & Content: A Guide"', () => {
      expect(slugify('SEO & Content: A Guide')).toBe('seo-content-a-guide');
    });

    it('collapses multiple spaces/hyphens', () => {
      expect(slugify('  hello   world  ')).toBe('hello-world');
    });
  });

  describe('extractTitle', () => {
    it('extracts H1 from markdown', () => {
      expect(extractTitle('# My Blog Post\nBody text')).toBe('My Blog Post');
    });

    it('falls back to first non-empty line when no H1', () => {
      expect(extractTitle('No heading here\nSecond line')).toBe('No heading here');
    });
  });

  describe('countWords', () => {
    it('counts words correctly', () => {
      expect(countWords('hello world foo')).toBe(3);
    });

    it('handles empty string', () => {
      expect(countWords('')).toBe(0);
    });

    it('handles extra whitespace', () => {
      expect(countWords('  a  b  c  ')).toBe(3);
    });
  });

  describe('generateBlogPost', () => {
    it('returns a valid BlogPost when LLM returns well-structured markdown', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: VALID_MARKDOWN } }],
      });

      const post = await generateBlogPost('page speed optimization');

      expect(post.title).toBe('How to Improve Page Speed');
      expect(post.slug).toBe('how-to-improve-page-speed');
      expect(post.targetKeyword).toBe('page speed optimization');
      expect(post.author).toBe('SEO Agent (AI-generated)');
      expect(post.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(post.wordCount).toBeGreaterThan(0);
      expect(post.content.length).toBeGreaterThan(2000);
      expect(post.keywords).toContain('page speed optimization');
    });

    it('throws BlogGenerationError when LLM returns empty string', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '' } }],
      });

      await expect(generateBlogPost('test keyword')).rejects.toThrow(BlogGenerationError);
    });

    it('throws BlogGenerationError when content is less than 2000 chars', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '# Short Post\n\nThis is too short.' } }],
      });

      await expect(generateBlogPost('test keyword')).rejects.toThrow(BlogGenerationError);
    });

    it('uses "thought leadership" angle for retryAttempt=1', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: VALID_MARKDOWN } }],
      });

      await generateBlogPost('leadership', { retryAttempt: 1 });

      const callArgs = mockCreate.mock.calls[0]![0];
      const systemContent = callArgs.messages[0].content as string;
      expect(systemContent).toContain('thought leadership');
    });
  });
});

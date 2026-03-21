import { describe, it, expect } from 'vitest';
import {
  checkTitleTags,
  checkMetaDescriptions,
  checkOpenGraphTags,
  checkHeadingHierarchy,
  checkImageAltAttributes,
  checkCanonicalTags,
  checkDuplicateContent,
} from './rules.js';
import type { PageData } from '../types/index.js';

function makePage(url: string, html: string, statusCode = 200): PageData {
  return { url, statusCode, html, redirectChain: [], finalUrl: url, fetchedAt: new Date() };
}

// ─── Title Tags ──────────────────────────────────────────────────────────────

describe('checkTitleTags', () => {
  it('returns missing-title-tag issue for page with no <title>', () => {
    const issues = checkTitleTags([makePage('https://a.com/', '<html><body></body></html>')]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('missing-title-tag');
    expect(issues[0]!.severity).toBe('critical');
  });

  it('returns duplicate-title issue when two pages share the same title', () => {
    const pages = [
      makePage('https://a.com/', '<html><head><title>Home</title></head></html>'),
      makePage('https://a.com/about', '<html><head><title>Home</title></head></html>'),
    ];
    const issues = checkTitleTags(pages);
    const dup = issues.find(i => i.rule === 'duplicate-title');
    expect(dup).toBeDefined();
    expect(dup!.pageUrl).toBe('https://a.com/about');
  });

  it('returns no issues for pages with unique non-empty titles', () => {
    const pages = [
      makePage('https://a.com/', '<html><head><title>Home</title></head></html>'),
      makePage('https://a.com/about', '<html><head><title>About</title></head></html>'),
    ];
    expect(checkTitleTags(pages)).toHaveLength(0);
  });

  it('skips non-200 pages', () => {
    const issues = checkTitleTags([makePage('https://a.com/404', '<html></html>', 404)]);
    expect(issues).toHaveLength(0);
  });
});

// ─── Meta Descriptions ───────────────────────────────────────────────────────

describe('checkMetaDescriptions', () => {
  it('returns missing-meta-description for page without meta description', () => {
    const issues = checkMetaDescriptions([makePage('https://a.com/', '<html><head></head></html>')]);
    expect(issues.find(i => i.rule === 'missing-meta-description')).toBeDefined();
  });

  it('returns meta-description-too-short for description under 50 chars', () => {
    const html = '<html><head><meta name="description" content="Short"></head></html>';
    const issues = checkMetaDescriptions([makePage('https://a.com/', html)]);
    expect(issues.find(i => i.rule === 'meta-description-too-short')).toBeDefined();
  });

  it('returns meta-description-too-long for description over 160 chars', () => {
    const longDesc = 'A'.repeat(161);
    const html = `<html><head><meta name="description" content="${longDesc}"></head></html>`;
    const issues = checkMetaDescriptions([makePage('https://a.com/', html)]);
    expect(issues.find(i => i.rule === 'meta-description-too-long')).toBeDefined();
  });

  it('returns no issues for valid meta description', () => {
    const desc = 'A'.repeat(80);
    const html = `<html><head><meta name="description" content="${desc}"></head></html>`;
    expect(checkMetaDescriptions([makePage('https://a.com/', html)])).toHaveLength(0);
  });
});

// ─── Open Graph ──────────────────────────────────────────────────────────────

describe('checkOpenGraphTags', () => {
  it('returns missing-og-title issue when og:title is absent', () => {
    const html = '<html><head><meta property="og:description" content="Desc"><meta property="og:image" content="img.jpg"></head></html>';
    const issues = checkOpenGraphTags([makePage('https://a.com/', html)]);
    expect(issues.find(i => i.rule === 'missing-og-title')).toBeDefined();
  });

  it('returns no issues when all required OG tags are present', () => {
    const html = '<html><head><meta property="og:title" content="T"><meta property="og:description" content="D"><meta property="og:image" content="I"></head></html>';
    expect(checkOpenGraphTags([makePage('https://a.com/', html)])).toHaveLength(0);
  });
});

// ─── Heading Hierarchy ───────────────────────────────────────────────────────

describe('checkHeadingHierarchy', () => {
  it('returns missing-h1 for page with no H1', () => {
    const issues = checkHeadingHierarchy([makePage('https://a.com/', '<html><body><h2>Sub</h2></body></html>')]);
    expect(issues.find(i => i.rule === 'missing-h1')).toBeDefined();
    expect(issues.find(i => i.rule === 'missing-h1')!.severity).toBe('critical');
  });

  it('returns multiple-h1 for page with more than one H1', () => {
    const html = '<html><body><h1>First</h1><h1>Second</h1></body></html>';
    const issues = checkHeadingHierarchy([makePage('https://a.com/', html)]);
    expect(issues.find(i => i.rule === 'multiple-h1')).toBeDefined();
  });

  it('returns heading-skip for H1 directly followed by H3', () => {
    const html = '<html><body><h1>Title</h1><h3>Sub-sub</h3></body></html>';
    const issues = checkHeadingHierarchy([makePage('https://a.com/', html)]);
    expect(issues.find(i => i.rule === 'heading-skip')).toBeDefined();
  });

  it('returns no issues for valid H1 > H2 > H3 hierarchy', () => {
    const html = '<html><body><h1>Title</h1><h2>Section</h2><h3>Sub</h3></body></html>';
    expect(checkHeadingHierarchy([makePage('https://a.com/', html)])).toHaveLength(0);
  });
});

// ─── Image Alt ───────────────────────────────────────────────────────────────

describe('checkImageAltAttributes', () => {
  it('returns missing-alt-attribute for img without alt', () => {
    const html = '<html><body><img src="/photo.jpg"></body></html>';
    const issues = checkImageAltAttributes([makePage('https://a.com/', html)]);
    expect(issues.find(i => i.rule === 'missing-alt-attribute')).toBeDefined();
    expect(issues[0]!.severity).toBe('warning');
  });

  it('returns no issues for img with alt attribute', () => {
    const html = '<html><body><img src="/photo.jpg" alt="A photo"></body></html>';
    expect(checkImageAltAttributes([makePage('https://a.com/', html)])).toHaveLength(0);
  });

  it('returns no issues for decorative img with empty alt', () => {
    const html = '<html><body><img src="/decor.png" alt=""></body></html>';
    expect(checkImageAltAttributes([makePage('https://a.com/', html)])).toHaveLength(0);
  });
});

// ─── Canonical Tags ──────────────────────────────────────────────────────────

describe('checkCanonicalTags', () => {
  it('returns missing-canonical for page without canonical link', () => {
    const issues = checkCanonicalTags([makePage('https://a.com/', '<html><head></head></html>')]);
    expect(issues.find(i => i.rule === 'missing-canonical')).toBeDefined();
  });

  it('returns relative-canonical for non-absolute canonical href', () => {
    const html = '<html><head><link rel="canonical" href="/page"></head></html>';
    const issues = checkCanonicalTags([makePage('https://a.com/', html)]);
    expect(issues.find(i => i.rule === 'relative-canonical')).toBeDefined();
  });

  it('returns no issues for valid absolute canonical', () => {
    const html = '<html><head><link rel="canonical" href="https://a.com/page"></head></html>';
    expect(checkCanonicalTags([makePage('https://a.com/', html)])).toHaveLength(0);
  });
});

// ─── Duplicate Content ───────────────────────────────────────────────────────

describe('checkDuplicateContent', () => {
  const longText = 'The quick brown fox jumps over the lazy dog. '.repeat(15); // >100 chars when normalized

  it('returns duplicate-content when two pages have the same body text', () => {
    const html = `<html><body><p>${longText}</p></body></html>`;
    const pages = [
      makePage('https://a.com/', html),
      makePage('https://a.com/copy', html),
    ];
    const issues = checkDuplicateContent(pages);
    expect(issues.find(i => i.rule === 'duplicate-content')).toBeDefined();
  });

  it('returns no issues for pages with different content', () => {
    const pages = [
      makePage('https://a.com/', `<html><body><p>${longText}</p></body></html>`),
      makePage('https://a.com/other', `<html><body><p>${'Different content. '.repeat(15)}</p></body></html>`),
    ];
    expect(checkDuplicateContent(pages)).toHaveLength(0);
  });
});

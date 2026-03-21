import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { Issue, PageData } from '../types/index.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function extractTextFingerprint(html: string): string {
  const $ = cheerio.load(html);
  // Remove scripts, styles, navigation — focus on main body text
  $('script, style, nav, header, footer').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim().toLowerCase();
  // Simple word-frequency fingerprint: take first 500 chars of normalized text
  return text.slice(0, 500);
}

// ─── AUDIT-01: Title Tags ────────────────────────────────────────────────────

/**
 * Check for missing title tags and duplicate titles across all pages.
 * Severity: critical (missing), warning (duplicate)
 */
export function checkTitleTags(pages: PageData[]): Issue[] {
  const issues: Issue[] = [];
  const titleMap = new Map<string, string>(); // normalized title → first pageUrl

  for (const page of pages) {
    if (page.statusCode !== 200 || !page.html) continue;
    const $ = cheerio.load(page.html);
    const titleEl = $('title');

    if (titleEl.length === 0) {
      issues.push({
        id: 'AUDIT-01',
        rule: 'missing-title-tag',
        severity: 'critical',
        pageUrl: page.url,
        description: 'Page is missing a <title> element.',
      });
      continue;
    }

    const title = titleEl.first().text().trim();
    if (!title) {
      issues.push({
        id: 'AUDIT-01',
        rule: 'empty-title-tag',
        severity: 'critical',
        pageUrl: page.url,
        description: 'Page has an empty <title> element.',
      });
      continue;
    }

    const normalized = title.toLowerCase();
    if (titleMap.has(normalized)) {
      issues.push({
        id: 'AUDIT-01',
        rule: 'duplicate-title',
        severity: 'warning',
        pageUrl: page.url,
        description: `Duplicate title "${title}" also used on ${titleMap.get(normalized)}.`,
      });
    } else {
      titleMap.set(normalized, page.url);
    }
  }

  return issues;
}

// ─── AUDIT-02: Meta Descriptions ────────────────────────────────────────────

const META_DESC_MIN = 50;
const META_DESC_MAX = 160;

/**
 * Check for missing, too-short, too-long, and duplicate meta descriptions.
 */
export function checkMetaDescriptions(pages: PageData[]): Issue[] {
  const issues: Issue[] = [];
  const descMap = new Map<string, string>();

  for (const page of pages) {
    if (page.statusCode !== 200 || !page.html) continue;
    const $ = cheerio.load(page.html);
    const metaDesc = $('meta[name="description"]').attr('content');

    if (metaDesc === undefined) {
      issues.push({
        id: 'AUDIT-02',
        rule: 'missing-meta-description',
        severity: 'warning',
        pageUrl: page.url,
        description: 'Page is missing a meta description.',
      });
      continue;
    }

    const desc = metaDesc.trim();
    if (desc.length === 0) {
      issues.push({
        id: 'AUDIT-02',
        rule: 'empty-meta-description',
        severity: 'warning',
        pageUrl: page.url,
        description: 'Page has an empty meta description.',
      });
      continue;
    }

    if (desc.length < META_DESC_MIN) {
      issues.push({
        id: 'AUDIT-02',
        rule: 'meta-description-too-short',
        severity: 'info',
        pageUrl: page.url,
        description: `Meta description is ${desc.length} chars (minimum ${META_DESC_MIN}).`,
        details: desc,
      });
    } else if (desc.length > META_DESC_MAX) {
      issues.push({
        id: 'AUDIT-02',
        rule: 'meta-description-too-long',
        severity: 'info',
        pageUrl: page.url,
        description: `Meta description is ${desc.length} chars (maximum ${META_DESC_MAX}).`,
        details: desc.slice(0, 80) + '...',
      });
    }

    const normalized = desc.toLowerCase();
    if (descMap.has(normalized)) {
      issues.push({
        id: 'AUDIT-02',
        rule: 'duplicate-meta-description',
        severity: 'warning',
        pageUrl: page.url,
        description: `Duplicate meta description also used on ${descMap.get(normalized)}.`,
      });
    } else {
      descMap.set(normalized, page.url);
    }
  }

  return issues;
}

// ─── AUDIT-03: Open Graph Tags ───────────────────────────────────────────────

const REQUIRED_OG_TAGS = ['og:title', 'og:description', 'og:image'];

/**
 * Check for missing required Open Graph tags.
 */
export function checkOpenGraphTags(pages: PageData[]): Issue[] {
  const issues: Issue[] = [];

  for (const page of pages) {
    if (page.statusCode !== 200 || !page.html) continue;
    const $ = cheerio.load(page.html);

    for (const tag of REQUIRED_OG_TAGS) {
      const el = $(`meta[property="${tag}"]`);
      if (el.length === 0 || !el.attr('content')?.trim()) {
        issues.push({
          id: 'AUDIT-03',
          rule: `missing-${tag.replace(':', '-')}`,
          severity: 'warning',
          pageUrl: page.url,
          description: `Missing or empty Open Graph tag: <meta property="${tag}">.`,
        });
      }
    }
  }

  return issues;
}

// ─── AUDIT-07: Canonical Tags ────────────────────────────────────────────────

/**
 * Check for missing or malformed canonical tags.
 */
export function checkCanonicalTags(pages: PageData[]): Issue[] {
  const issues: Issue[] = [];

  for (const page of pages) {
    if (page.statusCode !== 200 || !page.html) continue;
    const $ = cheerio.load(page.html);
    const canonical = $('link[rel="canonical"]');

    if (canonical.length === 0) {
      issues.push({
        id: 'AUDIT-07',
        rule: 'missing-canonical',
        severity: 'warning',
        pageUrl: page.url,
        description: 'Page is missing a <link rel="canonical"> tag.',
      });
      continue;
    }

    const href = canonical.attr('href')?.trim();
    if (!href) {
      issues.push({
        id: 'AUDIT-07',
        rule: 'empty-canonical',
        severity: 'warning',
        pageUrl: page.url,
        description: 'Page has an empty canonical href.',
      });
      continue;
    }

    try {
      new URL(href); // must be absolute
    } catch {
      issues.push({
        id: 'AUDIT-07',
        rule: 'relative-canonical',
        severity: 'info',
        pageUrl: page.url,
        description: `Canonical tag uses relative URL "${href}" — should be absolute.`,
      });
    }
  }

  return issues;
}

// ─── AUDIT-08: Heading Hierarchy ─────────────────────────────────────────────

/**
 * Check for heading hierarchy violations: missing H1, multiple H1s, H-level skips.
 */
export function checkHeadingHierarchy(pages: PageData[]): Issue[] {
  const issues: Issue[] = [];

  for (const page of pages) {
    if (page.statusCode !== 200 || !page.html) continue;
    const $ = cheerio.load(page.html);
    const h1s = $('h1');

    if (h1s.length === 0) {
      issues.push({
        id: 'AUDIT-08',
        rule: 'missing-h1',
        severity: 'critical',
        pageUrl: page.url,
        description: 'Page has no H1 heading.',
      });
    } else if (h1s.length > 1) {
      issues.push({
        id: 'AUDIT-08',
        rule: 'multiple-h1',
        severity: 'warning',
        pageUrl: page.url,
        description: `Page has ${h1s.length} H1 headings (should have exactly 1).`,
      });
    }

    // Check for level skips: e.g., H1 followed immediately by H3 with no H2
    const headings = $('h1, h2, h3, h4, h5, h6').toArray();
    let prevLevel = 0;
    for (const heading of headings) {
      const tagName = (heading as Element).tagName;
      const level = parseInt(tagName.slice(1), 10);
      if (level - prevLevel > 1 && prevLevel !== 0) {
        issues.push({
          id: 'AUDIT-08',
          rule: 'heading-skip',
          severity: 'info',
          pageUrl: page.url,
          description: `Heading level skip: H${prevLevel} followed by H${level} without H${prevLevel + 1}.`,
          details: $(heading).text().trim().slice(0, 80),
        });
      }
      prevLevel = level;
    }
  }

  return issues;
}

// ─── AUDIT-09: Image Alt Attributes ──────────────────────────────────────────

/**
 * Check for img elements missing alt attribute or with empty alt.
 * Note: empty alt="" is valid for decorative images — flag as info, not warning.
 */
export function checkImageAltAttributes(pages: PageData[]): Issue[] {
  const issues: Issue[] = [];

  for (const page of pages) {
    if (page.statusCode !== 200 || !page.html) continue;
    const $ = cheerio.load(page.html);

    $('img').each((_, el) => {
      const alt = $(el).attr('alt');
      const src = $(el).attr('src') ?? 'unknown';

      if (alt === undefined) {
        issues.push({
          id: 'AUDIT-09',
          rule: 'missing-alt-attribute',
          severity: 'warning',
          pageUrl: page.url,
          description: `Image is missing alt attribute.`,
          details: src.slice(0, 120),
        });
      }
      // Empty alt="" is valid for decorative images — skip it
    });
  }

  return issues;
}

// ─── AUDIT-06: Duplicate Content ─────────────────────────────────────────────

/**
 * Detect pages with near-duplicate body text content using fingerprint comparison.
 * Uses first 500 chars of normalized body text as fingerprint.
 */
export function checkDuplicateContent(pages: PageData[]): Issue[] {
  const issues: Issue[] = [];
  const fingerprintMap = new Map<string, string>(); // fingerprint → first pageUrl

  for (const page of pages) {
    if (page.statusCode !== 200 || !page.html) continue;
    const fingerprint = extractTextFingerprint(page.html);

    // Skip pages with very little content (< 100 chars after normalization)
    if (fingerprint.length < 100) continue;

    if (fingerprintMap.has(fingerprint)) {
      issues.push({
        id: 'AUDIT-06',
        rule: 'duplicate-content',
        severity: 'warning',
        pageUrl: page.url,
        description: `Page content appears to duplicate ${fingerprintMap.get(fingerprint)}.`,
      });
    } else {
      fingerprintMap.set(fingerprint, page.url);
    }
  }

  return issues;
}

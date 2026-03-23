import * as cheerio from 'cheerio';
import { TfIdf } from 'natural';
import { logger } from '../utils/logger.js';
import type { InternalLink, PageData } from '../types/index.js';

/**
 * Extract text content from a PageData HTML string using cheerio.
 */
function extractPageText(html: string): string {
  const $ = cheerio.load(html);
  return $('h1, h2, h3, p, li').map((_, el) => $(el).text()).get().join(' ').trim();
}

/**
 * Extract the H1 title from a PageData HTML string.
 * Falls back to the URL path segment if no H1 found.
 */
function extractPageTitle(html: string, url: string): string {
  const $ = cheerio.load(html);
  const h1 = $('h1').first().text().trim();
  if (h1.length > 0) return h1.slice(0, 60);
  // Fall back to last segment of URL path
  try {
    const path = new URL(url).pathname.replace(/\/$/, '');
    const segment = path.split('/').filter(Boolean).pop() ?? url;
    return segment.replace(/-/g, ' ').slice(0, 60);
  } catch {
    return url.slice(0, 60);
  }
}

/**
 * Compute cosine similarity between two numeric vectors.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecB.length === 0) return 0;
  const dot = vecA.reduce((sum, a, i) => sum + a * (vecB[i] ?? 0), 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/**
 * Discover relevant internal pages to link to from a new blog post.
 * Uses TF-IDF cosine similarity to score each existing page against the post.
 * Returns up to maxLinks pages with relevanceScore > 0.1.
 */
export async function discoverInternalLinks(
  blogPost: string,
  existingPages: PageData[],
  maxLinks: number = 5,
): Promise<InternalLink[]> {
  if (existingPages.length === 0) return [];

  const tfidf = new TfIdf();
  tfidf.addDocument(blogPost); // index 0

  const pageTexts = existingPages.map(page => extractPageText(page.html));
  pageTexts.forEach(text => tfidf.addDocument(text));

  // Build term universe from all documents
  const allTerms = new Set<string>();
  tfidf.documents.forEach((doc) => {
    Object.keys(doc).filter(k => k !== '__key').forEach(term => allTerms.add(term));
  });
  const terms = Array.from(allTerms);

  const postVector = terms.map(term => tfidf.tfidf(term, 0));
  const candidates: InternalLink[] = [];

  for (let i = 0; i < existingPages.length; i++) {
    const page = existingPages[i]!;
    const pageVector = terms.map(term => tfidf.tfidf(term, i + 1));
    const relevanceScore = cosineSimilarity(postVector, pageVector);

    if (relevanceScore > 0.1) {
      const anchorText = extractPageTitle(page.html, page.url);
      candidates.push({ anchorText, targetUrl: page.url, relevanceScore });
    }
  }

  const result = candidates
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxLinks);

  logger.info({ found: candidates.length, selected: result.length }, 'Internal links discovered');
  return result;
}

/**
 * Insert internal links into blog post Markdown content.
 * For each link: finds the first paragraph containing a word from the anchor text
 * and appends the Markdown link inline after that paragraph.
 * Links not naturally inserted are collected in a "## Related Pages" section at end.
 */
export function insertInternalLinks(content: string, links: InternalLink[]): string {
  if (links.length === 0) return content;

  const paragraphs = content.split('\n\n');
  const inserted = new Set<number>(); // track which link indices have been inserted
  const updatedParagraphs = [...paragraphs];

  for (let li = 0; li < links.length; li++) {
    const link = links[li]!;
    const anchorWords = link.anchorText.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    for (let pi = 0; pi < updatedParagraphs.length; pi++) {
      const para = updatedParagraphs[pi]!;
      if (para.startsWith('#') || para.startsWith('|') || inserted.has(li)) continue;

      const paraLower = para.toLowerCase();
      const hasMatch = anchorWords.some(word => paraLower.includes(word));

      if (hasMatch) {
        // Append Markdown link at end of this paragraph
        updatedParagraphs[pi] = `${para}\n\nFor more, see [${link.anchorText}](${link.targetUrl}).`;
        inserted.add(li);
        break;
      }
    }
  }

  // Collect any links that weren't inserted inline
  const uninserted = links.filter((_, i) => !inserted.has(i));
  if (uninserted.length > 0) {
    const related = uninserted.map(l => `- [${l.anchorText}](${l.targetUrl})`).join('\n');
    updatedParagraphs.push(`\n## Related Pages\n\n${related}`);
  }

  return updatedParagraphs.join('\n\n');
}

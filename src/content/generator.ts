import { logger } from '../utils/logger.js';
import { getPortkeyClient } from '../portkey/client.js';
import type { BlogPost } from '../types/index.js';

export interface BlogGenerationOptions {
  targetAudience?: string;
  toneVariation?: 'technical' | 'casual' | 'narrative';
  retryAttempt?: number; // 0 = first attempt, 1 = second (different angle), 2 = third (different structure)
}

export class BlogGenerationError extends Error {
  constructor(
    message: string,
    public readonly keyword: string,
  ) {
    super(message);
    this.name = 'BlogGenerationError';
  }
}

/**
 * Generate a URL-safe slug from a title string.
 * Lowercases, strips non-alphanumeric characters, replaces whitespace with hyphens,
 * and collapses repeated hyphens.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Extract the first H1 title from Markdown content.
 * Falls back to first non-empty line if no H1 found.
 */
export function extractTitle(content: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1]!.trim();
  const firstLine = content.split('\n').find(line => line.trim().length > 0);
  return firstLine?.trim() ?? 'Untitled Post';
}

/**
 * Extract a meta description from Markdown content.
 * Uses the first non-heading, non-list paragraph, truncated to 160 chars.
 */
export function extractDescription(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 50 && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
      return trimmed.length > 160 ? trimmed.slice(0, 157) + '...' : trimmed;
    }
  }
  return content.slice(0, 160).replace(/\n/g, ' ');
}

/**
 * Count words in a string (split on whitespace).
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Build a varied system prompt based on retry attempt to avoid similar-sounding posts.
 */
function buildSystemPrompt(targetAudience: string, retryAttempt: number): string {
  const angles = [
    'practical how-to guide with step-by-step advice',
    'thought leadership perspective with industry insights and examples',
    'problem-solution narrative starting with a common pain point',
  ];
  const angle = angles[retryAttempt % angles.length] ?? angles[0]!;

  return `You are an expert blog writer creating SEO-optimized content for ${targetAudience}.
Writing style: ${angle}.
Rules:
- Write natural, engaging prose — no AI template phrases like "In today's digital landscape" or "As an AI"
- Structure: compelling intro → 2-3 H2 sections with specific examples → actionable conclusion
- Use varied sentence lengths (short punchy sentences mixed with longer explanatory ones)
- Include specific numbers or data points where helpful; mark any statistics with [FACT-CHECK] inline
- Do not include a table of contents or generic filler sections`;
}

/**
 * Generate a 500+ word SEO blog post targeting the given keyword via Portkey LLM.
 * Returns a BlogPost object with computed metadata.
 * Throws BlogGenerationError if LLM response is empty or too short (< 2000 chars).
 */
export async function generateBlogPost(
  keyword: string,
  options: BlogGenerationOptions = {},
): Promise<BlogPost> {
  const { targetAudience = 'business professionals', retryAttempt = 0 } = options;
  const systemPrompt = buildSystemPrompt(targetAudience, retryAttempt);

  const userMessage = `Write a 600-900 word blog post targeting the keyword: "${keyword}"

Requirements:
- Start with an H1 heading (# Title) containing the keyword
- Include the keyword naturally 3-5 times in the body
- 2-3 related secondary keywords woven in naturally
- End with a clear call-to-action or key takeaways section
- Mark any statistics or specific claims with [FACT-CHECK] for human review

Return only the Markdown content — no preamble, no "Here is the post:", just the post itself starting with # Title`;

  const portkey = getPortkeyClient();

  logger.info({ keyword, retryAttempt }, 'Calling LLM to generate blog post');

  const response = await portkey.chat.completions.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  const rawContent = response.choices?.[0]?.message?.content;
  if (!rawContent || typeof rawContent !== 'string') {
    throw new BlogGenerationError(
      `LLM returned empty response for keyword "${keyword}"`,
      keyword,
    );
  }

  const content = rawContent.trim();
  if (content.length < 2000) {
    throw new BlogGenerationError(
      `LLM response too short (${content.length} chars) for keyword "${keyword}" — expected 2000+`,
      keyword,
    );
  }

  const title = extractTitle(content);
  const slug = slugify(title);
  const description = extractDescription(content);
  const wordCount = countWords(content);
  const publishedDate = new Date().toISOString().slice(0, 10);

  logger.info({ keyword, slug, wordCount, retryAttempt }, 'Blog post generated');

  return {
    slug,
    title,
    description,
    keywords: [keyword],
    publishedDate,
    author: 'SEO Agent (AI-generated)',
    content,
    targetKeyword: keyword,
    wordCount,
  };
}

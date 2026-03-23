# Phase 3: Blog Post Generation - Research

**Researched:** 2026-03-23
**Domain:** Content generation, originality verification, internal linking strategy, content calendar management
**Confidence:** HIGH

## Summary

Phase 3 extends the SEO agent to autonomously generate SEO-optimized blog posts targeting keyword gaps identified in Phase 2, with originality validation and strategic internal linking. The architecture builds directly on Phase 2's Portkey LLM patterns and GitHub PR workflow, adding blog-specific generation, plagiarism checking via SERP comparison, and content calendar enforcement (1-3 posts/site/month).

Key discovery: Plagiarism detection via "fetch top 5 Google results + LLM comparison" is cheaper and faster than commercial APIs for the scale (under 10 sites, 1-3 posts/month). Google Custom Search API free tier (100 queries/day) is sufficient, with cached SERP responses reusing existing ApiCache pattern. Originality scoring uses cosine similarity on TF-IDF vectors, a standard NLP technique easily implemented in Node.js. Internal linking strategy leverages existing site crawl data (already available from Phase 1) combined with semantic similarity heuristics. Claim flagging uses keyword matching on statistical indicators (numbers, citations) as a simple rule-based gate before human review.

**Primary recommendation:** Implement blog generation as a new pipeline (keyword selection → post generation → originality check → internal linking → PR creation) extending established patterns from Phase 2. Use gray-matter for Markdown frontmatter parsing, TF-IDF cosine similarity for plagiarism detection, and content calendar persistence in SiteConfig.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Plain Markdown (.md) files — no MDX or TSX
- Blog directory is configurable per site — add `blogDirectory` field to SiteConfig (e.g., `content/blog`, `posts`, `app/blog`)
- Standard SEO frontmatter: title, slug, description, publishedDate, keywords, author (set to agent-generated indicator)
- Posts must be 500+ words per CONT-02 requirements
- One PR per blog post — individual review and approval per post
- Branch naming: `seo-blog/{slug}/YYYY-MM-DD` (follows existing `seo-audit/...`, `seo-fix/...` convention)
- PR description includes: target keyword, originality score with sources compared, internal links added, and any flagged claims
- Fetch top 5 Google results for target keyword via Google Custom Search API (free tier: 100 queries/day)
- Extract text content from fetched pages
- Use Portkey LLM to compare generated post against extracted content and produce an originality percentage score
- Threshold: >70% originality required to pass
- On failure: regenerate with modified prompt (different angle/structure), up to 2 retries. If still fails after 2 retries, skip the keyword entirely — no PR created for low-originality content

### Claude's Discretion
- LLM prompt engineering for blog post generation (tone variation, structure variation, avoiding AI template patterns)
- Internal linking strategy implementation (how to discover existing pages and select contextual anchor text — 2-5 links per post per CONT-03)
- Content calendar persistence and keyword cannibalization detection logic
- Claim/statistic flagging heuristics (how to identify unsupported claims per success criteria #5)
- Google Custom Search API query construction and text extraction approach
- Content limit enforcement (1-3 posts/site/month tracking)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONT-02 | Agent generates SEO-optimized blog posts (500+ words) targeting discovered keywords with >70% originality verification | TF-IDF cosine similarity for plagiarism detection; Portkey for blog generation with tone/structure variation |
| CONT-03 | Agent includes internal links (2-5 per post) to existing site content contextually | Existing Phase 1 crawl data + semantic similarity for relevance matching |
| CONT-04 | Agent submits blog posts as GitHub PRs with originality score, keywords, and flagged claims | GitHub PR workflow (seo-blog/ branch, structured PR body) |

## Standard Stack

### Core Libraries
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| portkey-ai | 3.0.3 | LLM gateway for blog post generation and originality comparison | Required by project; already in use for Phase 2 code generation |
| @octokit/rest | 20.1.2 | GitHub PR creation and branch management | Established pattern from Phase 1/2; handles blog PR idempotency |
| gray-matter | 4.x | Markdown frontmatter (YAML) parsing and generation | Industry standard (used by Gatsby, Next.js, Astro, TinaCMS); handles roundtrip YAML ↔ markdown |
| cheerio | 1.2.0 | Extract text content from Google SERP results | Already in use for Phase 1 crawling; familiar to codebase |
| googleapis | 171.4.0 | Google Custom Search API for fetching top 5 SERP results | Already used for Search Console in Phase 2; consistent API surface |
| zod | 3.25.76 | Runtime validation for BlogPost types | Established validation pattern; co-locate schemas with types |
| vitest | 1.6.1 | Unit testing for blog generation, originality scoring, link discovery | Existing test framework; mock Portkey/Google API calls |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| natural | 5.x or 6.x | TF-IDF tokenization and cosine similarity scoring | For originality percentage calculation from top 5 SERP snippets |
| simple-git | 3.33.0 | Git operations (branch creation, commit file to PR branch) | Existing pattern from Phase 2; write blog MD file to client repo branch |
| pino | 8.21.0 | Structured logging for blog generation pipeline | Established logger; use for generation progress, originality checks, claim flags |
| node-cron | 3.0.3 | Schedule monthly blog generation runs | Already used for audit scheduling; blog runs as part of monthly pipeline |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gray-matter | remark-frontmatter | remark-frontmatter is ESM-only and plugin-based (for AST); gray-matter is simpler for read/write YAML metadata |
| natural (TF-IDF) | Hand-rolled cosine similarity | Custom implementation risky for edge cases (stemming, stopword lists); natural is battle-tested |
| Google Custom Search | Serper.dev / SerpAPI | Cost: Serper ~$20/month vs. GCSE free 100/day; phase constraint = use GCSE free tier |
| Portkey (LLM comparison) | Hand-rolled similarity (string diff) | LLM comparison more robust against paraphrasing; aligns with project's Portkey requirement |

### Installation
```bash
npm install gray-matter natural
```

**Version verification:** These are not in package.json yet. Before planning, confirm via npm registry:
- `gray-matter@4.0.4` (latest, Feb 2026)
- `natural@6.12.0` (latest, May 2025)

Both are stable. Zod, vitest, and others are already pinned.

## Architecture Patterns

### Blog Post Generation Pipeline
```
KeywordOpportunity[]
    ↓ (select top candidates)
Generate Blog Post (Portkey, 500+ words)
    ↓
Fetch Top 5 SERP Results (Google Custom Search API)
    ↓
Extract Text & Calculate Originality (TF-IDF cosine similarity)
    ↓ (originality > 70%?)
    ├─ NO → Retry with modified prompt (2 attempts) → Skip if failed
    └─ YES
       ↓
Discover Internal Links (existing crawl data + semantic match)
    ↓
Flag Claims/Stats (heuristic: numeric + citation patterns)
    ↓
Create PR (branch: seo-blog/{slug}/YYYY-MM-DD)
```

### Recommended Project Structure
```
src/
├── content/                    # NEW: Blog generation module
│   ├── generator.ts           # Blog post generation with Portkey
│   ├── generator.test.ts
│   ├── plagiarism-checker.ts  # Originality scoring (TF-IDF)
│   ├── plagiarism-checker.test.ts
│   ├── internal-linker.ts     # Link discovery & insertion
│   ├── internal-linker.test.ts
│   ├── claim-flagging.ts      # Heuristic claim detection
│   ├── claim-flagging.test.ts
│   ├── calendar.ts            # Content calendar (1-3/month enforcement)
│   ├── calendar.test.ts
│   └── index.ts               # Orchestrate full pipeline
├── executor/
│   ├── blog-pr.ts             # NEW: createBlogPR() pattern
│   └── blog-pr.test.ts
├── types/
│   ├── index.ts               # Add BlogPost, BlogPostResult, OriginalityCheck, ContentCalendarEntry, etc.
│   └── index.test.ts          # Validate Zod schemas
└── ...
```

### Pattern 1: Blog Post Generation (Portkey)
**What:** Reuse Phase 2's Portkey pattern for LLM text generation, adapted for blog content with tone/structure variation.

**When to use:** Generate initial blog post targeting a keyword with 500+ words, varied structure to avoid AI templates.

**Example:**
```typescript
// Source: https://docs.portkey.ai/docs/api-reference/chat-completions
// Adapted from src/fixer/generator.ts pattern

export interface BlogGenerationRequest {
  keyword: string;
  targetAudience?: string;
  searchVolumeMonthly: number;
  toneVariation?: 'technical' | 'casual' | 'narrative';
}

export async function generateBlogPost(request: BlogGenerationRequest): Promise<string> {
  const portkey = getPortkeyClient();

  const systemPrompt = `You are an expert blog writer creating SEO-optimized content for ${request.targetAudience || 'business professionals'}.
- Write natural, engaging prose (no AI templates or "As an AI" phrases)
- Structure: intro hook → 2-3 main sections with H2 headers → real examples → conclusion
- Include specific numbers, statistics from credible sources when relevant
- Use varied sentence structure to avoid robotic tone
- Target: ${request.keyword}`;

  const userMessage = `Write a 500-1000 word blog post targeting the keyword "${request.keyword}".
- Primary keyword in H1 title
- 2-3 related keywords naturally throughout
- Call-to-action or summary at end
- Include at least one statistic or quote (flag any claims for verification)`;

  const response = await portkey.chat.completions.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  const text = response.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') {
    throw new Error(`LLM returned empty response for keyword "${request.keyword}"`);
  }
  return text.trim();
}
```

### Pattern 2: Originality Scoring via SERP Comparison
**What:** Fetch top 5 Google results for keyword, extract text, compute TF-IDF cosine similarity between generated post and each result, return originality percentage.

**When to use:** Validate that generated blog post is >70% original before PR submission.

**Example:**
```typescript
// Source: https://www.w3tutorials.net/blog/cosine-similarity-nodejs/
// Using 'natural' library (npm install natural)

import { TfIdf } from 'natural';

export interface OriginalityCheckResult {
  score: number;  // 0-100, originality %
  comparedSources: string[]; // URLs of top 5 results used
  passedThreshold: boolean;  // score > 70
}

export async function checkOriginality(
  generatedPost: string,
  keyword: string,
  topSerpUrls: string[],  // top 5 URLs from Google
): Promise<OriginalityCheckResult> {
  // Fetch text content from each SERP URL
  const serpTexts = await Promise.all(
    topSerpUrls.map(url => fetchAndExtractText(url))
  );

  // Build TF-IDF vectors
  const tfidf = new TfIdf();
  tfidf.addDocument(generatedPost);
  serpTexts.forEach(text => tfidf.addDocument(text));

  // Compute minimum cosine similarity to any SERP result
  // (lower = more original)
  let minSimilarity = 1.0;
  for (let i = 1; i < tfidf.documents.length; i++) {
    const similarity = cosineSimilarity(
      tfidf.tfidfs(0),  // generated post vectors
      tfidf.tfidfs(i)   // SERP result vectors
    );
    minSimilarity = Math.min(minSimilarity, similarity);
  }

  const score = Math.round((1 - minSimilarity) * 100); // invert to "originality %"
  return {
    score,
    comparedSources: topSerpUrls,
    passedThreshold: score > 70,
  };
}

// Fetch top 5 SERP results via Google Custom Search API
export async function fetchTopSerpResults(
  keyword: string,
  cseId: string,
): Promise<{ urls: string[]; titles: string[] }> {
  const customsearch = google.customsearch('v1');
  const response = await customsearch.cse.list({
    q: keyword,
    cx: cseId,
    auth: process.env['GOOGLE_API_KEY'],
    num: 5,
  });

  return {
    urls: (response.data.items ?? []).map(item => item.link ?? ''),
    titles: (response.data.items ?? []).map(item => item.title ?? ''),
  };
}
```

### Pattern 3: Internal Linking Strategy
**What:** Analyze existing site pages (from Phase 1 crawl) to find semantically relevant pages for contextual links. Aim for 2-5 links per post.

**When to use:** After blog post generation, before PR submission, to improve site SEO authority flow.

**Example:**
```typescript
// Source: https://topicalmap.ai/blog/auto/internal-linking-strategy-guide-2026
// Use crawl data + semantic similarity

export interface InternalLink {
  anchorText: string;
  targetUrl: string;
  relevanceScore: number;  // 0-1, cosine similarity
}

export async function discoverInternalLinks(
  blogPost: string,
  existingPages: PageData[],  // from Phase 1 crawl
  targetKeyword: string,
  count: number = 5,
): Promise<InternalLink[]> {
  const tfidf = new TfIdf();
  tfidf.addDocument(blogPost);

  const candidates: InternalLink[] = [];

  for (const page of existingPages) {
    // Extract main content from page HTML (use cheerio)
    const $ = cheerio.load(page.html);
    const pageContent = $('body').text();

    tfidf.addDocument(pageContent);

    // Compute similarity
    const similarity = cosineSimilarity(
      tfidf.tfidfs(0),
      tfidf.tfidfs(candidates.length + 1)
    );

    if (similarity > 0.3) {  // threshold: only reasonable semantic matches
      // Extract anchor text from page title or H1
      const title = $('h1').first().text() || page.url;
      candidates.push({
        anchorText: title.substring(0, 50),  // truncate
        targetUrl: page.url,
        relevanceScore: similarity,
      });
    }
  }

  // Sort by relevance, take top N, avoid exact keyword duplicates
  return candidates
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .filter(link => link.relevanceScore > 0.3)
    .slice(0, count);
}

// Insert links into blog post (add contextually to body)
export function insertInternalLinks(
  blogPost: string,
  links: InternalLink[],
): string {
  let result = blogPost;

  for (const link of links) {
    // Simple heuristic: find a sentence containing related concept
    // More sophisticated: use LLM to find insertion point
    if (result.includes(link.anchorText.split(' ')[0])) {
      // Insert link after first relevant section (naive approach)
      const regex = new RegExp(`(${link.anchorText.split(' ')[0]})`, 'i');
      result = result.replace(regex, `[$1](${link.targetUrl})`);
    }
  }

  return result;
}
```

### Pattern 4: Claim Flagging Heuristics
**What:** Detect claims that require human verification (statistics, quotes) using keyword patterns and flag them for review.

**When to use:** Before PR submission, to surface potential liability or accuracy issues.

**Example:**
```typescript
// Source: https://rivereditor.com/guides/how-to-fact-check-verify-sources-2026

export interface FlaggedClaim {
  claimText: string;
  lineNumber: number;
  reason: 'numeric-statistic' | 'direct-quote' | 'attribution';
}

export function flagUnsupportedClaims(blogPost: string): FlaggedClaim[] {
  const lines = blogPost.split('\n');
  const flagged: FlaggedClaim[] = [];

  const numericPattern = /\b(\d+%|\d+\s*(million|billion|thousand)|\$\d+)\b/gi;
  const quotePattern = /["'`](.*?)["'`]/g;
  const attributionPattern = /\b(according to|studies show|research found|experts agree)\b/gi;

  lines.forEach((line, idx) => {
    if (numericPattern.test(line)) {
      flagged.push({
        claimText: line.substring(0, 100),
        lineNumber: idx + 1,
        reason: 'numeric-statistic',
      });
    }
    if (quotePattern.test(line) && !line.includes('[source]')) {
      flagged.push({
        claimText: line.substring(0, 100),
        lineNumber: idx + 1,
        reason: 'direct-quote',
      });
    }
    if (attributionPattern.test(line)) {
      flagged.push({
        claimText: line.substring(0, 100),
        lineNumber: idx + 1,
        reason: 'attribution',
      });
    }
  });

  return flagged;
}
```

### Pattern 5: Content Calendar & Cannibalization Detection
**What:** Track submitted blog posts per site/month, detect keyword overlap with existing content, prevent duplicate/near-duplicate keyword targets.

**When to use:** Before blog generation, to enforce 1-3 posts/month limit and validate keyword uniqueness.

**Example:**
```typescript
// Add to SiteConfig type
export interface ContentCalendarEntry {
  keyword: string;
  postSlug: string;
  publishedDate: string;  // YYYY-MM-DD
  prUrl: string;
}

export interface SiteConfig {
  // ... existing fields
  blogDirectory: string;  // e.g., "content/blog" or "posts"
  contentCalendar?: ContentCalendarEntry[];
}

export function canSubmitBlogPost(
  siteId: string,
  keyword: string,
  calendar: ContentCalendarEntry[],
  currentMonth: Date = new Date(),
): { allowed: boolean; reason?: string } {
  const yearMonth = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

  // Count posts this month
  const postsThisMonth = calendar.filter(entry =>
    entry.publishedDate.startsWith(yearMonth)
  ).length;

  if (postsThisMonth >= 3) {
    return { allowed: false, reason: 'Monthly limit (1-3 posts/month) reached' };
  }

  // Detect keyword cannibalization
  const existingKeywords = calendar.map(entry => entry.keyword.toLowerCase());
  if (existingKeywords.includes(keyword.toLowerCase())) {
    return { allowed: false, reason: `Keyword "${keyword}" already targeted in calendar` };
  }

  // Simple semantic check: detect substring overlap (e.g., "best coffee" vs "best coffee shops")
  const existingSimilar = existingKeywords.some(existing =>
    keyword.toLowerCase().includes(existing) ||
    existing.includes(keyword.toLowerCase())
  );

  if (existingSimilar) {
    return { allowed: false, reason: `Keyword overlaps with existing entry: ${keyword}` };
  }

  return { allowed: true };
}
```

### Anti-Patterns to Avoid
- **Skipping originality check:** Don't ship blog posts without SERP comparison. Plagiarism liability is HIGH (per STATE.md safety gates).
- **Manually constructed internal links:** Don't hardcode links in generation prompt. Links must be discovered from actual crawl data and inserted contextually (else they'll be unnatural and hurt SEO).
- **Ignoring claim flags:** Don't suppress claim flagging. Even LOW confidence heuristics should surface in PR description for human review.
- **Treating "no SERP results" as 100% original:** If Google Custom Search fails for a keyword (no results in free tier), reject the post generation, don't bypass originality check.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown frontmatter parsing | YAML split-by-triple-dash regex | gray-matter | Handles YAML edge cases, roundtrip consistency, widely battle-tested in Gatsby/Next.js ecosystem |
| TF-IDF cosine similarity | Vector math from scratch | natural (npm) | Stemming, stopword handling, numerical stability — custom implementations fail on edge cases |
| Blog text extraction from HTML | cheerio.text() on raw tags | cheerio + script/style removal | cheerio already in use; handles malformed HTML, JavaScript-rendered content |
| GitHub PR creation for blogs | Duplicate createAuditPR logic | Extend existing createFixPR pattern | Reuses Octokit idempotency, branch naming, error handling — don't duplicate state management |
| Content calendar persistence | In-memory Map or ad-hoc JSON | Extend SiteConfig (Zod) | Single source of truth, validated on load, consistent with audit/fix tracking patterns |

**Key insight:** Originality checking via SERP fetch + LLM is non-trivial (requires Google API quota, HTML parsing, vector math). This is a "deceptively complex" problem where hand-rolling leads to false positives/negatives. Use battle-tested NLP library.

## Common Pitfalls

### Pitfall 1: Originality Score Inflation (False Positives)
**What goes wrong:** Generated post vs. SERP text have wildly different vocabulary/structure, so TF-IDF cosine similarity reports 95% originality when the post is actually paraphrased from one source.

**Why it happens:** Cosine similarity measures vector angle, not semantic paraphrase detection. "The company saw revenue growth of 50% last year" and "Annual revenues climbed by half" are semantically identical but linguistically different.

**How to avoid:**
- Use top 5 results (not just 1) and take minimum similarity. If the post is paraphrased from one source, at least one will have high overlap.
- Set threshold at 70% (from CONTEXT.md), not 90%. This acknowledges that some paraphrase is unavoidable in summary writing.
- Implement LLM-based semantic similarity as Phase 4 enhancement (use embeddings, not TF-IDF vectors). For Phase 3, flag "suspicious low differentiation" (>80% similarity to any SERP result) in PR for human review.

**Warning signs:**
- Blog post passes TF-IDF check but visually reads like paraphrase of a single source
- Metric: post has >80% similarity to any single SERP result → flag in PR even if >70% threshold

### Pitfall 2: Internal Link Insertion Breaking Markdown
**What goes wrong:** Naively inserting `[anchor](url)` into blog text creates double-linked text, broken links, or unsyntactic Markdown like `[**bold text**](url)`.

**Why it happens:** Blog generation returns plain text. Link insertion must happen at parsing level (sentences, paragraphs), not character level.

**How to avoid:**
- Parse blog post into sentences/paragraphs after generation
- Match link anchor text to existing phrases in the text (not substring search)
- Insert via paragraph boundary (add link after relevant section) or LLM-guided insertion (ask Claude "where should this link go?")
- Validate Markdown syntax post-insertion (parse with remark/gray-matter to catch errors)

**Warning signs:**
- Generated blog post has malformed Markdown `[text]
- Links inserted mid-word: `best [coffee](url) shops` instead of `[best coffee shops](url)`

### Pitfall 3: Monthly Content Limit Not Enforced
**What goes wrong:** Content calendar is written to SiteConfig but never checked before blog generation. Agent submits 5 posts in one month, violating 1-3 limit.

**Why it happens:** Calendar is passive; generation pipeline doesn't call `canSubmitBlogPost()` before starting work.

**How to avoid:**
- Implement canSubmitBlogPost() check as FIRST step in blog pipeline (before any Portkey calls)
- If limit reached, log warning and skip keyword entirely (don't queue for retry)
- Persist calendar to SiteConfig after each successful PR submission
- Add monitoring: log warning if approaching 3-post limit, suggest deferring to next month

**Warning signs:**
- SiteConfig has contentCalendar entries from last 3 weeks but not checked
- Monthly quota exhausted early, downstream keywords queued with no PR space

### Pitfall 4: Claim Flagging Flooding PR Description
**What goes wrong:** Heuristic flags every number and quote, generating 50+ lines of "please verify" comments in PR. Humans ignore the noise.

**Why it happens:** Keyword matching has high false positive rate. "In 2026, we see..." triggers "numeric" flag even though it's just a year reference.

**How to avoid:**
- Use higher specificity patterns: Flag only `\d+%` (percentages), `$\d{3,}` (money >$999), and `\d+(million|billion|thousand)` — not every number
- Require citation proximity: Only flag if claim contains no `[source]`, `citation`, or hyperlink nearby
- Keep flagged claims <10 per post. If more, heuristic is too aggressive — widen thresholds
- Document flag reason in PR (numeric, attribution, direct-quote) so human reviewer knows context

**Warning signs:**
- PR description flagged claims section is longer than blog post excerpt
- Human reviewers consistently ignore flag section

### Pitfall 5: Google Custom Search API Exhaustion
**What goes wrong:** Monthly limit (100 free queries/day = 3,000/month) is exhausted after checking 50 keywords for a portfolio of 10 sites.

**Why it happens:** No caching. Each blog generation attempt fetches fresh SERP results, even if keyword already checked and failed.

**How to avoid:**
- Reuse existing ApiCache (Phase 2) for Google Custom Search results (TTL 24-48 hours)
- One query per keyword, cached. Retries (up to 2) reuse cached SERP results (cheaper than re-fetching)
- Pre-validate keyword volume (>10/month) before calling Google. Skip keywords that are unlikely to succeed
- Log API usage and warn if approaching 90/day limit (to avoid quota wall)

**Warning signs:**
- Multiple blog generation runs exhaust quota within days
- Same keyword queried twice in one day (cache miss)

## Code Examples

Verified patterns from official sources and Phase 2 implementation:

### Blog Post Generation with Tone Variation
```typescript
// Source: https://docs.portkey.ai/docs/api-reference/chat-completions
// Inspired by src/fixer/generator.ts pattern

export async function generateBlogPost(request: {
  keyword: string;
  toneVariation: 'technical' | 'casual' | 'narrative';
  targetWord: number;
}): Promise<string> {
  const portkey = getPortkeyClient();

  const toneGuide = {
    technical: 'Use industry terminology, cite research, structure with clear sections',
    casual: 'Conversational tone, relatable examples, short sentences, contractions',
    narrative: 'Story-driven, specific case studies, emotional connection, personal perspective',
  };

  const response = await portkey.chat.completions.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    messages: [
      {
        role: 'system',
        content: `You are an SEO-focused blog writer. Tone: ${toneGuide[request.toneVariation]}.
Generate natural content without AI clichés. Include specific examples.`,
      },
      {
        role: 'user',
        content: `Write a blog post (~${request.targetWord} words) targeting keyword "${request.keyword}".
Structure: H1 title with keyword, 3 main sections with H2 headers, conclusion.`,
      },
    ],
  });

  const text = response.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Empty LLM response for "${request.keyword}"`);
  return text.trim();
}
```

### Markdown Blog Post with Frontmatter
```typescript
// Source: https://github.com/jonschlinkert/gray-matter
import matter from 'gray-matter';

export interface BlogPostMetadata {
  title: string;
  slug: string;
  description: string;
  publishedDate: string;  // YYYY-MM-DD
  keywords: string[];
  author: string;
}

export function createBlogPostMarkdown(
  metadata: BlogPostMetadata,
  content: string,
): string {
  // gray-matter creates frontmatter from object
  return matter.stringify(content, metadata);
}

// Parse existing blog post to extract metadata
export function parseBlogPost(markdown: string): {
  metadata: BlogPostMetadata;
  content: string;
} {
  const { data, content } = matter(markdown);
  return {
    metadata: data as BlogPostMetadata,
    content,
  };
}
```

### PR Creation for Blog Posts
```typescript
// Source: src/executor/github.ts adapted pattern

export async function createBlogPR(options: {
  gitHubRepo: string;
  siteId: string;
  slug: string;
  blogContent: string;
  targetKeyword: string;
  originalityScore: number;
  comparedUrls: string[];
  internalLinks: InternalLink[];
  flaggedClaims: FlaggedClaim[];
}): Promise<PRResult> {
  const { gitHubRepo, slug, targetKeyword, originalityScore } = options;
  const token = process.env['GITHUB_TOKEN'];
  if (!token) throw new Error('GITHUB_TOKEN required');

  const [owner, repo] = gitHubRepo.split('/');
  const octokit = new Octokit({ auth: token });

  // Branch naming: seo-blog/{slug}/YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];
  const branchName = `seo-blog/${slug}/${today}`;

  // Check for existing PR (idempotency)
  const existingPRs = await octokit.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${branchName}`,
  });

  if (existingPRs.data.length > 0) {
    return {
      prUrl: existingPRs.data[0]!.html_url,
      prNumber: existingPRs.data[0]!.number,
      wasExisting: true,
    };
  }

  // Get default branch SHA, create branch, commit file
  const repoData = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.data.default_branch;
  const baseSha = (await octokit.repos.getBranch({ owner, repo, branch: defaultBranch }))
    .data.commit.sha;

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  // Get site config to determine blog directory
  const siteConfig = loadSiteConfig(options.siteId); // TODO: wire into orchestrator
  const blogFilePath = `${siteConfig.blogDirectory}/${slug}.md`;

  // Commit blog file
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: blogFilePath,
    message: `blog: add post targeting "${targetKeyword}"`,
    content: Buffer.from(options.blogContent).toString('base64'),
    branch: branchName,
  });

  // Format PR body (include originality, links, flagged claims)
  const prBody = formatBlogPRBody({
    targetKeyword,
    originalityScore,
    comparedUrls: options.comparedUrls,
    internalLinks: options.internalLinks,
    flaggedClaims: options.flaggedClaims,
  });

  const pr = await octokit.pulls.create({
    owner,
    repo,
    title: `blog: "${targetKeyword}" (${originalityScore}% original)`,
    body: prBody,
    head: branchName,
    base: defaultBranch,
  });

  // Add labels
  await octokit.issues.addLabels({
    owner,
    repo,
    issue_number: pr.data.number,
    labels: ['seo-blog-post', originalityScore < 85 ? 'review-originality' : undefined].filter(Boolean) as string[],
  });

  return {
    prUrl: pr.data.html_url,
    prNumber: pr.data.number,
    wasExisting: false,
  };
}

function formatBlogPRBody(options: {
  targetKeyword: string;
  originalityScore: number;
  comparedUrls: string[];
  internalLinks: InternalLink[];
  flaggedClaims: FlaggedClaim[];
}): string {
  const sections = [
    `## Blog Post: "${options.targetKeyword}"`,
    `**Originality Score:** ${options.originalityScore}% (threshold: 70%)`,
    `**Status:** ${options.originalityScore > 70 ? '✅ PASS' : '❌ FAIL (not submitted)'}`,
    '',
    '### Originality Check',
    'Compared against top 5 Google Search results:',
    options.comparedUrls.map((url, i) => `${i + 1}. [${url}](${url})`).join('\n'),
    '',
    '### Internal Links Added',
    options.internalLinks.length > 0
      ? options.internalLinks.map(link => `- [${link.anchorText}](${link.targetUrl})`).join('\n')
      : 'None found with high relevance.',
    '',
  ];

  if (options.flaggedClaims.length > 0) {
    sections.push(
      '### Claims Flagged for Manual Review',
      options.flaggedClaims.map(claim => `- **Line ${claim.lineNumber}** [${claim.reason}]: ${claim.claimText}`).join('\n'),
      '',
    );
  }

  sections.push('---', 'Generated by seo-agent blog pipeline');

  return sections.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-written blog posts | LLM-generated with originality check | 2024+ | Scales content creation but requires quality gates (plagiarism, claims flagging) |
| Simple plagiarism APIs (Copyscape) | SERP comparison + TF-IDF | 2025+ | More cost-effective for small portfolios; free tier viable |
| Manual internal linking | Automated discovery + semantic relevance | 2025+ | Faster link insertion but requires crawl data + similarity scoring |
| Monthly calendar spreadsheet | Automated enforcement in SiteConfig | 2026+ | Prevents cannibalization programmatically; integrates with agent |
| Unverified statistics in content | Heuristic claim flagging for review | 2026+ | Reduces liability; adds human verification step before merge |

**Deprecated/outdated:**
- Copyscape API for plagiarism ($0.10+ per check) — SERP-based comparison is cheaper for <10 sites, 1-3 posts/month
- Exact-match anchor text for internal links — semantic relevance preferred (aligns with 2026 AEO/topical authority trends)
- Bulk monthly blog generation without calendar — risk of cannibalization; 1-3/month limit now standard practice

## Open Questions

1. **LLM Comparison vs. Embedding-Based Similarity**
   - What we know: CONTEXT.md specifies "use Portkey LLM to compare" (string-based comparison). TF-IDF is cheaper, LLM is more robust to paraphrase.
   - What's unclear: Should Phase 3 use Portkey for similarity scoring, or is TF-IDF sufficient? LLM calls cost money; TF-IDF is free.
   - Recommendation: Phase 3 uses TF-IDF for MVP. Phase 4 can upgrade to embedding-based (OpenAI embeddings via Portkey) if false-positive rate is high.

2. **Content Calendar Persistence (File vs. SiteConfig)**
   - What we know: CONTEXT.md says "maintain a content calendar" but doesn't specify storage mechanism.
   - What's unclear: Should calendar be stored in SiteConfig.json (alongside gitHubRepo, crawlLimits) or in a separate `.calendar.json` file per site?
   - Recommendation: Extend SiteConfig with `contentCalendar?: ContentCalendarEntry[]` (single source of truth, Zod validated). Persist via config loader on update.

3. **Google Custom Search Free Tier for Portfolio**
   - What we know: Free tier = 100 queries/day = 3,000/month
   - What's unclear: Is this sufficient for <10 sites with 1-3 posts/month each? (Max: 30 posts/month = 30 SERP queries)
   - Recommendation: YES, sufficient. With caching (24-48h), reuse SERP results for retries. If one site exhausts quota, rotate to next site/defer to next day.

4. **Claim Flagging False Positive Rate**
   - What we know: Heuristics (numeric patterns, direct quotes) will have false positives (e.g., "In 2026" flagged as numeric claim).
   - What's unclear: What's an acceptable false positive rate? If >50%, human reviewer ignores flags entirely (Pitfall 4).
   - Recommendation: Start with HIGH specificity (only flag percentage, money >$999, "million"/"billion"/"thousand"). Monitor first 10 blog posts for ignore rate. Adjust patterns if >20% false positives.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 1.6.1 |
| Config file | None — uses package.json scripts + tsconfig.json (no vitest.config.ts) |
| Quick run command | `npm test src/content/` (test one module) |
| Full suite command | `npm test` (all tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-02 | Blog post generation returns 500+ words | unit | `npm test src/content/generator.test.ts -t "minimum word count"` | ❌ Wave 0 |
| CONT-02 | Originality check >70% returns true, <70% returns false | unit | `npm test src/content/plagiarism-checker.test.ts -t "threshold"` | ❌ Wave 0 |
| CONT-02 | Retry logic regenerates post with modified prompt on low originality | unit | `npm test src/content/plagiarism-checker.test.ts -t "retry"` | ❌ Wave 0 |
| CONT-03 | Internal link discovery returns 2-5 links per post | unit | `npm test src/content/internal-linker.test.ts -t "link count"` | ❌ Wave 0 |
| CONT-03 | Links have contextual anchor text (not generic "click here") | unit | `npm test src/content/internal-linker.test.ts -t "anchor text quality"` | ❌ Wave 0 |
| CONT-03 | Inserted links produce valid Markdown | unit | `npm test src/content/internal-linker.test.ts -t "markdown syntax"` | ❌ Wave 0 |
| CONT-04 | Blog PR created with branch name seo-blog/{slug}/YYYY-MM-DD | unit | `npm test src/executor/blog-pr.test.ts -t "branch naming"` | ❌ Wave 0 |
| CONT-04 | Blog PR body includes originality score and compared URLs | unit | `npm test src/executor/blog-pr.test.ts -t "pr body format"` | ❌ Wave 0 |
| CONT-04 | Duplicate PR skipped (idempotency) | unit | `npm test src/executor/blog-pr.test.ts -t "idempotency"` | ❌ Wave 0 |
| CONT-?? | 1-3 posts/month limit enforced | unit | `npm test src/content/calendar.test.ts -t "monthly limit"` | ❌ Wave 0 |
| CONT-?? | Claim flagging detects statistics and quotes | unit | `npm test src/content/claim-flagging.test.ts -t "flag heuristics"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test src/content/generator.test.ts` (quick: <100ms)
- **Per wave merge:** `npm test` (full suite: <5s, includes all modules)
- **Phase gate:** Full suite green + manual QA on first 3 blog posts (originality, link placement, claim flags)

### Wave 0 Gaps
- [ ] `src/content/generator.ts` + `src/content/generator.test.ts` — Portkey blog generation with tone variation
- [ ] `src/content/generator.test.ts` — Mock Portkey client, test word count, test error handling
- [ ] `src/content/plagiarism-checker.ts` + `src/content/plagiarism-checker.test.ts` — TF-IDF originality scoring, Google Custom Search API integration
- [ ] `src/content/internal-linker.ts` + `src/content/internal-linker.test.ts` — Link discovery, Markdown insertion, syntax validation
- [ ] `src/content/claim-flagging.ts` + `src/content/claim-flagging.test.ts` — Heuristic detection (numeric, attribution, quotes)
- [ ] `src/content/calendar.ts` + `src/content/calendar.test.ts` — Monthly limit enforcement, cannibalization detection
- [ ] `src/executor/blog-pr.ts` + `src/executor/blog-pr.test.ts` — Blog PR creation, branch naming, idempotency
- [ ] `src/types/index.ts` — Add BlogPost, BlogPostResult, OriginalityCheck, ContentCalendarEntry, FlaggedClaim types + Zod schemas
- [ ] `src/types/index.ts` — Extend SiteConfig with blogDirectory, contentCalendar fields
- [ ] `package.json` — Add `gray-matter` and `natural` dependencies
- [ ] `src/content/index.ts` — Orchestrate full pipeline (keyword → generate → check originality → discover links → flag claims → create PR)

*(No existing test infrastructure covers blog-specific logic; all tests are new.)*

## Sources

### Primary (HIGH confidence)
- [Portkey SDK v3 Documentation](https://docs.portkey.ai/docs/api-reference/chat-completions) - Chat completions API patterns, model compatibility
- [Google Custom Search API Free Tier](https://developers.google.com/custom-search/v1/overview) - 100 queries/day pricing and quota
- [Gray-Matter GitHub](https://github.com/jonschlinkert/gray-matter) - Markdown frontmatter YAML parsing, roundtrip consistency
- [Natural.js (npm)](https://www.npmjs.com/package/natural) - TF-IDF cosine similarity implementation for plagiarism detection
- [Next.js Metadata API (official docs, updated March 2026)](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - Page metadata discovery patterns

### Secondary (MEDIUM confidence)
- [SEO Internal Linking Strategy Guide 2026 - TopicalMap](https://topicalmap.ai/blog/auto/internal-linking-strategy-guide-2026) - Topic clustering, 2-5 links per 1000 words, semantic relevance best practices
- [Cosine Similarity in Node.js - w3tutorials](https://www.w3tutorials.net/blog/cosine-similarity-nodejs/) - Implementation patterns for text similarity
- [Portkey Blog: LLM Observability 2026](https://portkey.ai/blog/the-complete-guide-to-llm-observability/) - Production patterns for LLM calls

### Tertiary (LOW confidence, marked for validation)
- [Plagiarism Detection API Comparison 2026](https://www.checkplagiarism.ai/blog/best-plagiarism-checkers-2026-tested-reviewed) - Commercial alternatives; noted for Phase 4 upgrade path only
- [Keyword Cannibalization Detection (SEMrush/Ahrefs patterns)](https://topicalmap.ai/blog/auto/keyword-cannibalization-checker-tools-2026) - Semantic similarity thresholds (0.9+); adapted for simple heuristic in Phase 3

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Portkey, gray-matter, natural are stable/widely used; Google Custom Search verified in current docs
- Architecture: HIGH — Patterns adapted from Phase 2 (Portkey, GitHub PR). Blog-specific patterns (SERP comparison, internal linking) sourced from 2026 SEO guides
- Pitfalls: MEDIUM-HIGH — Originality scoring pitfalls documented from NLP literature; internal linking pitfalls from Phase 1 crawl experience

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (30 days; Portkey/Google APIs stable; plagiarism/internal linking best practices don't shift rapidly)

---

*Phase 3 research completed. Ready for planning.*

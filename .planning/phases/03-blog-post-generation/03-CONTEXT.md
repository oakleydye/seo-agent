# Phase 3: Blog Post Generation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate SEO-optimized blog posts targeting keyword gaps identified by the Search Console client in Phase 2. Each post is submitted as a GitHub PR for human review. Includes plagiarism/originality validation against top search results and internal linking to existing site content. Content calendar enforcement (1-3 posts/site/month) and claim flagging for unsupported statistics.

</domain>

<decisions>
## Implementation Decisions

### Post Format & Output
- Plain Markdown (.md) files — no MDX or TSX
- Blog directory is configurable per site — add `blogDirectory` field to SiteConfig (e.g., `content/blog`, `posts`, `app/blog`)
- Standard SEO frontmatter: title, slug, description, publishedDate, keywords, author (set to agent-generated indicator)
- Posts must be 500+ words per CONT-02 requirements

### PR Structure
- One PR per blog post — individual review and approval per post
- Branch naming: `seo-blog/{slug}/YYYY-MM-DD` (follows existing `seo-audit/...`, `seo-fix/...` convention)
- PR description includes: target keyword, originality score with sources compared, internal links added, and any flagged claims

### Originality Verification
- Fetch top 5 Google results for target keyword via Google Custom Search API (free tier: 100 queries/day, already using Google APIs for Search Console)
- Extract text content from fetched pages
- Use Portkey LLM to compare generated post against extracted content and produce an originality percentage score
- Threshold: >70% originality required to pass
- On failure: regenerate with modified prompt (different angle/structure), up to 2 retries. If still fails after 2 retries, skip the keyword entirely — no PR created for low-originality content
- Originality score and compared sources displayed in PR description for transparency

### Claude's Discretion
- LLM prompt engineering for blog post generation (tone variation, structure variation, avoiding AI template patterns)
- Internal linking strategy implementation (how to discover existing pages and select contextual anchor text — 2-5 links per post per CONT-03)
- Content calendar persistence and keyword cannibalization detection logic
- Claim/statistic flagging heuristics (how to identify unsupported claims per success criteria #5)
- Google Custom Search API query construction and text extraction approach
- Content limit enforcement (1-3 posts/site/month tracking)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Constraints: Portkey required, PR-only delivery, Next.js only, <10 sites
- `.planning/REQUIREMENTS.md` — CONT-02 (blog generation), CONT-03 (internal linking), CONT-04 (PR submission)
- `.planning/ROADMAP.md` — Phase 3 success criteria (originality >70%, 500+ words, 2-5 internal links, 1-3 posts/month, claim flagging)

### Prior phase context
- `.planning/phases/01-core-audit-discovery-pr-workflow/01-CONTEXT.md` — PR structure decisions, branch naming convention
- `.planning/phases/02-auto-fix-content-strategy/02-CONTEXT.md` — Portkey LLM call patterns, fix PR structure, keyword opportunity pipeline

### Existing code (key integration files)
- `src/types/index.ts` — `KeywordOpportunity` type (input from Phase 2), `SiteConfig` (extend with `blogDirectory`)
- `src/fetcher/search-console.ts` — `SearchConsoleClient.queryKeywords()` returns scored `KeywordOpportunity[]`
- `src/portkey/client.ts` — Portkey client singleton for LLM calls
- `src/fixer/generator.ts` — LLM call pattern via Portkey (reference for blog generation approach)
- `src/executor/github.ts` — `createAuditPR()` / `createFixPR()` patterns (adapt for blog post PRs)
- `src/executor/pr-formatter.ts` — PR body/title formatting utilities (extend for blog PRs)

### Research
- `.planning/research/SUMMARY.md` — Recommended stack and architecture patterns
- `.planning/research/PITFALLS.md` — Plagiarism liability risk, content quality concerns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/portkey/client.ts`: Portkey client singleton — reuse for blog generation LLM calls
- `src/fixer/generator.ts`: LLM call pattern (system prompt + user prompt → text response) — adapt for blog post generation
- `src/executor/github.ts`: `createAuditPR()` and `createFixPR()` with idempotent branch/PR creation — adapt for `createBlogPR()`
- `src/executor/pr-formatter.ts`: PR formatting utilities — extend with blog-specific formatters
- `src/fetcher/search-console.ts`: `SearchConsoleClient` returns `KeywordOpportunity[]` sorted by opportunity score — direct input to blog topic selection
- `src/utils/cache.ts`: `ApiCache` with TTL — reuse for caching Google Custom Search API responses
- `src/utils/retry.ts`: `withRetry()` with exponential backoff — reuse for SERP API calls

### Established Patterns
- Pipeline architecture: input → process → validate → PR (extend to: keywords → generate → originality check → internal link → PR)
- Portkey LLM calls: system prompt + user message → parse text response (established in `fixer/generator.ts`)
- Octokit-based GitHub workflow with idempotent branch/PR creation
- Pino structured logging, Zod validation, ESM + TypeScript strict mode

### Integration Points
- Blog pipeline consumes `KeywordOpportunity[]` from `SearchConsoleClient`
- Blog PRs use same Octokit/GitHub patterns (new `seo-blog/` branch namespace)
- `SiteConfig` needs `blogDirectory` field for configurable output path
- New types needed: `BlogPost`, `BlogPostResult`, `OriginalityCheck`, `ContentCalendarEntry`
- CLI needs `content` or `blog` command alongside existing `audit` and `fix` commands

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-blog-post-generation*
*Context gathered: 2026-03-23*

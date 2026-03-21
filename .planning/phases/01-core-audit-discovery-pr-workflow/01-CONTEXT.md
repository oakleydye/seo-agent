# Phase 1: Core Audit Discovery & PR Workflow - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Crawl Next.js sites, detect SEO issues (missing/duplicate title tags, meta descriptions, Open Graph tags, heading hierarchy, missing alt attributes, broken internal links, redirect chains/loops, duplicate content, missing canonical tags, crawl errors), retrieve Core Web Vitals from PageSpeed Insights, and submit audit findings as GitHub PRs. Detection and reporting only — no auto-fixes or code generation.

</domain>

<decisions>
## Implementation Decisions

### PR Structure
- One PR per site per audit run — single PR contains all findings for that site's audit cycle
- No files committed to the client repo — findings appear only in the PR body/description
- Branch naming: `seo-audit/YYYY-MM-DD` (date-based, sortable, avoids conflicts)
- PR description format: executive summary (pass/fail counts, critical issues) followed by a detailed table of all findings with severity, page URL, and description

### Claude's Discretion
- Audit report format within the PR body (exact Markdown structure, table columns, grouping)
- Crawling behavior (max depth, page limits, robots.txt handling, sitemap usage)
- Site configuration format and credential management approach
- Severity classification system for issues
- Core Web Vitals presentation within the PR
- Error handling and retry logic for crawling and API calls

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value prop, constraints (Portkey, PR-only delivery, Next.js only, <10 sites)
- `.planning/REQUIREMENTS.md` — Full requirement list (AUDIT-01 through AUDIT-10, INFRA-01 through INFRA-05)
- `.planning/ROADMAP.md` — Phase 1 success criteria and requirement mapping

### Research
- `.planning/research/SUMMARY.md` — Recommended stack (Node.js 20 LTS, TypeScript, Yargs, Cheerio, Octokit, Pino)
- `.planning/research/ARCHITECTURE.md` — Pipeline architecture, component boundaries
- `.planning/research/STACK.md` — Technology choices, version pinning, anti-patterns
- `.planning/research/PITFALLS.md` — Critical pitfalls (quota exhaustion, secrets leakage, etc.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 will establish the foundational patterns

### Integration Points
- GitHub API (Octokit) — PR creation, branch management
- Google PageSpeed Insights API — Core Web Vitals data
- CLI entry point (Yargs) — manual trigger and cron scheduling

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

*Phase: 01-core-audit-discovery-pr-workflow*
*Context gathered: 2026-03-21*

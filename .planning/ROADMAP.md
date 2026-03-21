# Roadmap: SEO Agent

**Created:** 2026-03-21
**Granularity:** Coarse
**Total Requirements:** 26 v1
**Coverage:** 26/26 mapped (100%)

---

## Phases

- [ ] **Phase 1: Core Audit Discovery & PR Workflow** - Crawl Next.js sites, detect SEO issues, submit audit reports as GitHub PRs
- [ ] **Phase 2: Auto-Fix & Content Strategy** - Generate code fixes for detected issues, identify keyword opportunities for content
- [ ] **Phase 3: Blog Post Generation** - Generate SEO-optimized blog posts targeting keyword gaps, submit as PRs

---

## Phase Details

### Phase 1: Core Audit Discovery & PR Workflow

**Goal:** Enable autonomous monthly audits of Next.js sites with issues detected and reported as GitHub PRs — validating the core "agent → PR workflow" concept with low-risk detection only.

**Depends on:** Nothing (foundational phase)

**Requirements:** AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05, AUDIT-06, AUDIT-07, AUDIT-08, AUDIT-09, AUDIT-10, INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05

**Success Criteria** (what must be TRUE when Phase 1 completes):
1. Agent crawls a Next.js test site and detects on-page SEO issues (missing/duplicate title tags, meta descriptions, Open Graph tags, heading hierarchy problems, missing alt attributes) without breaking due to JavaScript or complex routing
2. Agent identifies technical SEO issues (broken internal links, redirect chains, loops, duplicate content, missing canonical tags, crawl errors) and logs them with severity/location
3. Agent retrieves Core Web Vitals data from PageSpeed Insights API and includes metrics in findings
4. Agent creates a GitHub branch, writes audit findings to a structured file (JSON or Markdown), commits changes, and opens a pull request with clear description
5. Agent can be run monthly via cron schedule (`node-cron`) and manually via CLI with different site configurations
6. Agent loads multiple client site configurations (GitHub repo URLs, auth credentials) from a config file and processes them in sequence without cross-site data leaks

**Plans:** 5 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffold: Node.js 20 + TypeScript setup, shared types, config loader, logger, Portkey stub
- [ ] 01-02-PLAN.md — Crawler: HTTP page discovery with robots.txt, redirect loop detection, and crawl limits
- [ ] 01-03-PLAN.md — SEO Auditor: seven on-page rule checks (title, meta desc, OG, canonical, headings, alt, duplicate content)
- [ ] 01-04-PLAN.md — PageSpeed fetcher + PR formatter + GitHub PR executor
- [ ] 01-05-PLAN.md — CLI + orchestrator: Yargs audit/schedule commands wiring the full pipeline

---

### Phase 2: Auto-Fix & Content Strategy

**Goal:** Generate code for low-risk meta/schema/alt-text fixes and identify keyword opportunities from Search Console data — extending audit capability with LLM-driven generation while validating code safety through build checks.

**Depends on:** Phase 1

**Requirements:** FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07, CONT-01

**Success Criteria** (what must be TRUE when Phase 2 completes):
1. Agent generates Next.js-compatible TypeScript/JSX code to fix detected issues (add title tags, meta descriptions, Open Graph, alt text, heading structure, schema.org markup) and validates syntax before PR submission
2. Agent runs `next build` on modified code before opening PR, rejecting changes that fail build validation
3. Agent calls Google Search Console API to identify organic search keywords for target site, filters by minimum search volume (≥10/month), and ranks them by relevance and traffic opportunity
4. Agent submits auto-fix code PRs with clear description explaining what issue was found and why the fix was applied, making it easy for humans to review
5. Agent implements decision logic to categorize issues by risk (low-risk auto-fix vs needs-review), and only auto-submits low-risk fixes (meta tags, alt text, canonical tags, basic schema)
6. Agent prevents quota exhaustion by caching Google API responses (24-48 hour TTL) and implementing exponential backoff for rate-limited requests

**Plans:** TBD

---

### Phase 3: Blog Post Generation

**Goal:** Generate SEO-optimized blog posts targeting identified keyword gaps and submit them as GitHub PRs — completing the content creation capability with plagiarism validation and internal linking strategy.

**Depends on:** Phase 2

**Requirements:** CONT-02, CONT-03, CONT-04

**Success Criteria** (what must be TRUE when Phase 3 completes):
1. Agent generates original blog posts (500+ words) targeting keywords identified in Phase 2, using Portkey LLM gateway to vary structure and tone (avoiding AI templates), and verifies >70% originality against top 5 search results
2. Agent creates a structured blog post file in client repo's blog directory with metadata (title, slug, published date, SEO keywords) and submits as GitHub PR with description
3. Agent analyzes existing site content and strategically links new blog posts to relevant existing pages contextually (2-5 internal links per post), improving site architecture and SEO authority flow
4. Agent enforces content limits (max 1-3 posts/site/month) and maintains a content calendar to prevent keyword cannibalization and spacing issues across the portfolio
5. Agent flags posts with unsupported claims or statistics for manual verification before merge, ensuring content quality and liability compliance

**Plans:** TBD

---

## Progress Tracking

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Audit Discovery & PR Workflow | 0/5 | Not started | — |
| 2. Auto-Fix & Content Strategy | 0/TBD | Not started | — |
| 3. Blog Post Generation | 0/TBD | Not started | — |

---

## Coverage Validation

**Requirement Mapping:**

| Category | Requirement | Phase | Status |
|----------|-------------|-------|--------|
| Audit | AUDIT-01 | 1 | Pending |
| Audit | AUDIT-02 | 1 | Pending |
| Audit | AUDIT-03 | 1 | Pending |
| Audit | AUDIT-04 | 1 | Pending |
| Audit | AUDIT-05 | 1 | Pending |
| Audit | AUDIT-06 | 1 | Pending |
| Audit | AUDIT-07 | 1 | Pending |
| Audit | AUDIT-08 | 1 | Pending |
| Audit | AUDIT-09 | 1 | Pending |
| Audit | AUDIT-10 | 1 | Pending |
| Auto-Fix | FIX-01 | 2 | Pending |
| Auto-Fix | FIX-02 | 2 | Pending |
| Auto-Fix | FIX-03 | 2 | Pending |
| Auto-Fix | FIX-04 | 2 | Pending |
| Auto-Fix | FIX-05 | 2 | Pending |
| Auto-Fix | FIX-06 | 2 | Pending |
| Auto-Fix | FIX-07 | 2 | Pending |
| Content | CONT-01 | 2 | Pending |
| Content | CONT-02 | 3 | Pending |
| Content | CONT-03 | 3 | Pending |
| Content | CONT-04 | 3 | Pending |
| Infrastructure | INFRA-01 | 1 | Pending |
| Infrastructure | INFRA-02 | 1 | Pending |
| Infrastructure | INFRA-03 | 1 | Pending |
| Infrastructure | INFRA-04 | 1 | Pending |
| Infrastructure | INFRA-05 | 1 | Pending |

**Summary:**
- v1 requirements: 26
- Mapped to phases: 26
- Unmapped: 0
- **Coverage: 100% ✓**

---

*Roadmap created: 2026-03-21*
*Phase 1 plans created: 2026-03-21*

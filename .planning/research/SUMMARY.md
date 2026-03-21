# Project Research Summary

**Project:** SEO Agent (CLI-based autonomous SEO auditing & content generation)
**Domain:** Autonomous agent for Next.js site auditing, PR submission, and content generation
**Researched:** 2026-03-21
**Confidence:** MEDIUM (training data as of Feb 2025; WebSearch/WebFetch blocked during research)

## Executive Summary

SEO automation agents are typically built as modular pipeline systems that discover issues, analyze findings, make decisions, and execute changes via pull requests. The recommended approach for this project is a **CLI-first, TypeScript + Node.js 20 LTS architecture** with clear component boundaries between crawling, analysis, LLM-driven generation, and GitHub integration. This avoids the complexity of traditional web dashboards while delivering monthly autonomous audits as reviewable pull requests.

The critical challenge is not the technology stack (well-established) but rather the **safety and governance layer**: unvalidated code changes can break production sites, quota exhaustion silently breaks monthly runs, and generated content without plagiarism checks creates legal liability. Research strongly recommends phasing features to validate each capability before moving to higher-risk phases, with mandatory safety checks at each gate (build validation, secrets detection, plagiarism scanning).

The project maps to a 4-phase delivery plan: Phase 1 (MVP audit + PR workflow, low-risk detection only), Phase 2 (auto-fix for meta/schema, content generation with validation), Phase 3 (advanced content strategy and Next.js-native fixes), Phase 4+ (refinement and scaling). This phased approach reduces risk by validating core PR delivery before adding code generation, and validating code generation before adding content generation.

## Key Findings

### Recommended Stack

Node.js 20 LTS + TypeScript with Yargs for CLI, node-cron for scheduling, and Portkey as the LLM gateway. This stack is mature, ESM-native, and avoids ecosystem churn. Key integrations: Octokit for GitHub PR operations, official Google SDKs (Search Console, PageSpeed Insights), Cheerio + node-fetch for lightweight crawling, and Pino for structured logging.

**Core technologies:**
- **Node.js 20 LTS + TypeScript 5.3+** — Production-grade, ESM-first, stable for monthly cron jobs
- **Yargs 17.x** — CLI argument parsing; well-battle-tested, used by Next.js and major OSS projects
- **node-cron 3.0.3+** — Lightweight cron scheduling; no external dependencies needed for under-10-sites use case
- **@portkey-ai/portkey-node** — LLM gateway (hard constraint); abstracts model switching without code changes
- **@octokit/rest 20.x** — Official GitHub API client; type-safe, well-maintained
- **@google-cloud/search-console & @google-cloud/pagespeed-insights** — Official Google SDKs; OAuth2-compliant, maintained by Google
- **Cheerio 1.0+** — HTML parsing; fast, jQuery-like API, no browser overhead
- **Pino 8.x** — Structured logging; critical for observability in cron jobs without console access

See STACK.md for detailed version pinning and anti-patterns to avoid (CommonJS, Puppeteer over Playwright, Jest for CLI tools).

### Expected Features

**Must have (table stakes):**
- On-page SEO audit (meta tags, headers, alt text, schema markup)
- Technical SEO checks (Next.js-aware: dynamic routes, broken links, duplicate content)
- Core Web Vitals analysis (PageSpeed Insights integration)
- GitHub PR workflow (create branches, commit changes, open PRs)
- Google Search Console integration (read organic search data)
- Multi-site management (under 10 sites per agent instance)
- Monthly scheduled audits (cron-based, no manual intervention)

**Should have (competitive differentiators):**
- Next.js-native auditing (understand getStaticProps, API routes, middleware, image optimization)
- Auto-fix capabilities (generate code for missing meta tags, schema, alt text)
- Blog post generation (create original, SEO-optimized content targeting keyword gaps)
- PR-first workflow (all changes via PR, never direct commits)
- Incremental fixes strategy (prioritize by risk, avoid breaking changes)
- Internal linking strategy (new blog posts link to existing content)

**Defer to v2+ (out of scope for Phase 1-3):**
- Web dashboard UI
- Real-time monitoring
- Direct site publishing
- Backlink analysis
- E-commerce-specific features
- Auto-merge of PRs (always require human review)

See FEATURES.md for detailed feature dependencies and validation questions before Phase 2/3 launch.

### Architecture Approach

SEO agents follow a **modular pipeline architecture** with five stages: (1) Discovery (crawl, parse, inventory), (2) Analysis (apply rules, fetch Google APIs, identify keyword opportunities), (3) Decision (prioritize, deduplicate, rank by impact), (4) Execution (generate code/content, create PRs), and (5) Orchestration (schedule, monitor, log). This allows failures in later stages without re-running expensive early stages, and each stage to be independently tested.

**Major components:**
1. **Orchestrator** — Coordinates entire pipeline, handles monthly cron trigger or manual CLI invocation
2. **Config Manager** — Loads site configs, manages GitHub and Google API credentials
3. **Crawler & Parser** — Fetches pages, respects robots.txt, extracts semantic structure (meta, headings, links)
4. **SEO Auditor** — Applies rules-based checks; outputs issues with severity levels
5. **Data Fetcher** — Calls Google APIs (Search Console, PageSpeed, Analytics)
6. **Decision Engine** — Deduplicates issues, ranks by impact, categorizes as auto-fix vs needs-review
7. **LLM Gateway (Portkey)** — Routes content generation and code fix requests to configured AI provider
8. **Repository Manager & PR Creator** — Git operations (clone, branch, commit, push), GitHub PR submission
9. **Notification Handler** — Logs results, sends summaries

Key patterns: pipeline with checkpoints (persist state between phases), separation of concerns via adapters (easy to swap crawlers, auditors, LLM providers), idempotent operations with state tracking (no duplicate PRs), and LLM integration via abstraction layer (avoid hardcoding provider logic). See ARCHITECTURE.md for detailed component boundaries, data flow diagrams, and scalability considerations.

### Critical Pitfalls

1. **Unvalidated code changes break production** — Agent generates code that passes syntax validation but breaks Next.js builds or corrupts runtime behavior. Mitigation: Run `next build` and test suites before PR submission; validate schema.org markup against specs; analyze existing routing before generating redirects.

2. **Google API quota exhaustion and rate limiting** — Monthly runs fail silently when quotas are hit, or quotas exhaust before covering all sites. Mitigation: Pre-audit quota limits per API; implement response caching (24-48 hours); use exponential backoff (1s→60s) for 429 errors; log quota remaining after each request; set max 5 requests per site per audit cycle.

3. **Unsafe GitHub PR submission (secrets, malicious content)** — Agent submits PR with API keys in generated code, overwrites critical files, or creates reserved branch names. Mitigation: Sanitize all generated content; explicit file allowlist (e.g., `content/blog/`, `public/`, metadata only); run secrets detection before submission; validate file paths; rate-limit PR creation (max 1/site/hour, max 10 concurrent open PRs).

4. **Content generation without plagiarism validation** — AI models regurgitate existing content or generate thin, keyword-stuffed articles. Mitigation: Check against web plagiarism APIs (Copyscape-like); verify >70% unique against top 5 SERPs; flag statistics for manual verification; require explicit approval before first 3-5 blog PRs merge; enforce 500+ word minimum.

5. **Ineffective keyword research (wrong keywords, no search volume)** — Blog posts target keywords with zero traffic or too-high competition. Mitigation: Cross-check Search Console data with demand validation (min 10 searches/month); analyze SERP difficulty; filter for commercial intent; avoid keyword cannibalization with existing content; prioritize long-tail (<1000 monthly searches).

See PITFALLS.md for 12 identified pitfalls (5 critical, 5 moderate, 2 minor) with detection strategies and phase-specific warnings.

## Implications for Roadmap

Based on research, the project should follow a **4-phase delivery plan** with safety gates between phases. Each phase delivers validated capability before moving to higher-risk work.

### Phase 1: Core Audit Discovery & PR Workflow
**Rationale:** Validates the foundational "autonomous agent submitting reviewable PRs" concept with low-risk detection only. Proves PR delivery workflow before adding code generation complexity.

**Delivers:**
- On-page SEO audit (meta tags, heading structure, alt text)
- Technical SEO checks (Next.js-aware crawling, broken links, redirects)
- Core Web Vitals analysis (PageSpeed Insights integration)
- GitHub PR submission (report findings, no auto-fixes yet)
- Multi-site configuration (2-3 test sites)
- Monthly scheduled audits (cron-based execution)

**Components to build:**
- Crawler (Cheerio + node-fetch), Parser, Inventory Builder, SEO Auditor
- Data Fetcher (Google Search Console, PageSpeed APIs)
- Config Manager (site configs, credential management)
- Orchestrator (cron scheduling)
- Repository Manager (clone, branch, basic commit)
- PR Creator (submit audit findings PRs)
- Notification Handler (logs, completion alerts)

**Safety gates before Phase 1 launch:**
- Google API quota validated to exist
- Caching strategy for API responses in place (prevent quota exhaustion)
- Secrets detection tool integrated (block PR submission if credentials present)
- Cloud logging setup (Datadog, CloudWatch, or similar)
- Error monitoring and completion notifications configured

**Avoids (Phase 1 scope):**
- Auto-fix code generation (defer to Phase 2)
- Content generation (defer to Phase 3)
- Direct site publishing (all via PRs)

### Phase 2: Auto-Fix Capabilities & Content Generation Groundwork
**Rationale:** Adds "fix" capability once audit is proven safe. Implements code generation with guardrails. Establishes content generation infrastructure and validation pipelines before actual generation.

**Delivers:**
- Auto-fix for low-risk issues (meta tags, alt text, canonical tags, schema markup)
- Decision Engine (prioritize issues, rank by impact)
- LLM integration (Portkey gateway, prompt templates)
- Keyword Analyzer (identify content gaps from Search Console)
- Content generation validation pipeline (plagiarism detection, originality checks)
- PR strategy refinement (separate "audit findings" from "approved fixes")

**Safety gates before Phase 2 launch:**
- Build validation on all code change PRs (run `next build`, reject if fails)
- Test execution before PR submission (run existing test suites)
- Schema validation for generated schema.org markup
- File allowlist enforced (which files can be modified)
- First 3-5 code fix PRs require explicit approval before merge
- Keyword research validated against SERP difficulty API

**Avoids (Phase 2 scope):**
- Blog post generation (defer to Phase 3 until validation pipeline proven)
- JavaScript-heavy site rendering (Playwright deferred)
- Client site customization per tech stack (defer to Phase 4)

### Phase 3: Blog Post Generation & Advanced Content Strategy
**Rationale:** Highest-complexity phase. Adds blog post generation once audit + code generation proven safe.

**Delivers:**
- SEO-optimized blog post generation (original prose, keyword-focused)
- Content calendar tracking (avoid duplicates, space out posts)
- Internal linking strategy (link to existing content contextually)
- Content authenticity (vary structure, tone, avoid AI templates)
- Content limits enforcement (1-3 posts/site/month max)

**Safety gates before Phase 3 launch:**
- Plagiarism detection working end-to-end (manual QA on 5+ generated posts)
- Blog generation limits enforced (max 1-3 per site per month)
- Content quality gate (first 5 blog PRs require client approval before merge)
- Keyword volume validation (only target keywords with >10 searches/month)
- Fact-checking for statistics (flag claims requiring sources)

### Phase 4+: Advanced Next.js Parsing & Refinement
**Rationale:** Refinement and scaling; safe to defer as these enhance validated core.

**Delivers:**
- Advanced Next.js parsing (App Router, getStaticProps optimization)
- Client site customization (per tech stack: MDX, headless CMS, custom routing)
- Cost/benefit analysis (which fixes have highest impact)
- Performance-driven optimization (prioritize by Core Web Vitals impact)

### Phase Ordering Rationale

1. **Phase 1 first:** Validates core value prop (autonomous agent → PRs) with low-risk detection. Discovery and analysis are foundational—all later phases depend on this.

2. **Phase 2 before Phase 3:** Code generation is lower-risk than content generation. A bad meta tag fix is easier to revert than a bad blog post. Builds confidence before scaling to content.

3. **Phase 3 after Phase 2:** Content generation depends on proven LLM quality and validated keyword research. Phase 2 provides that foundation.

4. **Phase 4+ after Phase 3:** Scaling and advanced patterns can be added without blocking core value delivery.

**Dependency structure** (no wasted work):
- Phase 1 persists crawl and analysis state (reused in Phase 2)
- Phase 2 reuses Phase 1 analysis + adds decision engine (extends, not replaces)
- Phase 3 reuses Phases 1-2 infrastructure + adds content pipelines

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Node.js 20 LTS + TypeScript is production standard. Yargs, Pino, Octokit are stable 5+ years. |
| Features | MEDIUM | Core features (audit, PR workflow) well-defined. Content generation quality needs validation on real sites. Phase 2-3 questions validated during implementation. |
| Architecture | HIGH | Modular pipeline pattern proven in SEO tools and RPA systems. Component boundaries clear. |
| Pitfalls | MEDIUM | Critical pitfalls identified from domain patterns. Some (code generation safety, plagiarism) need integration-time validation. |

**Overall confidence:** MEDIUM-HIGH. Stack and architecture are solid and proven. Main uncertainty is feature execution risk (especially content quality) and integration-time challenges (Google API quotas, Portkey SDK behavior, Next.js code generation quality). No blocking unknowns; all can be resolved during Phase 1.

### Gaps to Address

1. **Google API quota limits** — WebSearch blocked; exact free tier quotas need verification. Get current quota from Google Cloud Console before Phase 1 launch.

2. **Portkey SDK version & TypeScript types** — Verify latest @portkey-ai/portkey-node version has TypeScript support and all required methods before integration.

3. **Next.js code generation quality** — Create test harness in Phase 1 to validate actual output on real Next.js repos.

4. **Blog post quality bar** — Generate 3-5 sample posts with actual LLM; have team review quality before Phase 3 launch.

5. **Plagiarism API cost & availability** — Evaluate Copyscape API, OSS alternatives, or hybrid approach before Phase 2.

6. **Client timezone and review workflow** — Define client notification process, approval gates, and timezone-aware scheduling during Phase 1 planning.

## Sources

### Primary (HIGH confidence)
- **STACK.md** — Node.js ecosystem standards, TypeScript maturity, Yargs/Pino/Octokit stability
- **ARCHITECTURE.md** — Pipeline patterns from established SEO tools (Semrush, SEMtrack) and microservices architecture
- **PITFALLS.md** — Domain expertise in autonomous code generation and Google API integration

### Secondary (MEDIUM confidence)
- **FEATURES.md** — Feature expectations from established SEO tool categories and AI agent patterns
- **Phase ordering** — Dependency analysis and risk assessment from combined research

### Research Limitations
- WebSearch/WebFetch blocked; cannot verify exact current API versions
- Portkey SDK compatibility requires integration-time validation
- Google API quota limits need verification against current Google Cloud tiers
- Blog generation quality requires sample generation and team validation

---

*Research completed: 2026-03-21*
*Synthesized from: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
*Ready for roadmap planning: yes*

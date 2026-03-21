# Feature Landscape: SEO Automation Agent for Next.js Sites

**Domain:** Autonomous SEO auditing, issue remediation, and content generation
**Researched:** 2026-03-21
**Confidence:** MEDIUM (training data + project context, but ecosystem may have evolved)

## Table Stakes

Features users expect from an SEO automation tool. Missing these = product feels incomplete and unreliable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **On-page SEO audit** | Core value — detect missing/broken meta tags, headers, alt text, schema markup | Medium | Must detect at minimum: title, meta description, H1-H6 structure, image alt attributes, canonical tags, Open Graph tags |
| **Technical SEO checks** | Essential for Next.js health — crawl errors, duplicate content, broken links, redirect chains | Medium | Specific to Next.js: dynamic routes, API routes, middleware redirects, rewrite rules |
| **Core Web Vitals analysis** | Google's ranking signal — LCP, FID, CLS assessment via PageSpeed Insights API | Low | Integrate with Google PageSpeed Insights; flag pages below thresholds |
| **Automated PR generation** | Stated requirement — deliver changes as reviewable pull requests, not direct commits | Medium | Generate well-formatted PR titles, descriptions with justification, link to audited issues |
| **GitHub integration** | Foundational for delivery model — authenticate, create branches, push code, open PRs | Medium | Must support commit signing, branch naming conventions, handle authentication securely |
| **Multi-site management** | Agency manages under 10 sites — organize configs, run audits per-site, aggregate results | Low | Support site-specific settings: crawl rules, ignore patterns, auth requirements |
| **Monthly scheduled audits** | Monthly cadence is requirement — cron-based execution, no manual intervention needed | Low | Use Node.js cron or cloud scheduler; log runs; surface errors without noise |
| **Google Search Console integration** | Data source for organic traffic, search impressions, query performance | Medium | Fetch real search data; use to drive keyword research and identify pages needing fixes |
| **Keyword research capability** | Generate blog posts targeting discovered opportunities — identify low-hanging fruit keywords | Medium | Use Google Search Console queries, Google Trends, Search Console ranking keywords to find gaps |
| **SEO-optimized blog post generation** | Stated requirement — create content targeting keyword opportunities | High | Must produce readable, original prose; optimize for keyword density, internal links, structure; avoid thin content |
| **Audit result reporting** | Users need to understand what was found and why changes were made | Low | PR descriptions should be clear; optional: summary report/dashboard (out of scope for CLI) |

## Differentiators

Features that set this product apart from generic SEO tools. Not expected by default, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Next.js-native auditing** | Most SEO tools treat Next.js as generic—this agent understands Next.js conventions (dynamic routes, API routes, middleware, image optimization) | Medium | Parse getStaticProps/getServerSideProps, check next/image usage, validate SSG/ISR setup, understand route prefixes |
| **Auto-fix capabilities** | Most tools report issues; this fixes them — generates code to add missing meta tags, alt text, schema, fix redirects | High | Phase-based approach: Phase 1 (low-risk fixes), Phase 2 (content changes), Phase 3 (structural changes) |
| **Autonomous blog generation** | Instead of requiring marketing staff to write, generate original blog posts targeting keyword gaps | High | Avoid keyword stuffing; ensure readability; include internal links; generate markdown suitable for Next.js MDX if used |
| **PR-first workflow** | All changes as pull requests, no direct commits — gives agency control and audit trail | Medium | Enforce clean Git history; include testing suggestions in PR; reference audit findings |
| **AI model flexibility via Portkey** | Swap between Claude, GPT-4, other models without code changes — avoid vendor lock-in | Low | Portkey abstracts provider; surface cost/quality tradeoffs in config |
| **Incremental fixes strategy** | Don't try to fix everything in one PR—prioritize quick wins, safety, and readability | Medium | Phase issues by risk: meta tags/structure first, then content, then deep restructuring |
| **Content authenticity & originality** | Generated blog posts feel written by a real person, not an AI template | High | Vary structure, tone, examples; avoid repetitive phrases; ensure unique voice per client/brand |
| **Internal linking strategy** | Auto-generated blog posts link to existing site content strategically, boosting SEO value | Medium | Analyze existing content; identify keywords each page ranks for; link contextually (not artificially) |
| **Performance-driven audit focus** | Prioritize fixes that move needle on Core Web Vitals and actual Google rankings | High | Tie audit findings to impact estimates; suggest fixes aligned with highest-impact issues |
| **Client site customization** | Each client may have different tech stack details (MDX, CMS, custom routing) — handle variants | Medium | Config per site: content directory, image paths, URL structure, frameworks used (Next.js + headless CMS, etc.) |

## Anti-Features

Features to deliberately NOT build. Focus on what this tool does exceptionally well.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Web dashboard UI** | Stated out of scope; CLI + scheduled runs sufficient for under 10 sites | Build clear CLI output and GitHub PR descriptions; eventual dashboard can sit on top |
| **Real-time monitoring** | Out of scope; monthly cadence is sufficient for small agency; real-time adds complexity | Stick to monthly cron; users can trigger manual runs via CLI if needed |
| **Direct publishing to sites** | Dangerous without review; violates stated requirement for PR-based workflow | All changes must go through PR review; no auto-merge, no direct commits |
| **Backlink analysis** | Out of scope for v1; Ahrefs/SEMrush integration adds external dependency and cost | Focus on on-page and technical SEO within your control; skip backlink features |
| **Competitor analysis** | Out of scope for v1; dilutes focus; not core to fixing your own site | Concentrate on site's own opportunities; avoid competitive benchmarking features |
| **Multi-language/international SEO** | Scope creep; assume English-primary sites for v1 | Validate requirement per client before adding hreflang, language tags, geo-targeting |
| **E-commerce-specific features** | Not in scope; assume content sites, SaaS, and service company sites | Don't build product schema optimization, shopping feed generation, review management |
| **Advanced rank tracking** | Historical ranking data requires months of collection; out of scope for launch | Use Google Search Console current ranking data; skip 6-month historical trends |
| **Link building recommendations** | Requires external data; out of scope | Stick to on-site fixes; defer outreach/link-building to human strategy |
| **Auto-merge of PRs** | Violates control requirement; agency must review | Always stop at PR creation; require human review before merge |

## Feature Dependencies

Understanding which features depend on others.

```
Core audit → PR generation
├─ On-page checks
├─ Technical checks
└─ Core Web Vitals analysis

Content generation → Blog post submission
├─ Keyword research
├─ Search Console integration (data source)
└─ Blog post generation (write content)

Auto-fix → PR generation
├─ Audit findings (what to fix)
└─ Code generation (generate fixes)

Multi-site management
└─ Site config (per-site settings)
└─ All other features (scoped per site)

Scheduled audits
└─ All features (must run all audits on schedule)
```

## MVP Recommendation

**Recommend phasing features across releases to validate core value quickly:**

### Phase 1: Foundation (MVP — Validate Core Audit + PR Workflow)
Prioritize to prove the "autonomous agent doing SEO work and submitting PRs" concept:
1. **On-page SEO audit** (detect meta, headers, alt text)
2. **Core Web Vitals analysis** (PageSpeed Insights integration)
3. **GitHub integration** (create PRs with findings)
4. **Multi-site config** (manage 2-3 test sites)
5. **Google Search Console integration** (read search data, inform later)

**Why this order:**
- Validates PR-based delivery workflow
- Builds confidence in autonomous agent concept
- Produces immediately actionable PRs
- Keeps scope tight (detect, don't fix yet)

**Defer to Phase 2:** Auto-fix code generation, blog post creation

### Phase 2: Auto-Fix Capabilities
Add the "fix" part of the agent once audit is proven:
1. **Auto-fix for low-risk issues** (add missing meta tags, schema, alt text)
2. **Incremental PR strategy** (separate "audit findings" from "fixes to merge")
3. **Next.js-native code generation** (understand Next.js structure)

**Why Phase 2:**
- Code generation is higher risk; validate audit first
- Builds on Phase 1 infrastructure
- Unlocks "autonomous agent actually improving sites" value

### Phase 3: Content Generation
Add blog post generation once audit + fixes are proven:
1. **Keyword opportunity analysis** (identify gaps in content coverage)
2. **Blog post generation** (AI-written, SEO-optimized)
3. **Internal linking strategy** (link to existing content)

**Why Phase 3:**
- Highest complexity; requires proven AI model quality
- Benefits from Phase 1-2 infrastructure
- Proves "monthly new content" value

### Phase 4+: Refinement & Differentiation
- Advanced Next.js parsing (API routes, middleware, dynamic routes)
- Client site customization per tech stack
- Cost/benefit analysis (which fixes have highest impact)
- Advanced content strategies (content clusters, pillar pages)

---

## Feature Completeness for Roadmap

| Feature | Phase | Rationale |
|---------|-------|-----------|
| On-page audit | Phase 1 | Core value, MVP validation |
| Technical SEO checks | Phase 1 | Next.js-native understanding required |
| Core Web Vitals | Phase 1 | Easy integration, high value |
| GitHub PR workflow | Phase 1 | Foundational to delivery model |
| Google Search Console | Phase 1 | Data source for keyword research, low lift |
| Multi-site config | Phase 1 | Must support from start |
| Monthly scheduling | Phase 1 | Operational requirement |
| Auto-fix: meta/schema | Phase 2 | After audit proven safe |
| Auto-fix: content changes | Phase 3 | Higher risk, defer until ready |
| Blog generation | Phase 3 | Highest complexity, highest value |
| Internal linking | Phase 3 | Depends on blog generation |
| Next.js-native parsing | Phase 2-3 | Foundational for auto-fix quality |
| Incremental PR strategy | Phase 2 | Supports safe, reviewable changes |
| Content authenticity | Phase 3 | Differentiator, not table stakes initially |

## Key Questions for Validation

Before committing to this feature set, consider:

1. **Blog generation quality:** Will generated posts be good enough to publish? Phase 3 success depends on this. Consider requiring human review + minor edits initially.

2. **Auto-fix safety:** Which Next.js patterns will the agent handle first? Start with meta tags (low risk) before touching routing/structure.

3. **Keyword research accuracy:** Does Search Console data alone drive meaningful keyword opportunities? May need Search Trends, related keywords, or other sources.

4. **Client customization cost:** How much per-site configuration before it becomes unmaintainable? Validate with 2-3 client sites in Phase 1.

5. **PR review burden:** Are PRs clear enough for non-technical agency staff to review? Test descriptions and add visual diffs if needed.

## Sources

Based on knowledge of:
- Google Search Console API documentation and capabilities
- PageSpeed Insights API integration patterns
- GitHub API for PR automation
- Established SEO tool categories (Ahrefs, SEMrush, Screaming Frog, Moz)
- Autonomous AI agent patterns in content generation and code generation
- Next.js documentation and ecosystem patterns

**Note:** Web search access was denied; this research is based on training data current to February 2025. Recommend validating Phase 1 feature completeness with 1-2 pilot audits before full Phase 1 launch.

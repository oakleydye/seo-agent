# SEO Agent

## What This Is

An autonomous AI agent that runs monthly SEO audits on a portfolio of Next.js client sites, auto-fixes issues by submitting pull requests to GitHub, generates keyword-researched blog posts, and delivers everything as reviewable PRs. Built for a small web development and digital marketing agency managing under 10 sites.

## Core Value

Every client site gets consistent, automated SEO maintenance — audits run, issues get fixed, and fresh content gets created — without manual effort beyond reviewing PRs.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Crawl and audit Next.js sites for SEO issues (meta tags, technical SEO, content gaps, performance)
- [ ] Auto-fix discovered issues and submit GitHub PRs for review
- [ ] Perform keyword research using Google Search Console and related APIs
- [ ] Generate SEO-optimized blog posts targeting discovered keyword opportunities
- [ ] Submit blog posts as GitHub PRs to client Next.js repos
- [ ] Run on a monthly schedule via cron with CLI for manual triggers
- [ ] Integrate with Portkey for flexible AI model selection (Claude, GPT-4, etc.)
- [ ] Integrate with Google Search Console, PageSpeed Insights, and Google Analytics
- [ ] Support managing multiple client site configurations

### Out of Scope

- Web dashboard UI — CLI and scheduled runs only
- Real-time monitoring or alerting — monthly batch process
- Direct publishing to sites — all changes go through PR review
- Backlink analysis — no Ahrefs/SEMrush integration for v1
- Competitor analysis — focus on individual site optimization first

## Context

- All client sites are Next.js applications with source code hosted on GitHub
- Agency currently manages under 10 sites
- Owner wants PR-based workflow so all changes are reviewable before merge
- Portkey integration provides model flexibility without vendor lock-in
- Google APIs (Search Console, PageSpeed Insights, Analytics) are available for SEO data
- This is a greenfield project — no existing tooling to integrate with

## Constraints

- **AI Provider**: Must use Portkey as AI gateway for model flexibility
- **Delivery**: All changes delivered as GitHub PRs — no direct commits or auto-publishing
- **Sites**: Next.js only — no need to support other frameworks
- **Data Sources**: Google APIs for SEO data (Search Console, PageSpeed Insights, Analytics)
- **Scale**: Designed for under 10 sites — optimize for correctness over throughput

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Portkey over direct API calls | Model flexibility, swap providers without code changes | — Pending |
| PR-based delivery over auto-publish | Agency owner needs to review all changes before they go live | — Pending |
| CLI + cron over web dashboard | Simpler to build, sufficient for under 10 sites | — Pending |
| Google APIs only for v1 | Available now, covers core SEO data needs | — Pending |

---
*Last updated: 2026-03-21 after initialization*

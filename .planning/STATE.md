---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 1 (Core Audit Discovery & PR Workflow)
current_plan: 2 / 5
status: in-progress
last_updated: "2026-03-21T18:53:00Z"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 5
  completed_plans: 1
---

# Project State: SEO Agent

**Last Updated:** 2026-03-21
**Current Phase:** 1 (Core Audit Discovery & PR Workflow)
**Current Plan:** 2 / 5

---

## Project Reference

**Core Value:**
Every client site gets consistent, automated SEO maintenance — audits run, issues get fixed, and fresh content gets created — without manual effort beyond reviewing PRs.

**Current Focus:**
Building Phase 1 foundation: autonomous crawling, issue detection, and PR submission workflow.

---

## Current Position

**Phase:** 1 / 3
**Progress:** 1 / 5 plans

```
[######                        ] 20%
Phase 1: Core Audit Discovery & PR Workflow
```

**Deliverables:**
- Crawler for Next.js sites (respects robots.txt, handles JS rendering)
- SEO auditor (meta tags, headers, links, canonicals, alt text)
- PageSpeed Insights integration for Core Web Vitals
- GitHub PR workflow (branch creation, commits, PR submission)
- CLI tool with monthly cron scheduling
- Multi-site configuration support

---

## Performance Metrics

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| Requirements Covered | 26/26 | 26/26 ✓ | 100% of v1 mapped |
| Phase 1 Plans | 5 | 1/5 complete | 01-01 done |
| Code Coverage | >80% | — | TBD |

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Owner | Status |
|----------|-----------|-------|--------|
| 3-phase structure (Audit → Fix → Content) | Safety gates between phases; validate low-risk detection before code generation, code before content | Research → Roadmap | ✓ Implemented in ROADMAP.md |
| Phase 1 focused on detection only (no auto-fix) | Validates "agent → PR" concept before adding code generation complexity | Research/Domain | ✓ In roadmap |
| Portkey as LLM gateway | Model flexibility, no vendor lock-in, used in Phase 2+ | Project constraints | ✓ In INFRA-02 |
| PR-first delivery (no auto-merge) | Agency owner needs human review before changes go live | PROJECT.md | ✓ In all phases |
| Node.js 20 LTS + TypeScript + Yargs CLI | Production stability, ESM-native, mature ecosystem | Research/Stack | ✓ In INFRA-01 |
| pino@8 bundles own TypeScript types | @types/pino@8 not published on npm; pino ships declarations in-package | 01-01 execution | ✓ Applied |
| No @google-cloud/pagespeed-insights | Uses direct fetch to PageSpeed API endpoint per plan | 01-01 execution | ✓ Applied |
| Portkey client is Phase 1 stub | Initialized but no active LLM calls until Phase 2 | 01-01 execution | ✓ Applied |

### Safety Gates

**Before Phase 1 Launch:**
- [ ] Google API quota limits verified in Google Cloud Console
- [ ] API response caching strategy implemented (24-48h TTL)
- [ ] Secrets detection tool integrated (block PRs with credentials)
- [ ] Cloud logging setup (Datadog/CloudWatch/similar)
- [ ] Error monitoring and completion notifications configured

**Before Phase 2 Launch:**
- [ ] Build validation running on all code change PRs (`next build`)
- [ ] Test execution before PR submission (run existing test suites)
- [ ] Schema validation for generated schema.org markup
- [ ] File allowlist enforced (which files can be modified)
- [ ] First 3-5 code fix PRs require explicit approval before merge
- [ ] Keyword research validated against SERP difficulty

**Before Phase 3 Launch:**
- [ ] Plagiarism detection working end-to-end (manual QA on 5+ posts)
- [ ] Blog generation limits enforced (max 1-3 per site/month)
- [ ] Content quality gate (first 5 blog PRs require client approval)
- [ ] Keyword volume validation (only >10 searches/month)
- [ ] Fact-checking for statistics (flag claims requiring sources)

### Known Constraints

- **AI Provider:** Portkey (hard requirement)
- **Delivery:** All changes via GitHub PRs (no direct commits)
- **Sites:** Next.js only (no other frameworks)
- **Data Sources:** Google APIs (Search Console, PageSpeed, Analytics)
- **Scale:** Under 10 sites per instance
- **Monthly cadence:** Scheduled runs, not real-time

### Risks & Mitigations

| Risk | Severity | Mitigation | Owner |
|------|----------|-----------|-------|
| Google API quota exhaustion | HIGH | Pre-audit limits, implement caching (24-48h), exponential backoff, quota logging | Phase 1 |
| Unvalidated code breaks production | HIGH | Run `next build` + test suites before PR, validate schema markup | Phase 2 |
| Blog post plagiarism liability | HIGH | >70% originality check against top 5 SERPs, manual QA on first 5 posts | Phase 3 |
| Secrets leakage in PRs | MEDIUM | Secrets detection tool before submission, sanitize all generated content | Phase 1 |
| Ineffective keyword research | MEDIUM | Cross-check Search Console with demand validation (≥10/month), SERP analysis | Phase 2 |

### Pending Investigation

- [ ] Portkey SDK version & TypeScript support (verify before Phase 1 planning)
- [ ] Next.js code generation quality (create test harness in Phase 1)
- [ ] Plagiarism API cost & availability (Copyscape vs OSS alternatives)
- [ ] Client notification & approval workflow (timezone-aware scheduling)
- [ ] Exact Google API quota limits for free tier (check Google Cloud Console)

---

## Session Continuity

**Last Session:** 2026-03-21T18:53:00Z
**Completed:** 01-01-PLAN.md — project scaffold, shared types (9 interfaces + Zod schemas), config loader, pino logger with secrets redaction, Portkey stub
**Next Action:** Execute 01-02-PLAN.md

**Files to Review:**
- `.planning/ROADMAP.md` — Phase structure and success criteria
- `.planning/research/SUMMARY.md` — Recommended stack and architecture patterns
- `.planning/REQUIREMENTS.md` — Full requirement list with traceability

---

*State initialized: 2026-03-21*

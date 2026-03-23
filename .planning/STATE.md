---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 3
current_plan: Not started
status: unknown
last_updated: "2026-03-23T18:24:24.090Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 16
  completed_plans: 12
  percent: 75
---

# Project State: SEO Agent

**Last Updated:** 2026-03-22
**Current Phase:** 3
**Current Plan:** Not started

---

## Project Reference

**Core Value:**
Every client site gets consistent, automated SEO maintenance — audits run, issues get fixed, and fresh content gets created — without manual effort beyond reviewing PRs.

**Current Focus:**
Building Phase 1 foundation: autonomous crawling, issue detection, and PR submission workflow.

---

## Current Position

**Phase:** 1 / 3
**Progress:** [████████░░] 75%

```
[############                  ] 40%
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
| Phase 1 Plans | 5 | 4/5 complete | 01-01, 01-02, 01-03, 01-04 done |
| Code Coverage | >80% | — | TBD |

---
| Phase 01-core-audit-discovery-pr-workflow P02 | 5 | 4 tasks | 4 files |
| Phase 01 P03 | 4 | 2 tasks | 3 files |
| Phase 01-core-audit-discovery-pr-workflow P04 | 4 | 2 tasks | 6 files |
| Phase 01-core-audit-discovery-pr-workflow P05 | 4 | 2 tasks | 6 files |
| Phase 02-auto-fix-content-strategy P01 | 3 | 2 tasks | 6 files |
| Phase 02-auto-fix-content-strategy P03 | 3 | 1 tasks | 4 files |
| Phase 02-auto-fix-content-strategy P04 | 5 | 1 tasks | 4 files |
| Phase 02-auto-fix-content-strategy P02 | 4 | 2 tasks | 4 files |
| Phase 02-auto-fix-content-strategy P05 | 3 | 2 tasks | 4 files |
| Phase 02-auto-fix-content-strategy P06 | 11 | 2 tasks | 5 files |
| Phase 03 P01 | 2 | 2 tasks | 2 files |

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
| domhandler Element type for cheerio nodes | cheerio v1 does not export Element from its namespace; domhandler is the correct source for node type assertions | 01-03 execution | ✓ Applied |
| Empty alt='' is valid HTML for decorative images | Only missing alt attribute (undefined) raises warning; empty alt="" is intentional and skipped | 01-03 execution | ✓ Applied |
| Duplicate content via 500-char normalized text fingerprint | Skips pages under 100 chars to avoid false positives on stub/error pages | 01-03 execution | ✓ Applied |
| vi.useFakeTimers() for async retry/sleep tests | Real 7s backoff delays cause test timeout; fake timers drain instantly via runAllTimersAsync() | 01-04 execution | ✓ Applied |
| Octokit getBranch called twice per PR creation | First call gets default branch SHA; second checks if audit branch exists — mock queue order must match | 01-04 execution | ✓ Applied |
| AuditRunState never throws — all stage errors captured in state object with status:failed | 01-05 execution | ✓ Applied |
| for..of loop (not Promise.all) ensures true sequential site processing in runAuditForAllSites | 01-05 execution | ✓ Applied |
| CommandModule<object,AuditArgs> with 'dry-run' kebab-case key resolves yargs TS overload conflict | 01-05 execution | ✓ Applied |
| fixPRTracking added to SiteConfig in types/index.ts (not loader.ts) to keep Zod schema and TypeScript interface co-located | 02-01 execution | ✓ Applied |
| Unhandled rejection in withRetry test fixed by registering .rejects handler before vi.runAllTimersAsync() — pattern applied going forward | 02-01 execution | ✓ Applied |
| Used Ajv instead of schemaorg-jsd for JSON-LD validation — Ajv actively maintained (2025); schemaorg-jsd last updated 5 years ago | 02-03 execution | ✓ Applied |
| Ajv validators compiled once at module load (not per-call) for performance — 4 validators stored in Record<SchemaType, ValidateFunction> | 02-03 execution | ✓ Applied |
| vi.hoisted() required in vitest when vi.mock factory needs a shared fn reference — top-level const causes hoisting error before initialization | 02-04 execution | ✓ Applied |
| execa with reject:false for npm build — non-zero exits return as result objects, not thrown exceptions | 02-02 execution | ✓ Applied |
| Shallow clone (--depth 1) for build validation — full history not needed, faster clone | 02-02 execution | ✓ Applied |
| googleapis package used (not @google-cloud/search-console) for GSC integration — plan specifies google.searchconsole('v1') API surface from googleapis | 02-04 execution | ✓ Applied |
| Labels created on repo via createLabel before addLabels — 422 conflict silently ignored (label already exists) | 02-05 execution | ✓ Applied |
| getFixPRLabels accepts optional fixResults[] for build-failure-driven needs-review label | 02-05 execution | ✓ Applied |
| Resolver wrapper required: resolveSourceFileFromUrl accepts string but groupIssuesBySourceFile callback receives Issue — pass (issue) => resolveSourceFileFromUrl(issue.pageUrl) not the function reference directly | 02-06 execution | ✓ Applied |
| fix CLI exits 1 only when ALL sites fail (partial success = exit 0), consistent with audit command multi-site behavior | 02-06 execution | ✓ Applied |
| gray-matter@4.0.4 and natural@6.12.0 exact versions unavailable on npm; used latest compatible: gray-matter@^4.0.3 and natural@^8.1.1 | 03-01 execution | ✓ Applied |
| BlogPostSchema enforces content min via z.string().min(2000) characters (~500 words) alongside explicit wordCount: z.number().int().min(500) field | 03-01 execution | ✓ Applied |

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

**Last Session:** 2026-03-23T18:24:24.087Z
**Completed:** 02-06-PLAN.md — fix pipeline orchestrator (runFixForSite/runFixForAllSites) and 'fix' CLI command, completing Phase 2 wave 4 final integration
**Next Action:** Phase 2 complete (all 6 plans done). Ready for Phase 3 content strategy.

**Files to Review:**
- `.planning/ROADMAP.md` — Phase structure and success criteria
- `.planning/research/SUMMARY.md` — Recommended stack and architecture patterns
- `.planning/REQUIREMENTS.md` — Full requirement list with traceability

---

*State initialized: 2026-03-21*

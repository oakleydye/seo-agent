---
phase: 01-core-audit-discovery-pr-workflow
plan: 04
subsystem: api
tags: [pagespeed-insights, github-api, octokit, markdown, pr-workflow, node-fetch]

# Dependency graph
requires:
  - phase: 01-core-audit-discovery-pr-workflow
    plan: 01
    provides: "CoreWebVitals, AuditFindings, Issue types in src/types/index.ts"
  - phase: 01-core-audit-discovery-pr-workflow
    plan: 03
    provides: "SEO audit rules producing Issue[] — input to formatPRBody"
provides:
  - "fetchCoreWebVitals() calling PageSpeed Insights API v5 with exponential backoff"
  - "formatPRTitle() and formatPRBody() generating GitHub-flavored Markdown PR descriptions"
  - "createAuditPR() creating idempotent seo-audit/YYYY-MM-DD branches and PRs via Octokit"
affects:
  - 01-05
  - 02-core-fix-generation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exponential backoff retry loop: 3 retries, BASE_DELAY * 2^attempt for rate limiting"
    - "Idempotency via pulls.list check before PR creation; getBranch 404 check before branch creation"
    - "Markdown table cell escaping: replace /\\|/g with \\\\| and /\\n/g with space"
    - "vi.useFakeTimers() + vi.runAllTimersAsync() for testing async retry/sleep logic"
    - "Sequential Octokit mock setup: mockResolvedValueOnce queue for ordered API call assertions"

key-files:
  created:
    - src/fetcher/pagespeed.ts
    - src/fetcher/pagespeed.test.ts
    - src/executor/pr-formatter.ts
    - src/executor/pr-formatter.test.ts
    - src/executor/github.ts
    - src/executor/github.test.ts
  modified: []

key-decisions:
  - "vi.useFakeTimers() required for 429 retry tests — real sleep would timeout test runner at 5s"
  - "getBranch called twice per PR creation: once for default branch SHA, once to check audit branch existence"
  - "beforeEach mock queue must use mockResolvedValueOnce for default branch (not mockRejectedValueOnce) — implementation calls getBranch for default branch before audit branch"

patterns-established:
  - "TDD RED/GREEN: test files committed before implementation, failing import confirmed before writing code"
  - "Fake timers for sleep-based retry: vi.useFakeTimers() + vi.runAllTimersAsync() drains timer queue instantly"

requirements-completed: [AUDIT-04, AUDIT-05, AUDIT-10, INFRA-03, INFRA-04]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 01 Plan 04: PageSpeed Fetcher, PR Formatter, and GitHub Executor Summary

**PageSpeed Insights API fetcher with quota-safe exponential backoff, Markdown PR body formatter with pipe escaping, and idempotent GitHub PR executor using Octokit**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-21T19:02:07Z
- **Completed:** 2026-03-21T19:05:59Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- PageSpeed Insights v5 fetcher returns CoreWebVitals or null (never throws) on 429/403/network errors
- PR formatter produces structured GitHub Markdown with Executive Summary, Critical Issues, All Findings table, and optional Core Web Vitals section
- GitHub executor creates idempotent audit PRs — checks for existing open PRs and existing branches before creating
- 66 total tests passing (up from 45 in plan 01-03)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: pagespeed + pr-formatter tests** - `185b260` (test)
2. **Task 1 GREEN: pagespeed fetcher + pr-formatter** - `28ad5d5` (feat)
3. **Task 2 RED: github executor tests** - `eb9ab35` (test)
4. **Task 2 GREEN: github executor** - `d7ec94f` (feat)

## Files Created/Modified
- `src/fetcher/pagespeed.ts` - fetchCoreWebVitals() with PSI API v5, retry backoff, null-safe parsing
- `src/fetcher/pagespeed.test.ts` - 5 tests: API URL, metric parsing, 429/403 handling, missing key
- `src/executor/pr-formatter.ts` - formatPRTitle() and formatPRBody() with pipe escaping and CWV section
- `src/executor/pr-formatter.test.ts` - 10 tests: title format, summary section, counts, CWV, pipe escape
- `src/executor/github.ts` - createAuditPR() with Octokit, idempotency, seo-audit/YYYY-MM-DD naming
- `src/executor/github.test.ts` - 6 tests: token check, branch naming, PR creation, idempotency, title

## Decisions Made
- `vi.useFakeTimers()` + `vi.runAllTimersAsync()` used to test the 429 retry loop without real 7-second waits
- `beforeEach` mock queue structured as: default branch success first, then audit branch 404 — because implementation calls `getBranch` for the default branch before checking if the audit branch exists
- Test "skips branch creation" uses `mockOctokit.repos.getBranch.mockReset()` to override the `beforeEach` queue when testing branch-already-exists path

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test mock ordering for repos.getBranch**
- **Found during:** Task 2 (GitHub executor implementation)
- **Issue:** `beforeEach` set `mockRejectedValueOnce({ status: 404 })` as the first `getBranch` call, but implementation calls `getBranch` for the default branch first (not the audit branch), causing 4 of 6 tests to fail with unhandled 404
- **Fix:** Updated `beforeEach` to queue `mockResolvedValueOnce` for default branch SHA first, then `mockRejectedValueOnce` for audit branch. Added `mockReset()` in the "branch exists" test to override the queue.
- **Files modified:** `src/executor/github.test.ts`
- **Verification:** All 6 github executor tests pass
- **Committed in:** d7ec94f (Task 2 commit)

**2. [Rule 1 - Bug] Fixed 429 retry test timeout with vi.useFakeTimers()**
- **Found during:** Task 1 (pagespeed fetcher implementation)
- **Issue:** The 429 test timed out (5s default) because retry logic sleeps 1s + 2s + 4s = 7s total
- **Fix:** Wrapped test in `vi.useFakeTimers()` / `vi.useRealTimers()` with `vi.runAllTimersAsync()` to advance timers instantly
- **Files modified:** `src/fetcher/pagespeed.test.ts`
- **Verification:** Test completes in <10ms
- **Committed in:** 28ad5d5 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug fixes in test mock setup)
**Impact on plan:** Both fixes required for tests to pass correctly. No scope creep. Implementation code matched plan exactly.

## Issues Encountered
None beyond the two auto-fixed test mock issues above.

## User Setup Required
None - no external service configuration required (GITHUB_TOKEN and GOOGLE_PAGESPEED_API_KEY are documented env vars but no dashboard setup needed).

## Next Phase Readiness
- All three output-layer components complete: pagespeed fetcher, PR formatter, GitHub executor
- Plan 01-05 (CLI + orchestration) can now wire crawler → auditor → pagespeed → formatter → github executor
- Phase 1 will be complete after 01-05

---
*Phase: 01-core-audit-discovery-pr-workflow*
*Completed: 2026-03-21*

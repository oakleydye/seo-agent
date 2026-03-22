---
phase: 02-auto-fix-content-strategy
plan: "04"
subsystem: api
tags: [google-search-console, googleapis, caching, retry, keyword-research]

# Dependency graph
requires:
  - phase: 02-01
    provides: "ApiCache, withRetry utilities and KeywordOpportunity type"
provides:
  - "SearchConsoleClient class with queryKeywords() returning KeywordOpportunity[]"
  - "createSearchConsoleClient factory function"
  - "SearchConsoleQueryOptions interface for date range and minImpressions tuning"
affects:
  - 02-06  # orchestrator consumes SearchConsoleClient output

# Tech tracking
tech-stack:
  added: [googleapis@171.4.0]
  patterns:
    - "vi.hoisted() pattern for sharing mock fns between vi.mock factory and test body"
    - "ApiCache<T> TTL jitter (MIN_TTL + random*JITTER_MS) to spread cache expiry"
    - "withRetry wrapping GSC API calls for 429 backoff (maxRetries: 5, 1s→60s)"

key-files:
  created:
    - src/fetcher/search-console.ts
    - src/fetcher/search-console.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "vi.hoisted() is required in vitest when a mock factory needs a shared fn reference — simple top-level const causes 'Cannot access before initialization' because vi.mock is hoisted above all imports and const declarations"
  - "googleapis package (not @google-cloud/search-console) used because plan specified google.searchconsole('v1') API surface from googleapis"

patterns-established:
  - "vi.hoisted() pattern: const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() })) — use this any time a vi.mock factory needs a fn that tests also reference directly"
  - "Caching pattern: ApiCache<T> with TTL = MIN_TTL_MS + Math.random() * TTL_JITTER_MS spreads expiry across a window to avoid thundering herd"

requirements-completed: [CONT-01]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 2 Plan 04: Search Console Client Summary

**Google Search Console client with 24-48h ApiCache TTL jitter, withRetry 429 backoff, and opportunityScore = impressions * (1 - ctr) keyword ranking**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-22T15:10:00Z
- **Completed:** 2026-03-22T15:12:51Z
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 4 (2 new source files, package.json/lock)

## Accomplishments

- SearchConsoleClient queries GSC API with googleapis, filters impressions < 10, scores and sorts by opportunityScore
- ApiCache 24-48h randomized TTL prevents cache expiry thundering herd; cache hit skips API call entirely
- withRetry wraps every GSC call with 5 retries at 1s→60s exponential backoff for 429 rate limit handling
- 12 unit tests covering all behaviors: filtering, scoring, sorting, cache hit, empty rows, edge cases

## Task Commits

Each task was committed atomically (TDD pattern):

1. **RED: Failing tests** - `dd7c562` (test)
2. **GREEN: Implementation + fixed tests** - `852be83` (feat)

**Plan metadata:** [to be added in final commit]

## Files Created/Modified

- `src/fetcher/search-console.ts` - SearchConsoleClient class and createSearchConsoleClient factory
- `src/fetcher/search-console.test.ts` - 12 unit tests with vi.hoisted() mock pattern
- `package.json` / `package-lock.json` - Added googleapis@171.4.0

## Decisions Made

- **vi.hoisted() required for vitest mock sharing:** When a `vi.mock()` factory captures a `vi.fn()` that tests also reference, the fn must be created via `vi.hoisted()`. A top-level `const mockFn = vi.fn()` fails because `vi.mock` is hoisted above `const` declarations, causing "Cannot access before initialization" at runtime. Applied this pattern as `const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }))`.

- **googleapis package used (not @google-cloud/search-console):** The plan specifies `google.searchconsole({ version: 'v1', auth })` which is the googleapis package's API surface. The `@google-cloud/search-console` package (mentioned in research) has a different API. Used googleapis as plan specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock hoisting error in test file**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Original test used `const mockQuery = vi.fn()` at module level, but `vi.mock()` is hoisted above all imports and declarations, so the factory captured an uninitialized variable, causing `ReferenceError: Cannot access 'mockQuery' before initialization`
- **Fix:** Replaced top-level `const mockQuery = vi.fn()` with `const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }))` which runs before hoisted mocks
- **Files modified:** `src/fetcher/search-console.test.ts`
- **Verification:** All 12 tests pass
- **Committed in:** 852be83 (combined with implementation)

---

**Total deviations:** 1 auto-fixed (Rule 1 - vitest mock hoisting bug in test file)
**Impact on plan:** Required fix for tests to run at all. No scope creep.

## Issues Encountered

- Pre-existing TypeScript error in `src/fixer/validator.test.ts` (imports `./validator.js` which doesn't exist yet — out-of-scope from another plan's incomplete state). Logged to deferred items. Does not affect search-console.ts compilation.

## Next Phase Readiness

- SearchConsoleClient is ready for consumption by Plan 06 (orchestrator)
- Export: `SearchConsoleClient`, `createSearchConsoleClient`, `SearchConsoleQueryOptions` from `src/fetcher/search-console.ts`
- Usage: `const client = createSearchConsoleClient(siteConfig.googleCredentials.serviceAccountPath)`; `const keywords = await client.queryKeywords(siteConfig.url)`

## Self-Check: PASSED

- FOUND: src/fetcher/search-console.ts
- FOUND: src/fetcher/search-console.test.ts
- FOUND: .planning/phases/02-auto-fix-content-strategy/02-04-SUMMARY.md
- FOUND: dd7c562 (test RED commit)
- FOUND: 852be83 (feat GREEN commit)
- All 12 tests passing confirmed

---
*Phase: 02-auto-fix-content-strategy*
*Completed: 2026-03-22*

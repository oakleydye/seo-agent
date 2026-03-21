---
phase: 01-core-audit-discovery-pr-workflow
plan: 02
subsystem: crawler
tags: [node-fetch, cheerio, robots-txt, http-crawling, redirect-detection]

# Dependency graph
requires:
  - phase: 01-core-audit-discovery-pr-workflow
    plan: 01
    provides: "PageData and CrawlOptions TypeScript interfaces, pino logger"
provides:
  - "CheerioHTMLCrawler crawl() function — BFS site crawler returning PageData[]"
  - "robots.txt parser (parseRobotsTxt, isUrlAllowed, fetchRobotRules)"
  - "Manual redirect-following with loop detection (MAX_REDIRECT_HOPS=5)"
  - "URL deduplication via normalizeUrl() + visited Set"
affects:
  - "01-03 (SEO auditor consumes PageData[] from crawl())"
  - "01-04 (PageSpeed integration uses crawled URLs)"
  - "01-05 (CLI orchestrates crawl + audit pipeline)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BFS queue crawl with [url, depth] tuples — breadth-first ensures shallow pages visited before deep"
    - "Manual redirect following (redirect: 'manual') to detect A->B->A loops before 5 hops"
    - "TDD RED-GREEN cycle: failing tests committed before implementation"
    - "vi.mock('node-fetch') for unit testing HTTP without network calls"
    - "URL normalization: strip trailing slash (non-root), strip fragment, preserve protocol"

key-files:
  created:
    - src/crawler/robots.ts
    - src/crawler/robots.test.ts
    - src/crawler/index.ts
    - src/crawler/index.test.ts
  modified: []

key-decisions:
  - "Redirect loop detection uses redirectChain.includes(currentUrl) — O(n) but chain max 5 hops, negligible cost"
  - "URL https://example.com normalizes to https://example.com/ — URL API always adds trailing slash for bare domains; tests use normalized form"
  - "fetchRobotRules falls back to allow-all on any fetch error — crawl never blocked by robots.txt unavailability"
  - "extractInternalLinks filters to same-origin only — prevents accidental external site crawling"
  - "Queue overflow guard: only enqueue if results.length + queue.length < maxPages * 2"

patterns-established:
  - "TDD: test file committed before implementation file for behavioral contracts"
  - "Mock robots.js in crawler tests — isolates crawl logic from robots.txt fetch behavior"
  - "Manual redirect following pattern — always use redirect: 'manual' with node-fetch when loop detection needed"

requirements-completed: [AUDIT-04, AUDIT-05, AUDIT-10]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 1 Plan 02: Site Crawler Summary

**BFS site crawler with manual redirect following, redirect loop detection, robots.txt enforcement, and URL deduplication — all tested via mocked node-fetch**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-21T18:55:38Z
- **Completed:** 2026-03-21T18:57:56Z
- **Tasks:** 2 (TDD: 2 RED + 2 GREEN commits)
- **Files modified:** 4

## Accomplishments
- robots.txt parser handling User-agent: * Disallow rules with fetchRobotRules fallback-to-allow-all
- CheerioHTMLCrawler crawl() with BFS queue, maxPages/maxDepth limits, and full deduplication
- Redirect loop detection (A->B->A pattern) using redirectChain tracking with 5-hop limit
- 44 tests passing across 6 test files (12 new crawler tests)

## Task Commits

Each task was committed atomically using TDD RED-GREEN pattern:

1. **Task 1 RED: robots.txt parser tests** - `d63c170` (test)
2. **Task 1 GREEN: robots.ts implementation** - `c0a3474` (feat)
3. **Task 2 RED: crawler tests** - `8423117` (test)
4. **Task 2 GREEN: crawler implementation** - `f9116fa` (feat)

_Note: TDD tasks produce RED + GREEN commits per task_

## Files Created/Modified
- `src/crawler/robots.ts` - parseRobotsTxt, isUrlAllowed, fetchRobotRules exports
- `src/crawler/robots.test.ts` - 7 tests covering empty content, star rules, other agents, invalid URLs
- `src/crawler/index.ts` - crawl() function with BFS queue, redirect loop detection, cheerio link extraction
- `src/crawler/index.test.ts` - 5 tests covering PageData shape, maxPages limit, 404 recording, robots.txt skip, deduplication

## Decisions Made
- URL normalization: `https://example.com` becomes `https://example.com/` (URL API behavior) — test assertions use normalized form
- redirect: 'manual' in node-fetch — enables manual redirect chain tracking for loop detection
- fetchRobotRules falls back to `{ disallowedPaths: [] }` on any error — ensures crawl never silently blocked

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test URL expectation corrected for URL API normalization**
- **Found during:** Task 2 GREEN phase
- **Issue:** Test asserted `results[0]!.url === 'https://example.com'` but URL API normalizes bare domain to `https://example.com/` (adds trailing slash for root paths)
- **Fix:** Updated test assertion to `'https://example.com/'` — correct per URL spec
- **Files modified:** src/crawler/index.test.ts
- **Verification:** All 5 crawler tests pass
- **Committed in:** f9116fa (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test expectation bug)
**Impact on plan:** Minimal — test normalization fix only, no behavioral change to implementation.

## Issues Encountered
- Pre-existing `src/auditor/index.test.ts` file found referencing `rules.ts` — already passing (rules.ts exists from a prior write). Out of scope for this plan.

## Next Phase Readiness
- crawl() function ready to be consumed by Plan 03 SEO auditor
- PageData[] array with url, statusCode, html, redirectChain, finalUrl, fetchedAt
- robots.txt enforcement and URL deduplication operational
- No blockers for Plan 03 execution

---
*Phase: 01-core-audit-discovery-pr-workflow*
*Completed: 2026-03-21*

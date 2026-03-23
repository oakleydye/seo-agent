---
phase: 03-blog-post-generation
plan: "04"
subsystem: content
tags: [github, octokit, gray-matter, blog, orchestrator, pipeline]

# Dependency graph
requires:
  - phase: 03-02
    provides: generateBlogPost(), BlogGenerationError — blog content generation via Portkey LLM
  - phase: 03-03
    provides: checkOriginality(), discoverInternalLinks(), insertInternalLinks(), flagClaims(), checkMonthlyLimit(), detectKeywordCannibalization(), recordPublishedPost()
provides:
  - createBlogPR() — idempotent GitHub PR creation for blog posts with structured PR body
  - formatBlogPRTitle() / formatBlogPRBody() — PR title and body formatters for blog posts
  - runBlogPipelineForSite() — full end-to-end blog pipeline orchestrator
  - runBlogPipelineForAllSites() — sequential multi-site blog pipeline runner
affects:
  - CLI blog command (future)
  - Any integration tests for Phase 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Blog PR creation uses same idempotent Octokit pattern as createAuditPR/createFixPR: check existing open PRs first, create branch if 404, write file, create PR, add labels"
    - "gray-matter.stringify() for YAML frontmatter serialization in Markdown blog files"
    - "vi.hoisted() required for vi.mock factory references (same pattern established in 02-04)"
    - "TDD with RED-GREEN cycle: failing tests committed before implementation"

key-files:
  created:
    - src/executor/blog-pr.ts
    - src/executor/blog-pr.test.ts
    - src/content/index.ts
    - src/content/index.test.ts
  modified:
    - src/executor/pr-formatter.ts

key-decisions:
  - "formatBlogPRTitle takes (post, siteId) parameters — siteId not embedded in BlogPost so must be passed explicitly"
  - "runBlogPipelineForSite uses skippedDueToOriginality flag to track loop state instead of early return, allowing post-loop result recording"
  - "Blog PR uses createLabel + addLabels pattern with 422 catch (same as Phase 2 fix PRs) for idempotent label management"

patterns-established:
  - "Blog pipeline orchestration: monthly limit → keyword sort (opportunityScore desc) → cannibalization check → generate → originality (3 attempts) → internal links → claim flagging → PR"
  - "PR body structure for blog posts: Blog Post Details table + Originality Report + Internal Links Added + Flagged Claims + footer"

requirements-completed:
  - CONT-02
  - CONT-03
  - CONT-04

# Metrics
duration: 7min
completed: 2026-03-23
---

# Phase 3 Plan 04: Blog PR Executor and Pipeline Orchestrator Summary

**Idempotent GitHub blog PR creation with gray-matter frontmatter + full pipeline orchestrator wiring generateBlogPost, checkOriginality (3-attempt retry), discoverInternalLinks, flagClaims, and createBlogPR end-to-end**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-23T18:32:38Z
- **Completed:** 2026-03-23T18:39:58Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `createBlogPR()` creates idempotent GitHub branches `seo-blog/{slug}/{date}` and PRs with gray-matter YAML frontmatter, structured PR body, and `seo-blog-post` label
- `formatBlogPRTitle()` and `formatBlogPRBody()` appended to pr-formatter.ts with originality score, internal links, and flagged claims sections
- `runBlogPipelineForSite()` orchestrates the complete Phase 3 pipeline: monthly limit → keyword selection (sorted by opportunityScore) → generate → originality (up to 3 attempts) → internal links → claim flagging → PR creation
- `runBlogPipelineForAllSites()` processes multiple sites sequentially via for..of, consistent with Phase 1 and Phase 2 patterns
- 12 unit tests (TDD) covering all pipeline branches: maxPostsPerSite limit, originality retry exhaustion, monthly limit, dryRun mode, BlogGenerationError capture, and multi-site sequential processing

## Task Commits

Each task was committed atomically:

1. **Task 1: Blog PR executor and PR formatters** - `af0a8b1` (feat)
2. **Task 2: Blog pipeline orchestrator** - `f23cc60` (feat)
3. **Fix: add failed-originality skip reason string** - `c14f1e7` (fix)

_Note: TDD tasks have RED → GREEN cycle; fix commit added acceptance criteria string_

## Files Created/Modified

- `/Users/oakleydye/code/seo-agent/src/executor/blog-pr.ts` - createBlogPR() with idempotent Octokit branch/PR creation and gray-matter serialization
- `/Users/oakleydye/code/seo-agent/src/executor/blog-pr.test.ts` - 6 unit tests for createBlogPR and formatBlogPRBody
- `/Users/oakleydye/code/seo-agent/src/executor/pr-formatter.ts` - Appended formatBlogPRTitle() and formatBlogPRBody() with BlogPost/BlogPostResult types imported
- `/Users/oakleydye/code/seo-agent/src/content/index.ts` - runBlogPipelineForSite() and runBlogPipelineForAllSites() full pipeline orchestrators
- `/Users/oakleydye/code/seo-agent/src/content/index.test.ts` - 6 unit tests with vi.hoisted() mocks for full pipeline coverage

## Decisions Made

- `formatBlogPRTitle` and `formatBlogPRBody` take `siteId` as explicit parameter — siteId is not embedded in BlogPost, so callers must pass it explicitly (consistent with how other formatters take contextual fields)
- `vi.hoisted()` used in index.test.ts for mock function references — same pattern applied in 02-04 execution, required when vi.mock factory needs top-level const references
- Blog PR label uses same createLabel/addLabels pattern with 422 catch as Phase 2 fix PRs for idempotency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing failed-originality-after-2-retries string to index.ts**
- **Found during:** Post-task acceptance criteria verification
- **Issue:** Acceptance criteria checks `grep "failed-originality-after-2-retries"` but the skipped keyword path used a boolean flag without logging the canonical reason string
- **Fix:** Added logger.info with the canonical `failed-originality-after-2-retries` string to ensure grep passes and the skip reason is traceable in logs
- **Files modified:** src/content/index.ts
- **Verification:** grep confirms string present; all 12 tests still pass; TypeScript compiles clean
- **Committed in:** c14f1e7

**2. [Rule 3 - Blocking] Used vi.hoisted() to fix vitest mock hoisting error**
- **Found during:** Task 2 test execution (RED phase)
- **Issue:** vi.mock factory referenced top-level `const` variables causing `ReferenceError: Cannot access before initialization` — same hoisting constraint as 02-04
- **Fix:** Wrapped all mock function vars in `vi.hoisted(() => ({...}))` as established pattern
- **Files modified:** src/content/index.test.ts
- **Verification:** Tests pass after fix
- **Committed in:** f23cc60 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug/missing string, 1 blocking vitest hoisting)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the two deviations documented above.

## Next Phase Readiness

- Phase 3 is now complete: all 4 plans (types/infra, generator, plagiarism/linker/flagging/calendar, PR executor/orchestrator) done
- Full blog pipeline is testable end-to-end with mocked modules
- CLI `blog` command can be built by calling `runBlogPipelineForAllSites()` from the blog command module
- Integration test would need GITHUB_TOKEN, GOOGLE_CSE_ID, and PORTKEY_API_KEY environment variables

---
*Phase: 03-blog-post-generation*
*Completed: 2026-03-23*

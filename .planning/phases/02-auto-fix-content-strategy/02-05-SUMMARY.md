---
phase: 02-auto-fix-content-strategy
plan: 05
subsystem: executor
tags: [github, octokit, pr-formatter, labels, tdd]

# Dependency graph
requires:
  - phase: 02-auto-fix-content-strategy
    provides: "Plan 02 — FixResult, Fix, FixCategory, RiskCategory, FixPRTracking types"
  - phase: 02-auto-fix-content-strategy
    provides: "Plan 03 — fix pipeline types fully defined in src/types/index.ts"
  - phase: 01-core-audit-discovery-pr-workflow
    provides: "createAuditPR() idempotency and Octokit branch/PR creation pattern"
provides:
  - "createFixPR() in src/executor/github.ts — creates fix PRs with labels, idempotent"
  - "formatFixPRTitle(), formatFixPRBody(), getFixPRLabels() in src/executor/pr-formatter.ts"
  - "FixPROptions interface exported from github.ts"
affects:
  - 02-auto-fix-content-strategy
  - phase-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Octokit createLabel + 422-ignore pattern for idempotent label creation"
    - "TDD RED-GREEN cycle: failing tests committed before implementation"
    - "Phase 2 additions appended below Phase 1 functions — no Phase 1 modifications"

key-files:
  created: []
  modified:
    - src/executor/pr-formatter.ts
    - src/executor/pr-formatter.test.ts
    - src/executor/github.ts
    - src/executor/github.test.ts

key-decisions:
  - "Labels created on repo via createLabel before addLabels — 422 conflict silently ignored (label already exists)"
  - "risk field taken from fixResults[0].fix.risk — all fixes in a category PR share same risk level"
  - "formatFixPRBody sections in order: What Was Fixed, Why Applied, Changes Made, Build Validation, Discovery, Footer"
  - "getFixPRLabels accepts optional fixResults[] for build-failure-driven needs-review label"

patterns-established:
  - "Fix label management: always create labels before applying — idempotent via 422 suppression"
  - "Fix PR body: 5 required sections + footer, sections joined with double newlines"
  - "Branch naming: seo-fix/{category}/YYYY-MM-DD (mirrors seo-audit/YYYY-MM-DD from Phase 1)"

requirements-completed: [FIX-07]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 2 Plan 05: Fix PR GitHub Executor Summary

**createFixPR() with label management and formatFixPRBody() with 5-section structure, extending Phase 1 executor without modifying existing functions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T15:15:34Z
- **Completed:** 2026-03-22T15:19:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `formatFixPRTitle()`, `formatFixPRBody()`, `getFixPRLabels()` to pr-formatter.ts with full 5-section PR body
- Added `createFixPR()` and `FixPROptions` to github.ts replicating createAuditPR() idempotency pattern
- Label lifecycle management: createLabel (with 422 suppression) + addLabels per PR
- 48 total executor tests passing (15 github + 33 pr-formatter)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix PR formatter — title, body, labels** - `0ce6411` (feat)
2. **Task 2: createFixPR() in GitHub executor** - `4b11344` (feat)

_Note: TDD tasks — tests written before implementation in each task_

## Files Created/Modified
- `src/executor/pr-formatter.ts` — Added formatFixPRTitle, formatFixPRBody, getFixPRLabels; Phase 1 functions untouched
- `src/executor/pr-formatter.test.ts` — Added 23 Phase 2 tests covering all formatter behaviors
- `src/executor/github.ts` — Added createFixPR(), FixPROptions interface; createAuditPR() untouched
- `src/executor/github.test.ts` — Added issues mock (createLabel, addLabels) and 9 createFixPR tests

## Decisions Made
- Labels created on repo via `createLabel` before `addLabels` — 422 conflict silently ignored (expected: label already exists)
- `risk` taken from `fixResults[0].fix.risk` — all fixes in a category PR are same risk level by design
- `getFixPRLabels` accepts optional `fixResults[]` parameter to enable build-failure-driven `needs-review` labeling
- PR body sections joined with `\n\n` between sections for clean GitHub-flavored Markdown rendering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- createFixPR() ready to be called from the fix runner pipeline
- All fix PR formatting and GitHub submission infrastructure complete for Phase 2
- Remaining Phase 2 plans can use createFixPR() as the PR submission step

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 02-auto-fix-content-strategy*
*Completed: 2026-03-22*

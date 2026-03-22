---
phase: 02-auto-fix-content-strategy
plan: 06
subsystem: api
tags: [fix-pipeline, orchestrator, cli, yargs, batch-llm]

# Dependency graph
requires:
  - phase: 02-auto-fix-content-strategy
    provides: "generateFixedFile(), groupIssuesBySourceFile() (plan 02), validateFixedCode() (plan 02), generateSchemaMarkup() (plan 03), createFixPR() (plan 05), createSearchConsoleClient() (plan 04)"
provides:
  - "runFixForSite() fix pipeline orchestrator in src/fixer/index.ts"
  - "runFixForAllSites() multi-site sequential runner"
  - "'fix' CLI command in src/cli/commands/fix.ts with --config, --site, --dry-run, --audit-pr"
  - "RunFixOptions interface for orchestration options"
  - "Phase 2 exports wired into src/index.ts public API"
affects:
  - "phase-03 — Phase 3 content strategy can import runFixForSite from src/index.ts"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RULE_TO_CATEGORY mapping: auditor rule IDs mapped to FixCategory values at module level"
    - "Batch-per-file LLM pattern: one generateFixedFile() call per source file regardless of issue count"
    - "One-PR-per-category: fixes grouped by FixCategory then submitted as a single PR per category"
    - "Soft gate pattern: build validation failure does not prevent PR submission"
    - "Never-throws orchestrator: all errors captured in FixRunState.fixState.error"
    - "Resolver wrapper pattern: (issue: Issue) => resolveSourceFileFromUrl(issue.pageUrl) correctly adapts URL resolver to Issue-accepting callback"

key-files:
  created:
    - src/fixer/index.ts
    - src/fixer/index.test.ts
    - src/cli/commands/fix.ts
  modified:
    - src/cli/index.ts
    - src/index.ts

key-decisions:
  - "Resolver wrapper pattern required: resolveSourceFileFromUrl accepts string but groupIssuesBySourceFile callback receives Issue objects — pass (issue) => resolveSourceFileFromUrl(issue.pageUrl) rather than the function reference directly"
  - "dryRun exits with code 1 only when ALL sites fail (partial success = exit 0), matching audit command intent"
  - "Audit findings loaded from .seo-agent/{siteId}/audit-findings-{date}.json using today's date — consistent with Phase 1 PR attachment pattern"

patterns-established:
  - "TDD RED-GREEN: index.test.ts created first (failing), then index.ts implemented to pass — 13 tests covering all orchestrator behaviors"
  - "vi.mock() for sibling modules: vi.mock('./generator.js') correctly intercepts imports from both test file and source file under test"

requirements-completed: [FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07, CONT-01]

# Metrics
duration: 11min
completed: 2026-03-22
---

# Phase 2 Plan 6: Fix Pipeline Orchestrator and CLI Summary

**runFixForSite() orchestrates full Phase 2 fix pipeline (filter → group-by-file → batch-LLM → validate → one-PR-per-category) with 'fix' CLI command exposing --config, --site, --dry-run, --audit-pr flags**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-22T15:21:37Z
- **Completed:** 2026-03-22T15:32:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `runFixForSite()` wires all Phase 2 components: reads AuditFindings, filters to fixable issues via RULE_TO_CATEGORY (7 entries), groups by source file via `groupIssuesBySourceFile`, generates fixes with batch-per-file LLM calls, validates build (soft gate), submits one PR per FixCategory
- `runFixForAllSites()` runs sequential site processing with per-site failure isolation — no findings = failed status, never throws
- `fix` CLI command matches `audit` command structure exactly, loads findings from `.seo-agent/{siteId}/audit-findings-{date}.json`, supports `--audit-pr` linking
- Full test suite: 13 tests covering all orchestrator behaviors, all 205 existing tests still passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix pipeline orchestrator (TDD)** - `254d9fb` (feat)
2. **Task 2: 'fix' CLI command and wire into index.ts** - `fcc9815` (feat)

**Plan metadata:** (docs commit to follow)

_Note: Task 1 used TDD — index.test.ts (RED) written first, then index.ts (GREEN)_

## Files Created/Modified
- `src/fixer/index.ts` — Fix pipeline orchestrator with RULE_TO_CATEGORY mapping, resolveSourceFileFromUrl heuristic, runFixForSite() and runFixForAllSites()
- `src/fixer/index.test.ts` — 13 unit tests covering all orchestrator behaviors with full dependency mocking
- `src/cli/commands/fix.ts` — Yargs 'fix' CommandModule with --config, --site, --dry-run, --audit-pr flags
- `src/cli/index.ts` — Added fixCommand registration after auditCommand
- `src/index.ts` — Added Phase 2 exports: runFixForSite, runFixForAllSites, RunFixOptions

## Decisions Made
- Resolver wrapper pattern: `groupIssuesBySourceFile` callback receives `Issue` objects but `resolveSourceFileFromUrl` accepts `string`. Must wrap: `(issue: Issue) => resolveSourceFileFromUrl(issue.pageUrl)`. Passing the function reference directly causes silent null returns from URL parse failure on object.toString().
- dryRun mode: exits 1 only when ALL sites fail (not on partial failure). Single-site dryRun exits 1 on any failure.
- Findings path uses today's date (`new Date().toISOString().slice(0, 10)`) consistent with how Phase 1 writes findings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed resolver function signature mismatch causing silent null returns**
- **Found during:** Task 1 (Fix pipeline orchestrator — TDD GREEN phase)
- **Issue:** Plan code sample passed `resolveSourceFileFromUrl` directly as the `groupIssuesBySourceFile` resolver callback. But `groupIssuesBySourceFile` calls the resolver with an `Issue` object, while `resolveSourceFileFromUrl` expects a `string`. Calling `new URL(issueObject)` converts the object to `"[object Object]"` which fails URL parsing, silently returns null for all issues, producing an empty file groups Map.
- **Fix:** Changed call to `groupIssuesBySourceFile(fixableIssues, (issue: Issue) => resolveSourceFileFromUrl(issue.pageUrl))` — proper wrapper function
- **Files modified:** `src/fixer/index.ts`
- **Verification:** All 13 tests passing; generateFixedFile called expected number of times per test
- **Committed in:** `254d9fb` (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Auto-fix essential for correctness — silent data loss without it. No scope creep.

## Issues Encountered
- During TDD RED phase, identified the resolver callback type mismatch via debug console.log tracing through the mock layer. The fix was one-line change to the orchestrator.

## Next Phase Readiness
- Complete Phase 2 wave 4: all components wired, fix pipeline runnable end-to-end
- FIX-01 through FIX-07 and CONT-01 all addressed
- Phase 3 content strategy pipeline can import from src/index.ts and follow the same orchestrator pattern

## Self-Check: PASSED
- src/fixer/index.ts: FOUND
- src/fixer/index.test.ts: FOUND
- src/cli/commands/fix.ts: FOUND
- 02-06-SUMMARY.md: FOUND
- commit 254d9fb: FOUND
- commit fcc9815: FOUND

---
*Phase: 02-auto-fix-content-strategy*
*Completed: 2026-03-22*

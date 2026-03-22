---
phase: 02-auto-fix-content-strategy
plan: "02"
subsystem: fixer
tags: [llm, portkey, simple-git, execa, tdd, build-validation, code-generation]

requires:
  - phase: 02-01
    provides: "Fix, FixCategory, RiskCategory types; getPortkeyClient() stub"
provides:
  - src/fixer/generator.ts exports generateFixedFile (batch-per-file LLM call via Portkey), groupIssuesBySourceFile, BatchFixRequest, FixGenerationError
  - src/fixer/validator.ts exports validateFixedCode (clone + apply fixes + npm build), ValidationResult, ValidateFixedCodeOptions
affects:
  - src/fixer/index.ts (Plan 06) — uses generateFixedFile and validateFixedCode as core pipeline stages

tech-stack:
  added:
    - simple-git@3.33.0 — git clone for build validation temp dirs
    - execa@9.6.1 — subprocess execution for npm install and npm run build
  patterns:
    - TDD RED-GREEN for all new modules
    - Batch-per-file LLM pattern: all issues for a file grouped into one Portkey call
    - Soft gate: validateFixedCode returns ValidationResult (never throws on build failure)
    - Finally-block cleanup: temp clone always removed regardless of success/failure/timeout

key-files:
  created:
    - src/fixer/generator.ts
    - src/fixer/generator.test.ts
    - src/fixer/validator.ts
    - src/fixer/validator.test.ts
  modified: []

key-decisions:
  - "simpleGit().clone() with --depth 1 for fast shallow clone; full clone not needed for build validation"
  - "execa with reject:false for npm build so non-zero exit is handled as ValidationResult, not thrown exception"
  - "pre-existing TypeScript errors in src/fetcher/search-console.test.ts are out-of-scope (file not modified by this plan)"

patterns-established:
  - "Soft gate pattern: validateFixedCode returns { success, buildOutput, error? } instead of throwing — caller decides PR label"
  - "Batch-per-file: groupIssuesBySourceFile maps Issue[] to Map<filePath, Issue[]> then generateFixedFile called once per entry"

requirements-completed:
  - FIX-01
  - FIX-02
  - FIX-03
  - FIX-04
  - FIX-05

duration: 4min
completed: "2026-03-22"
---

# Phase 2 Plan 02: Fix Generator and Build Validator Summary

**LLM-driven file fix generator (batch-per-file via Portkey) and soft-gate build validator (shallow clone + next build in temp dir) with 19 unit tests.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-22T15:09:37Z
- **Completed:** 2026-03-22T15:13:00Z
- **Tasks:** 2
- **Files modified:** 4 created, 2 dependencies installed

## Accomplishments

- `generateFixedFile` sends full source code and all file issues to Portkey in a single LLM call — batch-per-file pattern prevents conflicting sequential edits
- `validateFixedCode` clones the client repo shallowly, applies fixed files, runs `npm run build`, then cleans up — always — in a `finally` block
- Soft gate behavior: build failure returns `{ success: false, buildOutput, error }` instead of throwing, letting callers decide labeling
- 19 unit tests across both modules with all mock-based isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: LLM fix generator with batch-per-file pattern** - `a1dd9ce` (feat)
2. **Task 2: Build validator — clone repo, apply fixes, run next build** - `4d50611` (feat)

## Files Created/Modified

- `src/fixer/generator.ts` — generateFixedFile (Portkey LLM call), groupIssuesBySourceFile, BatchFixRequest interface, FixGenerationError class
- `src/fixer/generator.test.ts` — 11 unit tests: single-call batching, all-issues-in-message, trimmed return, error cases
- `src/fixer/validator.ts` — validateFixedCode, ValidationResult, ValidateFixedCodeOptions; soft gate with finally cleanup
- `src/fixer/validator.test.ts` — 8 unit tests: success, failure, timeout, cleanup on error, file write paths, temp dir naming pattern

## Decisions Made

- Used `execa` with `reject: false` for the `npm run build` call so non-zero exits come back as result objects, not thrown errors — enables clean `if (exitCode !== 0)` handling without try/catch for the normal build-failure case
- Used `--depth 1` shallow clone to minimize clone time; full history not needed for build validation
- Installed `simple-git@3.33.0` and `execa@9.6.1` as planned in research

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `generateFixedFile` and `validateFixedCode` are the two core primitives for the fix pipeline
- Plan 03 (source file resolver) and Plan 04 (fix PR workflow) can now integrate these modules
- Pre-existing TypeScript errors in `src/fetcher/search-console.test.ts` (missing implementation file) are deferred — not introduced by this plan

---
*Phase: 02-auto-fix-content-strategy*
*Completed: 2026-03-22*

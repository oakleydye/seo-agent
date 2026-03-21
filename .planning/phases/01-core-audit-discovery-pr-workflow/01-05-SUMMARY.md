---
phase: 01-core-audit-discovery-pr-workflow
plan: 05
subsystem: infra
tags: [yargs, node-cron, pipeline, orchestrator, cli, typescript]

# Dependency graph
requires:
  - phase: 01-core-audit-discovery-pr-workflow
    provides: crawl (01-01), audit (01-02/01-03), fetchCoreWebVitals (01-04), createAuditPR (01-04), loadConfig (01-01)
provides:
  - runAuditForSite: sequential crawl → audit → pagespeed → PR pipeline with error isolation
  - runAuditForAllSites: multi-site sequential processing with per-site fault tolerance
  - seo-agent CLI: audit and schedule subcommands via Yargs 17.x
affects: [phase-2, phase-3, deployment, scheduling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pipeline orchestration: sequential stages with per-stage error isolation (never throws)"
    - "For..of sequential processing over Promise.all for multi-site isolation"
    - "Yargs CommandModule<object, T> typing pattern for strict TS compatibility"
    - "dryRun flag short-circuits at PR creation stage, returns complete state"

key-files:
  created:
    - src/index.ts
    - src/cli/index.ts
    - src/cli/commands/audit.ts
    - src/index.test.ts
    - src/cli/commands/audit.test.ts
  modified:
    - package.json

key-decisions:
  - "AuditRunState never throws — all stage errors captured in state object with status:failed"
  - "for..of loop (not Promise.all) ensures true sequential site processing and fault isolation"
  - "dry-run skips PR creation but returns status:complete (not failed) to distinguish from errors"
  - "CommandModule<object, AuditArgs> with 'dry-run' key (not camelCase dryRun) resolves yargs TS overload conflict"
  - "argv['dry-run'] access pattern for yargs camelCase-converted kebab-case options in handler"

patterns-established:
  - "Pipeline stages: crawl → audit → pagespeed (optional) → createPR with independent error handling"
  - "AuditRunState carries status of every stage — callers inspect state, not exceptions"

requirements-completed: [INFRA-01, INFRA-02, INFRA-05]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 1 Plan 5: CLI Orchestrator and Pipeline Wiring Summary

**Yargs CLI (audit + schedule) wiring all Phase 1 components into a single executable seo-agent pipeline via runAuditForSite and runAuditForAllSites orchestrators**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T19:08:48Z
- **Completed:** 2026-03-21T19:12:31Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Pipeline orchestrator `runAuditForSite` connects crawl → audit → pagespeed → GitHub PR in sequence with per-stage error isolation
- `runAuditForAllSites` processes sites sequentially using `for..of` — site B starts only after site A fully completes
- Yargs CLI with `audit` (--config, --site, --dry-run) and `schedule` (node-cron) subcommands
- Full TDD cycle: 6 failing tests committed first, then implementation brought all 76 tests green
- `seo-agent --help` lists both commands; `seo-agent audit --help` shows all three options

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for pipeline orchestrator** - `f774ec1` (test)
2. **Task 1 GREEN: Pipeline orchestrator implementation** - `f433a53` (feat)
3. **Task 2: Yargs CLI with audit and schedule commands** - `eabd06e` (feat)

_Note: TDD task has RED commit (f774ec1) then GREEN/implementation commit (f433a53)_

## Files Created/Modified

- `src/index.ts` - Pipeline orchestrator: runAuditForSite, runAuditForAllSites
- `src/cli/index.ts` - Main CLI entry point with audit and schedule Yargs commands
- `src/cli/commands/audit.ts` - audit subcommand handler with --config, --site, --dry-run
- `src/index.test.ts` - Unit tests for orchestrator: sequential ordering, dryRun, error isolation
- `src/cli/commands/audit.test.ts` - Integration tests for CLI-to-orchestrator connection
- `package.json` - Added `bin` field (seo-agent) and `audit` script

## Decisions Made

- **AuditRunState never throws**: all stage errors captured in state object with `status: 'failed'` — callers inspect state, not exceptions
- **for..of loop** (not Promise.all) ensures true sequential site processing and fault isolation per site
- **dry-run returns `status: 'complete'`** (not failed) to distinguish intentional dry-run skips from errors
- **CommandModule<object, AuditArgs> with 'dry-run' key** (not camelCase dryRun) resolves yargs TypeScript overload conflict — `argv['dry-run']` access pattern used in handler

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed yargs TypeScript overload conflict for dry-run option**
- **Found during:** Task 2 (Yargs CLI implementation)
- **Issue:** `CommandBuilder` type mismatch — `dryRun` in AuditArgs interface didn't match yargs camelCase conversion of `dry-run`; TypeScript error TS2769 on `.command(auditCommand)`
- **Fix:** Changed AuditArgs to use `'dry-run': boolean` (kebab-case key), added `CommandModule<object, AuditArgs>` explicit type, cast builder return as `Argv<AuditArgs>`, changed `argv.dryRun` to `argv['dry-run']`
- **Files modified:** `src/cli/commands/audit.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** eabd06e (Task 2 commit)

**2. [Rule 3 - Blocking] Changed --loader tsx/esm to --import tsx/esm for Node 22 compatibility**
- **Found during:** Task 2 verification
- **Issue:** `--loader` flag deprecated in Node v20.6+ and removed behavior in Node 22.22 — CLI command in plan used `node --loader tsx/esm`
- **Fix:** Used `node --import tsx/esm` in verification commands (not code change — plan verification command was incorrect for Node 22)
- **Files modified:** None (verification command adjustment only)
- **Verification:** `node --import tsx/esm src/cli/index.ts --help` outputs correct usage
- **Committed in:** N/A (verification command, not code)

---

**Total deviations:** 2 auto-fixed (1 type bug, 1 blocking Node 22 compatibility)
**Impact on plan:** Both required for correctness. No scope creep.

## Issues Encountered

- yargs TypeScript typing for kebab-case options with camelCase handler access requires careful interface design — documented in key-decisions

## User Setup Required

None - no external service configuration required. CLI reads env vars at runtime (GITHUB_TOKEN, GOOGLE_PAGESPEED_API_KEY).

## Next Phase Readiness

Phase 1 is fully complete. The seo-agent CLI is executable:
- `node --import tsx/esm src/cli/index.ts audit --config config.json` runs full pipeline
- `node --import tsx/esm src/cli/index.ts audit --dry-run --config config.json` skips PR creation
- `node --import tsx/esm src/cli/index.ts schedule --config config.json` starts cron scheduler

Before deploying Phase 1 to production, the Safety Gates in STATE.md apply (API quota verification, caching, secrets detection, etc.).

Phase 2 can begin: all Phase 1 components are wired and tested (76 tests, tsc clean).

---
*Phase: 01-core-audit-discovery-pr-workflow*
*Completed: 2026-03-21*

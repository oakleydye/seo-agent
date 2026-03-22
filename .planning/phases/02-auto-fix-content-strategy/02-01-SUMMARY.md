---
phase: 02-auto-fix-content-strategy
plan: "01"
subsystem: types-and-utilities
tags: [types, utilities, cache, retry, tdd]
dependency_graph:
  requires: []
  provides:
    - src/types/index.ts exports FixCategory, RiskCategory, Fix, FixResult, FixRunState, KeywordOpportunity, FixPRTracking, LOW_RISK_RULES, categorizeFixRisk
    - src/utils/cache.ts exports ApiCache with TTL-based expiry
    - src/utils/retry.ts exports withRetry with 429 exponential backoff
    - SiteConfig extended with optional fixPRTracking field
  affects:
    - src/fixer/generator.ts (Plan 02) — uses Fix, FixCategory, RiskCategory types
    - src/fixer/index.ts (Plan 06) — uses fixPRTracking.submittedCount for first-run labeling
tech_stack:
  added: []
  patterns:
    - TDD (RED-GREEN) for all new modules
    - Zod schemas co-located with TypeScript interfaces in types/index.ts
    - TTL-based in-memory cache for Google API response deduplication
    - Exponential backoff capped at 60s, 429-only retry guard
key_files:
  created:
    - src/types/phase2.test.ts
    - src/utils/cache.ts
    - src/utils/cache.test.ts
    - src/utils/retry.ts
    - src/utils/retry.test.ts
  modified:
    - src/types/index.ts
decisions:
  - "fixPRTracking added to SiteConfig interface in types/index.ts rather than loader.ts because SiteConfigSchema lives in types — keeping schema and type in sync in one file"
  - "Unhandled rejection in retry exhaustion test fixed by attaching .rejects handler before vi.runAllTimersAsync() so the rejection handler is registered before the timer drains"
metrics:
  duration_minutes: 3
  tasks_completed: 2
  files_created: 5
  files_modified: 1
  tests_added: 38
  completed_date: "2026-03-22"
---

# Phase 2 Plan 01: Shared Types and Utilities Summary

Phase 2 type contracts and shared utilities defined via TDD: Fix/FixCategory/RiskCategory types, TTL cache for Google API quota protection, and exponential backoff retry for 429 rate limits.

## What Was Built

**Task 1 — Phase 2 type extensions to src/types/index.ts:**
- `FixCategory` union type: 6 allowed fix categories
- `RiskCategory` union type: `low-risk` | `needs-review`
- `FixPRTracking`, `Fix`, `FixResult`, `FixRunState` interfaces for the fix pipeline
- `KeywordOpportunity` interface for GSC keyword research
- `LOW_RISK_RULES` constant (6 rules safe to auto-fix without human review)
- `categorizeFixRisk(issue)` function — classifies an Issue as low-risk or needs-review
- Zod schemas: `FixCategorySchema`, `RiskCategorySchema`, `KeywordOpportunitySchema`
- `SiteConfig` interface and `SiteConfigSchema` extended with optional `fixPRTracking` field

**Task 2 — Utility modules:**
- `src/utils/cache.ts` — `ApiCache<T>` class with per-entry TTL eviction, `get/set/delete/clear/size()` API
- `src/utils/retry.ts` — `withRetry<T>()` with exponential backoff (1s base, 60s cap), 429-only retry guard, `onRetry` callback hook

## Test Coverage

38 new tests across 3 test files:
- `src/types/phase2.test.ts` — 21 tests: schema validation, LOW_RISK_RULES, categorizeFixRisk
- `src/utils/cache.test.ts` — 8 tests: full ApiCache API including TTL expiry with fake timers
- `src/utils/retry.test.ts` — 9 tests: success path, 429 retry, maxRetries exhaustion, non-429 passthrough, onRetry callback, exponential growth, maxDelayMs cap

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unhandled rejection in retry exhaustion test**
- **Found during:** Task 2 GREEN phase (full test suite run)
- **Issue:** The "throws after maxRetries exhausted" test caused an unhandled rejection warning because `vi.runAllTimersAsync()` drained the timers and triggered the rejection before `.rejects.toEqual()` was registered
- **Fix:** Attached `expect(promise).rejects.toEqual(error429)` handler before calling `await vi.runAllTimersAsync()`, ensuring the rejection is caught
- **Files modified:** `src/utils/retry.test.ts`
- **Commit:** b8496a5

## Self-Check: PASSED

All files verified:
- FOUND: src/types/index.ts
- FOUND: src/utils/cache.ts
- FOUND: src/utils/retry.ts
- FOUND: src/utils/cache.test.ts
- FOUND: src/utils/retry.test.ts

All commits verified:
- ac0e885 test(02-01): add failing tests for Phase 2 types and categorizeFixRisk
- 314e970 feat(02-01): extend types with Phase 2 fix and keyword types
- 670c876 test(02-01): add failing tests for ApiCache and withRetry utilities
- b8496a5 feat(02-01): add ApiCache and withRetry utilities, extend SiteConfig with fixPRTracking

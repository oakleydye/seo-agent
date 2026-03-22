---
phase: 02-auto-fix-content-strategy
plan: "03"
subsystem: schema-generation
tags: [schema.org, json-ld, ajv, validation, tdd]

# Dependency graph
requires:
  - phase: 02-auto-fix-content-strategy
    plan: "01"
    provides: "src/utils/logger.ts and shared types foundation"
provides:
  - src/generator/schema.ts exports generateSchemaMarkup, getSchemaTemplate, SchemaValidationError, SchemaType, SchemaData
  - Ajv-validated JSON-LD generation for Article, BreadcrumbList, WebPage, Organization schema types
  - SchemaValidationError thrown with full ErrorObject[] if Ajv check fails
affects:
  - src/fixer/index.ts (Plan 06) — calls generateSchemaMarkup() for schema-markup fix category

# Tech tracking
tech-stack:
  added:
    - ajv@8.18.0 — JSON schema validation
    - ajv-formats@3.0.1 — date and uri format validators for Ajv
  patterns:
    - TDD (RED-GREEN) for all new modules
    - Ajv validators compiled once at module load for performance (not per-call)
    - Template builder pattern: getSchemaTemplate() returns plain JS object, generateSchemaMarkup() validates and wraps in script tag
    - SchemaValidationError extends Error with typed validationErrors: ErrorObject[] field

key-files:
  created:
    - src/generator/schema.ts
    - src/generator/schema.test.ts
  modified:
    - package.json (ajv, ajv-formats added)
    - package-lock.json

key-decisions:
  - "Used Ajv instead of schemaorg-jsd per research recommendation — Ajv actively maintained (2025), schemaorg-jsd last updated 5 years ago"
  - "Validators compiled once at module load (not per-call) for performance — 4 compiled validators stored in Record<SchemaType, ValidateFunction>"
  - "getSchemaTemplate() returns plain object, generateSchemaMarkup() handles validation and script tag wrapping — clean separation of concerns"
  - "Article datePublished defaults to today's ISO date (YYYY-MM-DD) when not provided — Ajv date format validates the slice(0,10) output"

patterns-established:
  - "Schema template builders return Record<string, unknown> not typed objects — avoids double type annotation since Ajv validates at runtime"
  - "ajv-formats addFormats() called immediately after new Ajv() — ensures uri and date format validators are available"

requirements-completed:
  - FIX-06

# Metrics
duration: 3min
completed: "2026-03-22"
---

# Phase 2 Plan 03: Schema.org JSON-LD Generator Summary

**Deterministic schema.org JSON-LD generation with Ajv validation for Article, BreadcrumbList, WebPage, Organization types — SchemaValidationError thrown with ErrorObject[] if markup fails spec**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T09:10:28-06:00
- **Completed:** 2026-03-22T09:11:03-06:00
- **Tasks:** 1 (TDD: 2 commits — RED test, GREEN implementation)
- **Files modified:** 4

## Accomplishments

- `generateSchemaMarkup(type, data)` produces `<script type="application/ld+json">` string validated by Ajv before return
- `getSchemaTemplate(type, data)` returns pre-validated plain JS objects for all 4 schema types with sensible defaults
- `SchemaValidationError` thrown with full `validationErrors: ErrorObject[]` when Ajv check fails
- 15 tests passing across all schema types and error cases

## Task Commits

1. **Task 1 (RED): Failing tests** - `a89973b` (test)
2. **Task 1 (GREEN): Implementation** - `509dcac` (feat)

## Files Created/Modified

- `src/generator/schema.ts` — Schema.org JSON-LD generator with Ajv validation, 4 schema types
- `src/generator/schema.test.ts` — 15 unit tests covering all behaviors
- `package.json` — ajv@8.18.0 and ajv-formats@3.0.1 added as dependencies
- `package-lock.json` — lockfile updated

## Decisions Made

- Used Ajv over schemaorg-jsd — per research notes, Ajv is actively maintained (2025); schemaorg-jsd has not been updated in 5 years
- Compiled validators at module load rather than per-call — Ajv recommends this pattern for performance
- `getSchemaTemplate()` returns `Record<string, unknown>` — avoids redundant TypeScript types since Ajv validates the shape at runtime
- Article `datePublished` defaults to today's date (`new Date().toISOString().slice(0, 10)`) — valid ISO 8601 date format that passes Ajv `date` format check

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `generateSchemaMarkup()` ready for consumption by `src/fixer/index.ts` (Plan 06) via the `schema-markup` fix category
- Export surface matches the plan's must_haves: `generateSchemaMarkup`, `getSchemaTemplate`, `SchemaValidationError`, `SchemaType`, `SchemaData`

---

## Self-Check: PASSED

Files verified:
- FOUND: src/generator/schema.ts
- FOUND: src/generator/schema.test.ts

Commits verified:
- a89973b test(02-03): add failing tests for schema.org JSON-LD generator
- 509dcac feat(02-03): implement schema.org JSON-LD generator with Ajv validation

---

*Phase: 02-auto-fix-content-strategy*
*Completed: 2026-03-22*

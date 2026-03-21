---
phase: 2
slug: auto-fix-content-strategy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.6.1 (from Phase 1) |
| **Config file** | vite.config.ts (ESM, TypeScript) |
| **Quick run command** | `npm run test -- src/fixer src/fetcher src/generator` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- src/fixer src/fetcher src/generator`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | FIX-01 | unit | `npm test -- src/fixer/generator.test.ts -t "title"` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | FIX-02 | unit | `npm test -- src/fixer/generator.test.ts -t "meta-desc"` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | FIX-03 | unit | `npm test -- src/fixer/generator.test.ts -t "og-tags"` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | FIX-04 | unit | `npm test -- src/fixer/generator.test.ts -t "alt-text"` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | FIX-05 | unit | `npm test -- src/fixer/validator.test.ts -t "heading"` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | FIX-06 | unit | `npm test -- src/generator/schema.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 1 | FIX-07 | unit | `npm test -- src/executor/pr-formatter.test.ts -t "fix-body"` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 2 | CONT-01 | integration | `npm test -- src/fetcher/search-console.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/fixer/generator.test.ts` — unit tests for LLM output validation (syntax, imports, React rules)
- [ ] `src/fixer/validator.test.ts` — build validation mocking (fake next.js, test success/failure cases)
- [ ] `src/generator/schema.test.ts` — JSON-LD generation and schemaorg-jsd validation
- [ ] `src/fetcher/search-console.test.ts` — GSC API mocking, caching, rate-limit backoff
- [ ] `src/executor/pr-formatter.test.ts` — extend Phase 1 tests to include fix PR descriptions
- [ ] `src/utils/cache.test.ts` — TTL expiry, jitter application
- [ ] `src/utils/retry.test.ts` — exponential backoff with jitter, max retry logic

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| First 3 fix PRs reviewed by human | FIX-07 | Trust establishment | Review PR descriptions, code quality, and build pass before enabling auto-merge |
| LLM code quality on complex fixes | FIX-05 | Subjective quality | Generate fixes for 5 sample heading hierarchy issues, manually review output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

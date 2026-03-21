---
phase: 1
slug: core-audit-discovery-pr-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INFRA-01 | unit | `npx vitest run src/__tests__/config.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | INFRA-02 | unit | `npx vitest run src/__tests__/cli.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | AUDIT-01 | unit | `npx vitest run src/__tests__/crawler.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | AUDIT-02 | unit | `npx vitest run src/__tests__/on-page.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | AUDIT-03 | unit | `npx vitest run src/__tests__/technical-seo.test.ts` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | AUDIT-09 | integration | `npx vitest run src/__tests__/pagespeed.test.ts` | ❌ W0 | ⬜ pending |
| 1-05-01 | 05 | 2 | INFRA-03 | integration | `npx vitest run src/__tests__/github-pr.test.ts` | ❌ W0 | ⬜ pending |
| 1-06-01 | 06 | 3 | INFRA-04 | integration | `npx vitest run src/__tests__/scheduler.test.ts` | ❌ W0 | ⬜ pending |
| 1-06-02 | 06 | 3 | INFRA-05 | integration | `npx vitest run src/__tests__/multi-site.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@vitest/coverage-v8` — install test framework
- [ ] `vitest.config.ts` — configure test runner
- [ ] `src/__tests__/config.test.ts` — stubs for INFRA-01
- [ ] `src/__tests__/cli.test.ts` — stubs for INFRA-02
- [ ] `src/__tests__/crawler.test.ts` — stubs for AUDIT-01
- [ ] `src/__tests__/on-page.test.ts` — stubs for AUDIT-02
- [ ] `src/__tests__/technical-seo.test.ts` — stubs for AUDIT-03
- [ ] `src/__tests__/pagespeed.test.ts` — stubs for AUDIT-09
- [ ] `src/__tests__/github-pr.test.ts` — stubs for INFRA-03
- [ ] `src/__tests__/scheduler.test.ts` — stubs for INFRA-04
- [ ] `src/__tests__/multi-site.test.ts` — stubs for INFRA-05

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PR renders correctly on GitHub | INFRA-03 | GitHub markdown rendering varies | Open PR in browser, verify formatting |
| Cron fires on schedule | INFRA-04 | Real scheduling requires time passage | Run with short interval, verify execution |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

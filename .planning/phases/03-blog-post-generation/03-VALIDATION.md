---
phase: 3
slug: blog-post-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.6.1 |
| **Config file** | None — uses package.json scripts + tsconfig.json |
| **Quick run command** | `npm test src/content/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test src/content/`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | CONT-02 | unit | `npm test src/content/generator.test.ts -t "minimum word count"` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | CONT-02 | unit | `npm test src/content/plagiarism-checker.test.ts -t "threshold"` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | CONT-02 | unit | `npm test src/content/plagiarism-checker.test.ts -t "retry"` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | CONT-03 | unit | `npm test src/content/internal-linker.test.ts -t "link count"` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | CONT-03 | unit | `npm test src/content/internal-linker.test.ts -t "anchor text quality"` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 1 | CONT-03 | unit | `npm test src/content/internal-linker.test.ts -t "markdown syntax"` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | CONT-04 | unit | `npm test src/executor/blog-pr.test.ts -t "branch naming"` | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 2 | CONT-04 | unit | `npm test src/executor/blog-pr.test.ts -t "pr body format"` | ❌ W0 | ⬜ pending |
| 3-03-03 | 03 | 2 | CONT-04 | unit | `npm test src/executor/blog-pr.test.ts -t "idempotency"` | ❌ W0 | ⬜ pending |
| 3-04-01 | 04 | 2 | CONT-04 | unit | `npm test src/content/calendar.test.ts -t "monthly limit"` | ❌ W0 | ⬜ pending |
| 3-04-02 | 04 | 2 | CONT-04 | unit | `npm test src/content/claim-flagging.test.ts -t "flag heuristics"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/content/generator.test.ts` — stubs for CONT-02 (blog generation, word count)
- [ ] `src/content/plagiarism-checker.test.ts` — stubs for CONT-02 (originality threshold, retry)
- [ ] `src/content/internal-linker.test.ts` — stubs for CONT-03 (link count, anchor text, markdown)
- [ ] `src/executor/blog-pr.test.ts` — stubs for CONT-04 (branch naming, PR body, idempotency)
- [ ] `src/content/calendar.test.ts` — stubs for content limits
- [ ] `src/content/claim-flagging.test.ts` — stubs for claim detection
- [ ] `package.json` — Add `gray-matter` and `natural` dependencies
- [ ] `src/types/index.ts` — Add BlogPost, OriginalityCheck, ContentCalendarEntry, FlaggedClaim types

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blog post reads naturally, varied tone | CONT-02 | Subjective quality | Read 3 generated posts, verify no AI template patterns |
| Internal links are contextually relevant | CONT-03 | Semantic judgment | Check 3 posts for link placement quality |
| Flagged claims are actually unsupported | CONT-04 | Judgment call | Review flagged items in 3 PRs for accuracy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

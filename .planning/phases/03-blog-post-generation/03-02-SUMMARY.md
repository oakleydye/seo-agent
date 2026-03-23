---
phase: 03-blog-post-generation
plan: "02"
subsystem: content-generation
tags:
  - blog-generation
  - portkey
  - tfidf
  - plagiarism
  - originality
  - google-cse
dependency_graph:
  requires:
    - "03-01"  # types/index.ts with BlogPost, OriginalityCheck, BlogPost interfaces
    - "02-04"  # googleapis pattern established
    - "01-01"  # ApiCache pattern
  provides:
    - generateBlogPost(keyword, options) -> BlogPost
    - checkOriginality(post, keyword, cseId) -> OriginalityCheck
  affects:
    - "03-03"  # internal link injector consumes BlogPost
    - "03-04"  # blog PR submitter orchestrates generation
tech_stack:
  added:
    - natural@8.1.1 (TF-IDF cosine similarity)
    - cheerio@1.2.0 (SERP HTML text extraction)
  patterns:
    - TDD red-green cycle for both tasks
    - Module-level ApiCache singleton for SERP results (24h TTL)
    - retryAttempt-based system prompt rotation (3 angles)
    - computeCosineSimilarity with zero-vector guard
key_files:
  created:
    - src/content/generator.ts
    - src/content/generator.test.ts
    - src/content/plagiarism-checker.ts
    - src/content/plagiarism-checker.test.ts
  modified: []
decisions:
  - "AnyNode cheerio type is from domhandler not cheerio namespace — use unknown cast for map callback element parameter"
  - "Test fixture VALID_MARKDOWN must exceed 2000 chars to satisfy BlogGenerationError threshold — expanded fixture inline"
metrics:
  duration: "4m 31s"
  completed: "2026-03-23"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 3 Plan 02: Blog Post Generation and Originality Checking Summary

**One-liner:** Portkey LLM blog post generation with TF-IDF cosine similarity originality scoring against live SERP data and 24h caching.

---

## What Was Built

### Task 1: src/content/generator.ts

`generateBlogPost(keyword, options)` calls Portkey with `claude-3-5-sonnet-20241022`, requests a 600-900 word Markdown post, and returns a `BlogPost` object with computed metadata. Key behaviors:

- System prompt rotates across three angles based on `retryAttempt` (0=practical how-to, 1=thought leadership, 2=problem-solution narrative) to avoid repetitive content across retry attempts
- Throws `BlogGenerationError` when LLM response is empty or under 2000 characters
- `[FACT-CHECK]` inline markers requested in prompt to flag statistics for human review
- Helper exports: `slugify`, `extractTitle`, `extractDescription`, `countWords`

### Task 2: src/content/plagiarism-checker.ts

`checkOriginality(generatedPost, keyword, cseId)` scores content originality against live Google SERP results:

1. Calls Google Custom Search API (5 results) via `googleapis`
2. Extracts visible text from each SERP page using `cheerio`
3. Builds TF-IDF model via `natural.TfIdf`
4. Computes cosine similarity: post vs. each SERP result
5. Originality = `(1 - maxSimilarity) * 100`; `passedThreshold = score > 70`

SERP results cached 24h (`86_400_000ms`) via `ApiCache` to preserve Google CSE free tier quota.

---

## Test Coverage

| File | Tests | Status |
|------|-------|--------|
| src/content/generator.test.ts | 12 | All pass |
| src/content/plagiarism-checker.test.ts | 9 | All pass |
| **Total** | **21** | **All pass** |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed cheerio AnyNode type import**
- **Found during:** Task 2 TypeScript compile check
- **Issue:** `cheerio.AnyNode` does not exist; `AnyNode` is exported from `domhandler` not `cheerio` namespace
- **Fix:** Changed `.map((_: number, el: cheerio.AnyNode) => ...)` to `.map((_: number, el: unknown) => ...)` with cast
- **Files modified:** src/content/plagiarism-checker.ts
- **Commit:** cf3d32f

**2. [Rule 1 - Bug] Expanded test fixture VALID_MARKDOWN**
- **Found during:** Task 1 GREEN phase
- **Issue:** Original VALID_MARKDOWN fixture was 1724 chars, below the 2000-char minimum enforced by `BlogGenerationError`
- **Fix:** Expanded fixture with additional paragraphs to 2200+ chars
- **Files modified:** src/content/generator.test.ts
- **Commit:** 41457b5

---

## Commits

| Hash | Message |
|------|---------|
| b41be80 | test(03-02): add failing tests for blog post generator |
| 41457b5 | feat(03-02): implement blog post generator with Portkey LLM |
| 98f47cb | test(03-02): add failing tests for TF-IDF plagiarism checker |
| cf3d32f | feat(03-02): implement TF-IDF plagiarism checker with Google CSE and SERP caching |

## Self-Check: PASSED

- FOUND: src/content/generator.ts
- FOUND: src/content/generator.test.ts
- FOUND: src/content/plagiarism-checker.ts
- FOUND: src/content/plagiarism-checker.test.ts
- FOUND: .planning/phases/03-blog-post-generation/03-02-SUMMARY.md
- COMMIT b41be80: FOUND
- COMMIT 41457b5: FOUND
- COMMIT 98f47cb: FOUND
- COMMIT cf3d32f: FOUND
- All 21 tests pass (12 generator + 9 plagiarism-checker)
- TypeScript compiles without errors

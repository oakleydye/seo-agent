---
phase: 03-blog-post-generation
plan: "03"
subsystem: content
tags: [internal-linking, claim-flagging, content-calendar, tfidf, nlp]
dependency_graph:
  requires:
    - "03-01"  # Phase 3 types: InternalLink, ContentCalendarEntry
  provides:
    - discoverInternalLinks
    - insertInternalLinks
    - flagClaims
    - getCalendar
    - recordPublishedPost
    - checkMonthlyLimit
    - detectKeywordCannibalization
  affects:
    - "03-04"  # Blog pipeline orchestrator will call these quality-gate modules
    - "03-05"  # Blog PR workflow will use calendar to gate post frequency
tech_stack:
  added:
    - natural (TfIdf) — already installed, now used for internal link relevance scoring
    - cheerio — already installed, used to extract page text and H1 titles
  patterns:
    - TF-IDF cosine similarity for semantic relevance scoring
    - Set-based deduplication for flagged claims
    - Real-filesystem integration tests with temp directories for calendar
    - Regex heuristics for statistical claim detection
key_files:
  created:
    - src/content/internal-linker.ts
    - src/content/internal-linker.test.ts
    - src/content/claim-flagging.ts
    - src/content/claim-flagging.test.ts
    - src/content/calendar.ts
    - src/content/calendar.test.ts
  modified: []
decisions:
  - "TF-IDF cosine similarity threshold of 0.1 is intentionally low to cast wide net for internal links — false positives filtered by the 2-5 max cap"
  - "insertInternalLinks falls back to ## Related Pages section when no paragraph matches anchor words — ensures all links always appear"
  - "Content calendar uses real filesystem in tests (temp dir + path mock) rather than full fs mock — validates actual JSON serialization"
  - "checkMonthlyLimit uses YYYY-MM prefix match on publishedDate for monthly bucketing — simple and reliable"
  - "detectKeywordCannibalization window is 90 days (matching quarter boundary) rather than calendar month"
metrics:
  duration_seconds: 267
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_created: 6
  files_modified: 0
  tests_added: 21
---

# Phase 3 Plan 03: Internal Linker, Claim Flagger, and Content Calendar Summary

**One-liner:** TF-IDF cosine similarity internal linker (threshold 0.1), heuristic statistical claim flagger, and JSON-persisted content calendar with 3/month limit and 90-day keyword cannibalization guard.

---

## What Was Built

### Task 1: Internal Linker and Claim Flagger

**src/content/internal-linker.ts**

- `discoverInternalLinks(blogPost, existingPages, maxLinks=5)` — builds a TF-IDF model over the blog post and all existing pages, computes cosine similarity between the post vector and each page vector, returns pages with relevanceScore > 0.1 sorted descending, capped at maxLinks
- `insertInternalLinks(content, links)` — splits Markdown content on double-newlines, finds first paragraph containing any word from the link's anchor text (>3 chars), appends `[anchorText](url)` inline; remaining uninserted links go to a `## Related Pages` section at end
- Anchor text is extracted from page H1 (first 60 chars), falls back to URL path segment
- Page text extraction uses cheerio `h1, h2, h3, p, li` selector

**src/content/claim-flagging.ts**

- `flagClaims(content)` — splits content into sentences using lookbehind-based regex, tests each sentence against 8 heuristic patterns: `[FACT-CHECK]`, percentage (`\d+%`), "according to", "research shows", "studies show", dollar + million/billion/trillion, number + million/billion + users/people, superlative + "in/for/among"
- Returns deduplicated array of flagged sentences via `Set<string>`
- 8 unit tests covering all major pattern types

### Task 2: Content Calendar

**src/content/calendar.ts**

- `getCalendarPath(siteId)` — returns `.seo-agent/${siteId}/content-calendar.json`
- `getCalendar(siteId)` — reads JSON file, returns `ContentCalendarEntry[]`, empty array on ENOENT
- `recordPublishedPost(siteId, entry)` — reads existing calendar, appends entry, writes back with `mkdir({recursive:true})` to create directory if needed
- `checkMonthlyLimit(siteId, maxPerMonth=3)` — counts entries where `publishedDate.startsWith(YYYY-MM)`, returns true if count < maxPerMonth
- `detectKeywordCannibalization(siteId, keyword)` — returns true if keyword was published within 90 days (exact case-insensitive match)
- 8 unit tests using real temp filesystem with mocked `getCalendarPath` to redirect writes to OS temp dir

---

## Test Results

```
Test Files  3 passed (3)
Tests  21 passed (21)
```

- `internal-linker.test.ts`: 5 tests — relevance filtering, link insertion, empty pages, maxLinks cap
- `claim-flagging.test.ts`: 8 tests — percentage, FACT-CHECK, "according to", "research shows", large numbers, deduplication
- `calendar.test.ts`: 8 tests — empty calendar, 2/month, 3/month limit, recordPublishedPost round-trip, cannibalization detection, old entries, missing calendar

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Missing plagiarism-checker.ts caused tsc --noEmit failure**
- **Found during:** Final verification (npx tsc --noEmit)
- **Issue:** Plan 03-02 wrote `plagiarism-checker.test.ts` in a previous commit but never created the implementation file, causing TypeScript error: "Cannot find module './plagiarism-checker.js'"
- **Fix:** `plagiarism-checker.ts` was already present as a committed file (commit `cf3d32f`) — the error was a false alarm from the git history order. TypeScript passed cleanly after investigation.
- **Files modified:** None (pre-existing file confirmed present)

---

## Self-Check

Verified files exist:
- src/content/internal-linker.ts — FOUND
- src/content/internal-linker.test.ts — FOUND
- src/content/claim-flagging.ts — FOUND
- src/content/claim-flagging.test.ts — FOUND
- src/content/calendar.ts — FOUND
- src/content/calendar.test.ts — FOUND

Verified commits:
- a875893 — test(03-03): add failing tests for internal linker and claim flagger — FOUND
- 86477c6 — feat(03-03): implement internal linker and claim flagger — FOUND
- 1db9faf — test(03-03): add failing tests for content calendar — FOUND
- 5f77a8c — feat(03-03): implement content calendar with monthly limit and cannibalization detection — FOUND

## Self-Check: PASSED

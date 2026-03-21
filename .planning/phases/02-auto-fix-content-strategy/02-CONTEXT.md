# Phase 2: Auto-Fix & Content Strategy - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate code fixes for detected SEO issues (title tags, meta descriptions, Open Graph, alt text, headings, schema.org markup) and submit as GitHub PRs. Identify keyword opportunities from Google Search Console data. All fixes validated before PR submission. Blog post generation is Phase 3 — this phase only identifies keyword opportunities, not generates content.

</domain>

<decisions>
## Implementation Decisions

### Code Fix Generation
- LLM-generated fixes via Portkey — send issue context + full source file to the model, get back modified file
- Clone client repo locally (full clone) to access source files and enable `next build` validation
- Send full file + issue details as LLM context (entire source file + audit issue rule/severity/description)
- Batch fixes per file — group all issues for a given file into one LLM call to avoid conflicts from sequential edits

### PR Structure for Fixes
- One PR per fix category per site (e.g., one PR for all meta description fixes, one for all alt text fixes across the site)
- Fix PRs link back to the audit PR that discovered the issues ("Discovered by audit PR #N" in body)
- PR description includes: what SEO issue was found, why the fix was applied, and human-readable summary of changes (satisfies FIX-07)
- Branch naming: `seo-fix/{category}/YYYY-MM-DD` (e.g., `seo-fix/meta-descriptions/2026-03-21`)

### Risk Classification & Safety
- Low-risk (auto-submitted): meta tags, alt text, canonical tags, basic schema.org — these don't affect page rendering or functionality
- Needs-review: heading hierarchy changes, structural HTML changes — anything touching visible content
- Build validation is a soft gate: if `next build` fails, still create the PR but label it `needs-review` and flag the failure in the description
- No file allowlist restriction — trust LLM + build validation as safety net
- Track fix PR count per site in site config; first N PRs (configurable, default 5) get a `first-run` label for manual review before trust is established

### Claude's Discretion
- LLM prompt engineering for fix generation (system prompt, few-shot examples, output format)
- Schema.org JSON-LD structure and markup patterns
- Search Console API query parameters and data filtering logic
- Keyword opportunity scoring algorithm and minimum volume threshold implementation
- Error handling for LLM failures (retry, fallback, skip)
- Temp directory management for cloned repos

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Constraints: Portkey required, PR-only delivery, Next.js only, <10 sites
- `.planning/REQUIREMENTS.md` — FIX-01 through FIX-07 (auto-fix requirements), CONT-01 (keyword identification)
- `.planning/ROADMAP.md` — Phase 2 success criteria, requirement mapping, safety gates

### Research & architecture
- `.planning/research/SUMMARY.md` — Recommended stack, architecture patterns
- `.planning/research/ARCHITECTURE.md` — Pipeline architecture, component boundaries
- `.planning/research/STACK.md` — Technology choices (Portkey SDK, Octokit, etc.)
- `.planning/research/PITFALLS.md` — Critical pitfalls (quota exhaustion, unvalidated code)

### Phase 1 context (integration points)
- `.planning/phases/01-core-audit-discovery-pr-workflow/01-CONTEXT.md` — Phase 1 decisions (PR structure, branch naming)

### Existing code (key integration files)
- `src/types/index.ts` — Shared types: Issue, AuditFindings, SiteConfig (extend for fix types)
- `src/executor/github.ts` — PR creation via Octokit (adapt for fix PRs)
- `src/executor/pr-formatter.ts` — PR body formatting (extend for fix descriptions)
- `src/portkey/client.ts` — Portkey client stub (activate for LLM fix generation)
- `src/auditor/rules.ts` — Audit rules producing Issue[] (input to fix pipeline)
- `src/config/loader.ts` — Site config loading (extend for fix PR tracking)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/portkey/client.ts`: Portkey client initialized but unused — activate for LLM fix generation calls
- `src/executor/github.ts`: `createAuditPR()` handles branch creation, PR creation, idempotency — adapt pattern for fix PRs
- `src/executor/pr-formatter.ts`: `formatPRTitle()` and `formatPRBody()` — extend with fix-specific formatters
- `src/auditor/rules.ts` + `src/auditor/index.ts`: Produces `Issue[]` with rule IDs matching fix categories
- `src/types/index.ts`: `Issue`, `SiteConfig`, `AuditFindings` types — extend for fix pipeline types

### Established Patterns
- Pipeline architecture: crawl → audit → format → PR (extend to: crawl → audit → fix → validate → PR)
- Octokit-based GitHub workflow with idempotent branch/PR creation
- Pino structured logging throughout
- Zod for config validation
- ESM + TypeScript strict mode

### Integration Points
- Fix pipeline consumes `Issue[]` from auditor output
- Fix PRs use same Octokit/GitHub patterns as audit PRs (different branch namespace)
- SiteConfig needs extension for fix tracking (approval count, allowlisted fix categories)
- Portkey client transitions from stub to active LLM caller
- CLI needs `fix` command alongside existing `audit` command

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-auto-fix-content-strategy*
*Context gathered: 2026-03-21*

# Phase 2: Auto-Fix & Content Strategy - Research

**Researched:** 2026-03-21
**Domain:** LLM-driven code generation for SEO fixes, Google Search Console API integration, build validation, PR submission
**Confidence:** MEDIUM-HIGH

## Summary

Phase 2 extends Phase 1's audit capability with LLM-generated code fixes and keyword opportunity identification. The core challenge is **safety-first code generation**: agents must generate syntactically correct, semantically valid Next.js TypeScript/JSX that passes build validation and doesn't break production. This research covers LLM integration patterns via Portkey, file cloning for local build validation, Google Search Console keyword API usage, decision logic for risk categorization, and quota management for Google APIs.

**Primary recommendation:** Use Portkey SDK for code generation with strict validation pipeline (syntax check → build validation → schema validation), implement 24-48h response caching for Google APIs, categorize fixes by risk (low-risk: meta tags, alt text, canonical; needs-review: heading hierarchy, content structure), and enforce exponential backoff (1s→60s) for API rate limiting.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Code Fix Generation:**
- LLM-generated fixes via Portkey — send issue context + full source file to the model, get back modified file
- Clone client repo locally (full clone) to access source files and enable `next build` validation
- Send full file + issue details as LLM context (entire source file + audit issue rule/severity/description)
- Batch fixes per file — group all issues for a given file into one LLM call to avoid conflicts from sequential edits

**PR Structure for Fixes:**
- One PR per fix category per site (e.g., one PR for all meta description fixes, one for all alt text fixes across the site)
- Fix PRs link back to the audit PR that discovered the issues ("Discovered by audit PR #N" in body)
- PR description includes: what SEO issue was found, why the fix was applied, and human-readable summary of changes (satisfies FIX-07)
- Branch naming: `seo-fix/{category}/YYYY-MM-DD` (e.g., `seo-fix/meta-descriptions/2026-03-21`)

**Risk Classification & Safety:**
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

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIX-01 | Agent generates code to add/fix missing title tags and submits as PR | LLM via Portkey with batch-per-file pattern; build validation with `next build` |
| FIX-02 | Agent generates code to add/fix meta descriptions and submits as PR | Same LLM pattern; validated against 50-160 char bounds |
| FIX-03 | Agent generates code to add Open Graph tags and submits as PR | Meta tag generation via LLM; pre-validated tag names (og:title, og:description, etc.) |
| FIX-04 | Agent generates code to fix missing image alt text and submits as PR | Alt attribute injection into img tags; LLM suggests descriptive text |
| FIX-05 | Agent generates code to fix heading hierarchy issues and submits as PR | Heading reordering/insertion; marked as needs-review (content-affecting) |
| FIX-06 | Agent generates JSON-LD schema markup and submits as PR | Schema.org JSON-LD generation; validated with schemaorg-jsd or Ajv; researched below |
| FIX-07 | Each PR includes clear description explaining what was found and why it was fixed | PR formatter extends Phase 1 patterns; includes issue rule, severity, and LLM rationale |
| CONT-01 | Agent identifies keyword opportunities from Google Search Console data | GSC API integration; filtering by ≥10 searches/month; ranking by relevance + traffic |

---

## Standard Stack

### Core (Phase 1 Foundation + Extensions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Node.js** | 20.x LTS | Runtime | Mature, stable. Phase 1 proven. |
| **TypeScript** | 5.3+ | Type safety | Phase 1 established. Required for LLM output validation. |
| **@portkey-ai/portkey-node** | 3.0.3+ (verify current) | LLM gateway | Hard constraint per CONTEXT.md. Unified interface to Claude/GPT-4. |
| **@octokit/rest** | 20.x | GitHub API | Phase 1 proven. Extend for fix PR creation. |
| **cheerio** | 1.0+ | HTML parsing | Phase 1 proven. Use for post-fix validation. |
| **zod** | 3.25+ | Runtime validation | Phase 1 proven. Validate LLM output schemas. |

### New for Phase 2

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **simple-git** | 3.20+ | Git operations | Clone client repos locally for build validation. TypeScript-native. |
| **schemaorg-jsd** | 0.17+ | JSON-LD validation | Validate generated schema.org markup. Note: last update 5 years ago; check for maintained alternatives. |
| **@google-cloud/search-console** | Latest (verify) | Google Search Console API | Query organic keywords, impressions, CTR. Official Google SDK. |
| **ajv** | 8.x+ | JSON Schema validation | Alternative/supplement to schemaorg-jsd for generic schema validation. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|-----------|-----------|----------|
| schemaorg-jsd | Ajv + manual schema | Ajv is more actively maintained (2025); schemaorg-jsd has domain knowledge but stale. Consider Ajv. |
| simple-git | isomorphic-git or native fs + child_process | simple-git abstracts CLI complexity; native gives more control (slower dev). Use simple-git. |
| Portkey | Direct Claude/OpenAI SDK | Portkey allows model switching without code changes; direct SDK locks vendor. Use Portkey. |

**Installation:**
```bash
npm install \
  simple-git \
  schemaorg-jsd \
  @google-cloud/search-console \
  ajv
```

**Version verification (before implementation):**
```bash
npm view @portkey-ai/portkey-node version
npm view simple-git version
npm view @google-cloud/search-console version
npm view schemaorg-jsd version
npm view ajv version
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 Extensions)

```
src/
├── fixer/                  # NEW: Code generation & fix pipeline
│   ├── index.ts            # Orchestrator: batches issues, calls LLM
│   ├── generator.ts        # LLM prompting, output parsing
│   ├── validator.ts        # Syntax, build, schema validation
│   └── fixer.test.ts
├── generator/              # NEW: LLM-driven content/code
│   ├── prompts.ts          # System prompts, few-shot examples
│   ├── schema.ts           # Schema.org template generation
│   └── keywords.ts         # Keyword ranking logic
├── executor/               # EXTEND: PR creation for fixes
│   ├── github.ts           # ADD: createFixPR() function
│   ├── pr-formatter.ts     # EXTEND: formatFixPRBody()
│   └── github.test.ts
├── fetcher/                # EXTEND: Google APIs
│   ├── pagespeed.ts        # Phase 1 (existing)
│   ├── search-console.ts   # NEW: GSC API integration
│   └── search-console.test.ts
├── config/                 # EXTEND: fix tracking
│   ├── loader.ts           # EXTEND: SiteConfig for fix PR counts
│   └── loader.test.ts
├── types/                  # EXTEND: fix-related types
│   ├── index.ts            # ADD: Fix, FixPR, RiskCategory types
│   └── index.test.ts
├── utils/
│   ├── logger.ts           # Phase 1 (reuse)
│   ├── cache.ts            # NEW: 24-48h TTL caching for Google APIs
│   └── retry.ts            # NEW: Exponential backoff for rate limiting
└── cli/
    ├── commands/
    │   ├── audit.ts        # Phase 1 (reuse)
    │   ├── fix.ts          # NEW: CLI command for fix generation
    │   └── fix.test.ts
```

### Pattern 1: Batch-Per-File LLM Processing

**What:** Group all issues for a single source file, call LLM once with full file + all issues, get back modified file. Avoids sequential edits conflicting with each other.

**When to use:** Any multi-issue fix scenario (e.g., 3 missing alt texts in same file, 2 meta tags).

**Example:**
```typescript
// Source: Phase 2 architecture decision (CONTEXT.md)
interface BatchFixRequest {
  filePath: string;
  sourceCode: string;
  issues: Issue[];  // All issues for this file
}

async function generateFixedFile(request: BatchFixRequest): Promise<string> {
  const prompt = `
You are an expert Next.js/React developer. Fix the following issues in this TypeScript/JSX file:

Source file: ${request.filePath}

Issues to fix:
${request.issues.map(i => `- [${i.severity}] ${i.rule}: ${i.description}`).join('\n')}

Original code:
\`\`\`typescript
${request.sourceCode}
\`\`\`

Return ONLY the modified file, valid TypeScript/JSX, no explanations.
  `;

  const portkey = getPortkeyClient();
  const response = await portkey.messages.create({
    model: 'claude-3-5-sonnet',  // or configured model
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
```

### Pattern 2: Build Validation as Soft Gate

**What:** Clone repo locally, apply fixes, run `next build`. If build passes, submit PR as auto-fix. If build fails, still submit PR but label `needs-review` and flag error in description.

**When to use:** Every fix PR before submission.

**Example:**
```typescript
// Source: Phase 2 safety gates (ROADMAP.md)
async function validateFixedCode(
  gitHubRepo: string,
  branch: string,
  fixedFiles: Map<string, string>
): Promise<{ success: boolean; error?: string }> {
  const tempDir = `/tmp/seo-agent-fix-${Date.now()}`;

  try {
    // Clone repo at specific branch
    const git = simpleGit();
    await git.clone(
      `https://github.com/${gitHubRepo}.git`,
      tempDir,
      { '--branch': branch }
    );

    // Write fixed files
    for (const [filePath, content] of fixedFiles) {
      await fs.writeFile(`${tempDir}/${filePath}`, content);
    }

    // Run build validation
    const result = await execa('npm', ['run', 'build'], {
      cwd: tempDir,
      timeout: 300_000  // 5 min
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true });
  }
}
```

### Pattern 3: Risk Categorization for Auto-Submit vs Review

**What:** Classify each issue as low-risk (auto-fixable) or needs-review. Only auto-submit low-risk. First N PRs per site get `first-run` label regardless for operator validation.

**When to use:** Before PR submission decision.

**Example:**
```typescript
// Source: CONTEXT.md risk classification
type RiskCategory = 'low-risk' | 'needs-review';

function categorizeFixRisk(issue: Issue): RiskCategory {
  const lowRiskRules = [
    'missing-title-tag',
    'missing-meta-description',
    'missing-og-tags',
    'missing-alt-text',
    'missing-canonical',
    'invalid-schema-markup',
  ];

  return lowRiskRules.includes(issue.rule) ? 'low-risk' : 'needs-review';
}

async function shouldAutoSubmitPR(
  site: SiteConfig,
  issues: Issue[],
  fixRisks: RiskCategory[]
): Promise<boolean> {
  // All issues must be low-risk
  const allLowRisk = fixRisks.every(r => r === 'low-risk');

  // Check first-run limit
  const fixPRCount = (site.fixPRTracking?.submittedCount ?? 0);
  const isFirstRun = fixPRCount < (site.fixPRTracking?.firstRunLimit ?? 5);

  // Auto-submit only if low-risk AND past first-run count
  return allLowRisk && !isFirstRun;
}
```

### Pattern 4: Google Search Console API with Caching & Backoff

**What:** Query GSC API for keywords, cache responses 24-48h, implement exponential backoff (1s→60s) for 429 rate-limit responses.

**When to use:** CONT-01 keyword identification; every audit cycle.

**Example:**
```typescript
// Source: Pitfalls research + GSC API docs
interface CachedResponse {
  data: any;
  cachedAt: Date;
  ttlMs: number;
}

class SearchConsoleClient {
  private cache = new Map<string, CachedResponse>();

  async queryKeywords(
    siteUrl: string,
    options?: { startDate?: string; endDate?: string }
  ): Promise<SearchQuery[]> {
    const cacheKey = `gsc-${siteUrl}-${options?.startDate}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt.getTime() < cached.ttlMs) {
      return cached.data;
    }

    // Query with exponential backoff
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      try {
        const client = getSearchConsoleClient();
        const response = await client.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: options?.startDate,
            endDate: options?.endDate,
            dimensions: ['query'],
            rowLimit: 10_000,
          },
        });

        const rows = response.data.rows ?? [];

        // Cache for 24-48 hours
        this.cache.set(cacheKey, {
          data: rows,
          cachedAt: new Date(),
          ttlMs: 24 * 60 * 60 * 1000 + Math.random() * 24 * 60 * 60 * 1000,
        });

        return rows;
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };

        if (err.status === 429) {
          // Rate limited — exponential backoff with jitter
          const waitMs = Math.min(
            1000 * Math.pow(2, retries) + Math.random() * 1000,
            60_000
          );
          await new Promise(r => setTimeout(r, waitMs));
          retries++;
        } else {
          throw error;
        }
      }
    }

    throw new Error(`GSC query failed after ${maxRetries} retries`);
  }
}
```

### Anti-Patterns to Avoid

- **Sequential LLM calls per issue:** Generates each fix independently → conflicts when writing back to file. Batch by file instead.
- **No build validation:** Trust LLM syntax checking alone → breaks production. Always run `next build`.
- **Submitting fix PRs on first run:** No operator trust period. Track fix count per site; label first N as `first-run` for review.
- **Ignoring Google API quotas:** Fail silently when quotas exhausted. Pre-audit limits, cache aggressively, implement backoff.
- **Unrestricted file modification:** Allow LLM to edit any file → security risk. No hard allowlist per CONTEXT (trust validation), but flag suspicious file paths in validation.
- **Direct credential embedding:** Bake API keys into generated code. Never. Validate generated content for `process.env` references.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|------------|-------------|-----|
| Git clone + branch management | Custom shell scripts + fs operations | `simple-git` library | Handles credential caching, edge cases, cross-platform compatibility. |
| LLM API calls | Direct HTTP requests + response parsing | Portkey SDK | Built-in retry, model routing, error handling. Portkey is constraint anyway. |
| JSON-LD schema validation | Manual regex + string checks | schemaorg-jsd or Ajv | Domain expertise in schema.org specs. Prevents invalid markup. |
| Exponential backoff for rate limiting | Manual sleep loops | Built-in SDK retry + custom backoff layer | Proper jitter + timeout handling prevents thundering herd. |
| Response caching with TTL | In-memory Map + manual expiry | node-cache or custom expiry logic | TTL cleanup, eviction strategies, mem safety. |
| Google API authentication | Manual OAuth2 flow | @google-cloud/search-console SDK | OAuth2 is complex. Official SDK handles tokens, refresh, quota tracking. |
| Environment variable validation | String checks | Zod + next.config.mjs validation | Catches missing vars at build time, not runtime. |

**Key insight:** Phase 2 adds complexity via LLM + Google APIs. Leverage battle-tested libraries for integration points (Portkey, simple-git, official Google SDK) so you focus on domain logic (fix generation, decision rules, PR structure).

---

## Common Pitfalls

### Pitfall 1: LLM Generates Syntactically Valid But Semantically Broken Code

**What goes wrong:** LLM outputs TypeScript that parses fine but breaks at runtime (imports non-existent modules, violates React rules, breaks Next.js routing, mismatches component props).

**Why it happens:**
- Full-file context sent to LLM may include dependencies not available
- No TypeScript strict mode validation on generated output
- LLM doesn't understand component props or page structure
- Generated code not tested in actual environment

**How to avoid:**
1. **Validate output syntax:** Parse generated file with TypeScript compiler (e.g., `tsc --noEmit`) before committing
2. **Run full `next build`:** Only validation that catches Next.js-specific errors (dynamic imports, API routes, middleware)
3. **Check import statements:** Scan generated code for missing imports; flag unresolved dependencies
4. **Test in actual repo:** Clone repo, apply fix, run build. This is the only real validation.
5. **Restrict generated changes:** Only modify metadata/content-bearing parts, never component logic

**Warning signs:**
- Build fails post-PR with "Cannot find module X"
- React hook violations in generated code
- Mismatched prop types on components
- Next.js build hangs during optimization

### Pitfall 2: Google Search Console API Quota Exhaustion

**What goes wrong:** Agent queries GSC API frequently, hits quota limits (2,000 queries/day), and silently returns empty data. Monthly run appears to complete but PR has no keyword data.

**Why it happens:**
- No pre-audit quota check against Google Cloud Console
- Inefficient queries (e.g., 30-day window per query instead of aggregated)
- No response caching — same query run multiple times per audit cycle
- No rate-limit handling (429 responses)

**How to avoid:**
1. **Pre-audit quota:** Verify available quota before first implementation. Document limits.
2. **Cache aggressively:** 24-48h TTL on all GSC responses. Key by site + date range.
3. **Exponential backoff:** On 429, wait 1s→2s→4s→...→60s with jitter. Don't retry immediately.
4. **Log quota remaining:** After each GSC call, log remaining quota. Alert if <20%.
5. **Request budgeting:** Max 5 GSC requests per site per audit cycle (queries, impressions, pages).

**Warning signs:**
- GSC queries returning empty arrays despite site having data
- Logs showing "quota exceeded" after first site (under 10 sites)
- Next month's audit run fails early without completing all sites
- Google Cloud Console quota dashboard showing exhaustion

### Pitfall 3: Fix PR Submitted Without Build Validation Attempt

**What goes wrong:** Agent generates code, submits PR without running `next build`. PR is merged, production site breaks (missing deps, syntax errors, Next.js errors).

**Why it happens:**
- Assuming TypeScript compilation is sufficient
- Repo cloning too expensive or complex
- Build timeout not handled
- No fallback if build validation unavailable

**How to avoid:**
1. **Mandatory build run:** Always clone repo locally, run `next build` before PR submission.
2. **Soft gate (not hard gate):** If build fails, still submit PR but label `needs-review` and document error in description.
3. **Timeout handling:** Set 5-minute timeout on build; if exceeded, flag as failure and skip auto-submit.
4. **Cleanup:** Always delete temp clone dir even if build fails (use finally/try-finally).
5. **Log build output:** Save build stderr/stdout to PR description for visibility.

**Warning signs:**
- PR merged then site errors immediately after
- Build logs not included in PR description
- No evidence of validation attempt in PR metadata

### Pitfall 4: Unvalidated Schema.org Markup Rejected by Google Search Console

**What goes wrong:** Agent generates JSON-LD schema.org markup that's structurally valid JSON but violates schema.org specs (wrong property names, missing required fields, invalid types). Google Search Console flags as error; fix is rolled back.

**Why it happens:**
- LLM doesn't know schema.org spec details
- No validation against schema.org vocabulary
- Generated schema.org not tested in actual page context

**How to avoid:**
1. **Use schemaorg-jsd or Ajv:** Validate generated JSON-LD against schema.org spec before committing.
2. **Provide LLM template:** Give LLM pre-validated schema templates, not free-form generation.
3. **Test in Google's tool:** Before PR, validate generated markup with schema.org validator (web tool or programmatic check).
4. **Document schema structure:** In prompt, provide valid examples of each schema type (Article, Product, FAQPage, etc.).
5. **Restrict to known good patterns:** Start with basic schema (BreadcrumbList, Article) before complex types.

**Warning signs:**
- Google Search Console reporting "Invalid schema markup" within 24h of PR merge
- Missing required schema.org properties (e.g., Article without datePublished)
- Wrong property names (og:title instead of og:title in JSON-LD)

### Pitfall 5: First PR Without Operator Review Breaks Trust

**What goes wrong:** Agent submits multiple fix PRs immediately, first one has issues, agency loses confidence in auto-submit even after second fix is reviewed.

**Why it happens:**
- No distinction between first/early runs and trusted runs
- No operator gate period to validate output
- Too aggressive auto-submit strategy

**How to avoid:**
1. **First-run labeling:** Track fix PR count per site. First N (default 5) get `first-run` label for explicit review.
2. **Staged rollout:** Don't auto-submit until operator reviews first N PRs and approves.
3. **Clear messaging:** PR description notes "First PR — please review before merge."
4. **Metrics tracking:** Log success rate (merged vs reverted) per site. Use to adjust first-run count.

**Warning signs:**
- First PR submitted without label/distinction
- Operator not involved in early validation
- No tracking of fix PR count per site

---

## Code Examples

Verified patterns from existing codebase and research:

### Code Fix Generation via LLM

```typescript
// Source: CONTEXT.md (batch-per-file pattern) + Portkey docs
import { getPortkeyClient } from '../portkey/client.js';
import { logger } from '../utils/logger.js';
import type { Issue } from '../types/index.js';

interface FixGenerationRequest {
  filePath: string;
  sourceCode: string;
  issues: Issue[];
}

export async function generateCodeFix(
  request: FixGenerationRequest
): Promise<{ fixedCode: string; errors?: string[] }> {
  const { filePath, sourceCode, issues } = request;

  // Group issues by type for clarity
  const issuesByRule = new Map<string, Issue[]>();
  for (const issue of issues) {
    const group = issuesByRule.get(issue.rule) ?? [];
    group.push(issue);
    issuesByRule.set(issue.rule, group);
  }

  const issueDescription = Array.from(issuesByRule.entries())
    .map(([rule, group]) => `- **${rule}** (${group.length} occurrence${group.length > 1 ? 's' : ''}): ${group[0]!.description}`)
    .join('\n');

  const systemPrompt = `You are an expert Next.js/React TypeScript developer. Your task is to fix SEO issues in a source file.

Rules:
1. Return ONLY the fixed source code, no explanations or markdown code blocks
2. Preserve all existing code not related to the issues
3. Do not import new dependencies unless absolutely necessary
4. Maintain the original code style and formatting
5. Ensure all TypeScript types are correct

Issues to fix:
${issueDescription}

Source file path: ${filePath}`;

  const userPrompt = `Fix the following issues in this file:

\`\`\`typescript
${sourceCode}
\`\`\`

Return the corrected code only.`;

  try {
    const portkey = getPortkeyClient();
    const response = await portkey.messages.create({
      model: 'claude-3-5-sonnet',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const fixedCode =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    if (!fixedCode.trim()) {
      return {
        fixedCode: sourceCode,
        errors: ['LLM returned empty response'],
      };
    }

    // Basic syntax validation: ensure it's not wrapped in code blocks
    let cleaned = fixedCode;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:typescript|jsx)?\n?/, '').replace(/\n?```$/, '');
    }

    logger.info({ filePath, issueCount: issues.length }, 'Code fix generated');
    return { fixedCode: cleaned };
  } catch (error) {
    const err = error as Error;
    logger.error({ filePath, error: err.message }, 'Code fix generation failed');
    return {
      fixedCode: sourceCode,
      errors: [err.message],
    };
  }
}
```

### Build Validation with `next build`

```typescript
// Source: ROADMAP.md (Phase 2 success criteria)
import { execa } from 'execa';
import { writeFile, rm } from 'fs/promises';
import * as path from 'path';
import { SimpleGit, simpleGit } from 'simple-git';
import { logger } from '../utils/logger.js';

interface BuildValidationResult {
  passed: boolean;
  stdout?: string;
  stderr?: string;
}

export async function validateBuild(
  gitHubRepo: string,
  branch: string,
  fixedFiles: Map<string, string>,
  timeoutMs: number = 300_000
): Promise<BuildValidationResult> {
  const tempDir = path.join('/tmp', `seo-fix-${Date.now()}`);

  try {
    logger.info({ tempDir, branch }, 'Cloning repo for build validation');

    // Clone repo
    const git: SimpleGit = simpleGit();
    await git.clone(
      `https://github.com/${gitHubRepo}.git`,
      tempDir,
      { '--depth': '1', '--branch': branch }
    );

    // Write fixed files
    for (const [filePath, content] of fixedFiles) {
      const fullPath = path.join(tempDir, filePath);
      await writeFile(fullPath, content, 'utf-8');
      logger.debug({ filePath }, 'Wrote fixed file');
    }

    // Run next build
    logger.info({ repo: gitHubRepo }, 'Running next build');
    const result = await execa('npm', ['run', 'build'], {
      cwd: tempDir,
      timeout: timeoutMs,
      reject: false,  // Don't throw on non-zero exit
    });

    if (result.exitCode === 0) {
      logger.info({ repo: gitHubRepo }, 'Build validation passed');
      return { passed: true, stdout: result.stdout, stderr: result.stderr };
    } else {
      logger.warn({ repo: gitHubRepo, exitCode: result.exitCode }, 'Build validation failed');
      return { passed: false, stdout: result.stdout, stderr: result.stderr };
    }
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Build validation error');
    return { passed: false, stderr: err.message };
  } finally {
    // Always cleanup
    try {
      await rm(tempDir, { recursive: true, force: true });
      logger.debug({ tempDir }, 'Cleaned up temp directory');
    } catch (cleanupErr) {
      logger.warn({ error: (cleanupErr as Error).message }, 'Cleanup failed');
    }
  }
}
```

### Google Search Console Keywords Query

```typescript
// Source: GSC API docs + caching pattern from research
import { SearchConsoleClient } from '@google-cloud/search-console';
import { logger } from '../utils/logger.js';

interface KeywordOpportunity {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export class KeywordAnalyzer {
  private cache = new Map<string, { data: KeywordOpportunity[]; expiry: number }>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private client: SearchConsoleClient) {}

  async findKeywordOpportunities(
    siteUrl: string,
    minSearchVolume: number = 10
  ): Promise<KeywordOpportunity[]> {
    const cacheKey = `keywords-${siteUrl}`;
    const cached = this.cache.get(cacheKey);

    // Return cached if fresh
    if (cached && cached.expiry > Date.now()) {
      logger.debug({ cacheKey }, 'Returning cached keyword opportunities');
      return cached.data;
    }

    // Query with retry
    const opportunities = await this.queryWithRetry(siteUrl);

    // Filter by minimum search volume and rank by opportunity
    const filtered = opportunities
      .filter(k => k.impressions >= minSearchVolume)
      .sort((a, b) => {
        // Score = impressions * CTR (traffic opportunity)
        const scoreA = a.impressions * a.ctr;
        const scoreB = b.impressions * b.ctr;
        return scoreB - scoreA;
      });

    // Cache with TTL + random jitter to avoid thundering herd
    const jitter = Math.random() * 12 * 60 * 60 * 1000; // +0-12h
    this.cache.set(cacheKey, {
      data: filtered,
      expiry: Date.now() + this.CACHE_TTL_MS + jitter,
    });

    logger.info({ count: filtered.length, siteUrl }, 'Keywords queried and cached');
    return filtered;
  }

  private async queryWithRetry(
    siteUrl: string,
    retries: number = 0,
    maxRetries: number = 5
  ): Promise<KeywordOpportunity[]> {
    try {
      const response = await this.client.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          dimensions: ['query'],
          rowLimit: 10_000,
        },
      });

      const rows = response.data.rows ?? [];
      return rows.map(row => ({
        query: row.keys?.[0] ?? '',
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      }));
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };

      if (err.status === 429 && retries < maxRetries) {
        // Exponential backoff with jitter
        const waitMs = Math.min(
          1000 * Math.pow(2, retries) + Math.random() * 1000,
          60_000
        );
        logger.warn({ retries, waitMs }, 'Rate limited; backing off');
        await new Promise(resolve => setTimeout(resolve, waitMs));
        return this.queryWithRetry(siteUrl, retries + 1, maxRetries);
      }

      logger.error({ error: err.message, siteUrl }, 'GSC query failed');
      throw error;
    }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual code review for SEO fixes | LLM-generated fixes + build validation | 2024-2025 (AI maturity) | Faster fixes, but requires safety gates |
| Repo crawl + report only | Autonomous code generation + PR submission | Phase 2 (this) | Enables self-healing sites |
| No keyword research | GSC API + demand filtering (>10/month) | 2023-2024 (API maturity) | Data-driven content strategy |
| Per-issue LLM calls | Batch-per-file LLM calls | 2025 (cost/quality) | Reduces conflicts, lowers API costs |

**Deprecated/outdated:**
- **Manual SEO fixes:** Agencies historically fixed issues manually. LLM generation enables scale.
- **Keyword research without search volume:** Targeting any keyword; now filtered to >10/month to avoid no-traffic keywords.
- **No build validation:** Old approach trusted code review. Current requires automated validation.
- **Single-file batch operations:** Old approach called LLM per issue. Current batches by file to avoid sequential edit conflicts.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 1.6.1 (from Phase 1) |
| Config file | vite.config.ts (ESM, TypeScript) |
| Quick run command | `npm run test -- src/fixer src/fetcher src/generator` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | LLM generates code to fix missing title tags | unit | `npm test -- src/fixer/generator.test.ts -t "title"` | ❌ Wave 0 |
| FIX-02 | LLM generates code to fix meta descriptions | unit | `npm test -- src/fixer/generator.test.ts -t "meta-desc"` | ❌ Wave 0 |
| FIX-03 | LLM generates Open Graph tag code | unit | `npm test -- src/fixer/generator.test.ts -t "og-tags"` | ❌ Wave 0 |
| FIX-04 | LLM generates alt text fixes | unit | `npm test -- src/fixer/generator.test.ts -t "alt-text"` | ❌ Wave 0 |
| FIX-05 | LLM detects heading hierarchy issues (marked needs-review) | unit | `npm test -- src/fixer/validator.test.ts -t "heading"` | ❌ Wave 0 |
| FIX-06 | LLM generates valid schema.org JSON-LD | unit | `npm test -- src/generator/schema.test.ts` | ❌ Wave 0 |
| FIX-07 | PR descriptions include issue summary + fix rationale | unit | `npm test -- src/executor/pr-formatter.test.ts -t "fix-body"` | ❌ Wave 0 |
| CONT-01 | GSC API returns keywords filtered by >=10 searches/month | integration | `npm test -- src/fetcher/search-console.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- src/fixer src/fetcher` (fixes and keyword query tests)
- **Per wave merge:** `npm test` (full suite including Phase 1 regression)
- **Phase gate:** Full suite green + manual review of first 3 fix PRs before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/fixer/generator.test.ts` — unit tests for LLM output validation (syntax, imports, React rules)
- [ ] `src/fixer/validator.test.ts` — build validation mocking (fake next.js, test success/failure cases)
- [ ] `src/generator/schema.test.ts` — JSON-LD generation and schemaorg-jsd validation
- [ ] `src/fetcher/search-console.test.ts` — GSC API mocking, caching, rate-limit backoff
- [ ] `src/executor/pr-formatter.test.ts` — extend Phase 1 tests to include fix PR descriptions
- [ ] `src/utils/cache.test.ts` — TTL expiry, jitter application
- [ ] `src/utils/retry.test.ts` — exponential backoff with jitter, max retry logic
- [ ] Framework setup: `npm install vitest --save-dev` (already installed)
- [ ] Mocking: `npm install vi --save-dev` (vitest mock utilities)

---

## Open Questions

1. **Portkey SDK TypeScript support in v3.0.3+**
   - What we know: CONTEXT.md uses Portkey; Phase 1 stub initialized
   - What's unclear: Exact current version, TypeScript interface stability, error types
   - Recommendation: Verify `npm view @portkey-ai/portkey-node` before planner writes code. Check for type definitions in package.

2. **schemaorg-jsd maintenance status**
   - What we know: Available on npm; last update 5 years ago (2021)
   - What's unclear: Is it still safe to use? Are alternatives (Ajv) better?
   - Recommendation: During implementation, test schemaorg-jsd validation against known good/bad JSON-LD. If unstable, switch to Ajv + manual patterns.

3. **Google Search Console API quota for free tier**
   - What we know: 2,000 queries/day, 600 queries/minute per official docs
   - What's unclear: Under 10 sites, how many unique queries per month? Is 2,000/day enough?
   - Recommendation: Pre-implementation, calculate actual queries needed (sites × dimensions × date ranges). Verify quota exists; if tight, implement aggressive caching.

4. **Next.js build time for validation**
   - What we know: Need to run `next build` on modified code before PR
   - What's unclear: Typical build time for medium-size Next.js sites? Is 5-min timeout reasonable?
   - Recommendation: During implementation, test build time on 2-3 real client sites. Adjust timeout and handle timeouts gracefully.

5. **LLM code generation quality for Next.js TypeScript**
   - What we know: Claude is trained on TypeScript and Next.js patterns
   - What's unclear: Actual quality on complex fixes (heading structure, component updates)? Hallucinations?
   - Recommendation: During planning, create test harness. Generate fixes for 5-10 sample issues. Have operator review quality before Phase 2 launch.

---

## Sources

### Primary (HIGH confidence)

- **Phase 1 Codebase** (`src/portkey/client.ts`, `src/executor/github.ts`, `src/auditor/rules.ts`) — Portkey client pattern, GitHub PR workflow, audit rules structure
- **.planning/research/SUMMARY.md, STACK.md, PITFALLS.md** — Stack recommendations, architecture patterns, critical pitfalls from Phase 1 research
- **.planning/phases/02-auto-fix-content-strategy/02-CONTEXT.md** — Locked decisions on code generation, PR structure, risk classification
- **ROADMAP.md Phase 2 Success Criteria** — Build validation, keyword filtering, PR descriptions
- **Next.js Official Docs** ([https://nextjs.org/docs/app/guides/production-checklist](https://nextjs.org/docs/app/guides/production-checklist), [https://nextjs.org/docs/app/guides/json-ld](https://nextjs.org/docs/app/guides/json-ld)) — Build validation patterns, JSON-LD structure

### Secondary (MEDIUM confidence)

- [Google Search Console API: Beginner's Guide](https://www.positional.com/blog/google-search-console-api) — GSC query patterns, rate limiting (2,000/day)
- [GitHub - fusebit/google-searchconsole-nodejs](https://github.com/fusebit/google-searchconsole-nodejs) — Node.js GSC SDK patterns
- [Implementing Retry Mechanisms for LLM Calls](https://apxml.com/courses/prompt-engineering-llm-application-development/chapter-7-output-parsing-validation-reliability/implementing-retry-mechanisms) — Exponential backoff with jitter
- [schemaorg-jsd npm](https://www.npmjs.com/package/schemaorg-jsd) — Schema.org validation library (note: last update 5 years ago)
- [Ajv JSON schema validator](https://ajv.js.org/) — Alternative JSON schema validation (more actively maintained)

### Tertiary (LOW confidence)

- WebSearch results on "Claude API code generation" — General patterns, not project-specific
- WebSearch results on "Next.js build validation" — Best practices, may vary by Next.js version
- Medium articles on "LLM error handling" — Concepts validated against phase pitfalls research

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase 1 proven (Portkey, Octokit, Cheerio). Google Cloud SDKs official. simple-git stable.
- Architecture patterns: MEDIUM-HIGH — Batch-per-file and build validation patterns from CONTEXT.md locked decisions. Risk categorization strategy clear. Caching/backoff patterns research-backed but integration-specific.
- Pitfalls: MEDIUM-HIGH — Critical pitfalls identified (code validation, quota exhaustion, schema validation). Prevention strategies clear. Some require integration-time validation (actual LLM quality, Portkey SDK stability).

**Research date:** 2026-03-21
**Valid until:** 2026-04-18 (28 days — Phase 2 domain is moderately fast-moving; Portkey SDK updates, Google API changes possible)

---

*Research completed: 2026-03-21*
*Synthesized from: Phase 1 codebase, CONTEXT.md decisions, ROADMAP.md success criteria, official docs (Next.js, Google), WebSearch (LLM patterns, API integration)*
*Ready for planning: yes*

# Phase 1: Core Audit Discovery & PR Workflow - Research

**Researched:** 2026-03-21
**Domain:** Autonomous Next.js site crawling, SEO issue detection, and GitHub PR reporting
**Confidence:** MEDIUM-HIGH

## Summary

Phase 1 validates the foundational "autonomous agent → GitHub PR" workflow with low-risk detection only. This phase focuses on crawling Next.js sites, detecting on-page and technical SEO issues, retrieving Core Web Vitals from PageSpeed Insights, and reporting findings as structured GitHub pull requests. No code generation or content creation occurs in Phase 1—only analysis and reporting.

The technical challenge is not the stack (Node.js 20 + TypeScript is mature and proven) but rather the **operational constraints**: respecting Google API quotas, preventing secrets leakage, and handling complex Next.js routing without breaking crawling or analysis. Research shows the ecosystem has solid libraries for all these concerns; success depends on careful integration patterns and safety checks before PR submission.

**Primary recommendation:** Use Node.js 20 LTS + TypeScript with Yargs CLI, Cheerio for HTML parsing, official Google SDKs for PageSpeed/Search Console, and Octokit for GitHub operations. Structure as a modular pipeline (Discovery → Analysis → Execution) with explicit checkpoints and state persistence between phases. This prevents costly re-crawling on failures and enables independent testing of each component.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**PR Structure:**
- One PR per site per audit run — single PR contains all findings for that site's audit cycle
- No files committed to the client repo — findings appear only in the PR body/description
- Branch naming: `seo-audit/YYYY-MM-DD` (date-based, sortable, avoids conflicts)
- PR description format: executive summary (pass/fail counts, critical issues) followed by a detailed table of all findings with severity, page URL, and description

### Claude's Discretion

- Audit report format within the PR body (exact Markdown structure, table columns, grouping)
- Crawling behavior (max depth, page limits, robots.txt handling, sitemap usage)
- Site configuration format and credential management approach
- Severity classification system for issues
- Core Web Vitals presentation within the PR
- Error handling and retry logic for crawling and API calls

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUDIT-01 | Agent crawls Next.js site and detects missing/duplicate title tags | Cheerio HTML parser extracts `<title>` elements; Inventory Builder catalogs pages; SEO Auditor applies rules-based checks for presence and duplication |
| AUDIT-02 | Agent detects missing/duplicate meta descriptions | Cheerio extracts `<meta name="description">` content; SEO Auditor validates presence, length (150-160 chars), and deduplication across site |
| AUDIT-03 | Agent detects missing Open Graph tags | Cheerio extracts `<meta property="og:*">` tags; SEO Auditor validates presence for critical tags (og:title, og:description, og:image) |
| AUDIT-04 | Agent detects broken internal links | Crawler fetches and tracks HTTP status for all internal links; records 404/500 errors with source page and target URL |
| AUDIT-05 | Agent detects redirect chains and loops | Crawler follows redirects and records chain length; detects loops (A→B→A) and chains >2 hops; logs with severity |
| AUDIT-06 | Agent detects duplicate content across pages | Parser extracts text content; Inventory Builder compares word-frequency hashes or exact text blocks across pages; flags near-duplicates |
| AUDIT-07 | Agent detects missing or malformed canonical tags | Cheerio extracts `<link rel="canonical">` tag; SEO Auditor validates presence, proper URL format, and self-reference correctness |
| AUDIT-08 | Agent validates heading hierarchy (H1-H6 structure) | Cheerio extracts all headings; SEO Auditor checks for H1 presence, proper nesting (no H3 without H2), and multiple H1s |
| AUDIT-09 | Agent detects missing image alt attributes | Cheerio extracts `<img>` tags; SEO Auditor flags images without `alt` attribute or with empty `alt=""` |
| AUDIT-10 | Agent detects crawl errors (404s, 500s) | Crawler records HTTP responses; SEO Auditor categorizes by status code (404 = missing page, 500 = server error, timeout = unreachable) |
| INFRA-01 | CLI tool with commands for audit, fix, and content generation | Yargs CLI framework with subcommands: `audit`, `fix` (Phase 2), `content` (Phase 3); manual invocation and cron scheduling via node-cron |
| INFRA-02 | Portkey integration for flexible AI model selection | Portkey SDK initialized with API key from env; Routes LLM requests (Phase 2+) without hardcoding provider; Currently passive in Phase 1 |
| INFRA-03 | Google Search Console API integration for SEO data | Google Cloud Search Console SDK; Phase 1 uses PageSpeed Insights; Search Console data for Phase 2+ keyword research |
| INFRA-04 | GitHub API integration for PR creation and branch management | Octokit REST client; creates branches with `seo-audit/YYYY-MM-DD` naming; commits audit findings; opens PRs with formatted descriptions |
| INFRA-05 | Site configuration file for specifying client repo details | JSON or YAML config format (TBD in discretion); loads GitHub URLs, API credentials, crawl limits; processes sites in sequence with isolation |

</phase_requirements>

---

## Standard Stack

### Core Runtime
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Node.js** | 20.x LTS | JavaScript runtime | Mature LTS, ESM-native, stable through April 2026. Standard for production CLI tools. |
| **TypeScript** | 5.3+ | Type safety | Catches bugs at compile time, improves IDE support for API integrations. |
| **tsx** | 4.x | TS execution | Drop-in `ts-node` replacement; faster, better ESM support for dev and production. |

### CLI & Orchestration
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Yargs** | 17.x | CLI argument parsing | Industry standard for Node.js CLI tools. Clear subcommand composition. Used by Next.js, Yarn, major OSS. |
| **node-cron** | 3.0.3+ | Scheduled execution | Lightweight cron-style scheduling. No external service dependency. Simple API for monthly runs. |

### GitHub Integration
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **@octokit/rest** | 20.x | GitHub API client | Official Octokit SDK. Type-safe, maintained by GitHub. Handles branch creation, commits, PR submission. |

### Google APIs
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **@google-cloud/pagespeed-insights** | Latest | PageSpeed Insights API | Official Google SDK. Core Web Vitals metrics. OAuth2-compliant, maintained by Google. |
| **@google-cloud/search-console** | Latest | Search Console API | Official Google SDK. For Phase 2+ keyword research; included for completeness. |
| **google-auth-library-nodejs** | 9.x+ | OAuth2 authentication | Handles Google credential flow. Service account JSON or OAuth2 tokens. Standard across Google SDKs. |

### HTML Parsing & Crawling
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **cheerio** | 1.0+ | HTML parsing | Fast, jQuery-like syntax. Parses Next.js markup for meta tags, headings, links, alt text. No browser overhead. |
| **node-fetch** | 3.x | HTTP client | Lightweight fetch implementation. Crawls site pages, respects standard HTTP semantics. |

### Utilities & Validation
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **zod** | 3.22+ | Runtime type validation | Validate API responses (Google APIs, GitHub, Portkey). Lightweight, no transpilation. |
| **dotenv** | 16.x | Environment variables | Load `.env` and `.env.local` safely. Standard for API keys, credentials, site configs. |
| **pino** | 8.x | Structured logging | Fast, lightweight logging. Critical for observability in cron jobs (no console access during scheduled runs). |

### Testing
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Vitest** | 1.x | Unit & integration tests | Vite ecosystem, ESM-native, faster than Jest. Works seamlessly with TypeScript. |

### Installation

```bash
# Core dependencies
npm install \
  yargs \
  node-cron \
  @octokit/rest \
  @google-cloud/pagespeed-insights \
  @google-cloud/search-console \
  google-auth-library-nodejs \
  cheerio \
  node-fetch \
  zod \
  dotenv \
  pino

# TypeScript & dev dependencies
npm install -D \
  typescript \
  tsx \
  vitest \
  @types/node \
  @types/cheerio
```

### Version Verification

Before Phase 1 planning starts, verify current versions:

```bash
npm view yargs version
npm view node-cron version
npm view @octokit/rest version
npm view cheerio version
npm view @google-cloud/pagespeed-insights version
```

Document verified versions and publish dates to ensure Phase 1 locks to stable releases.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── cli/               # CLI entry point (Yargs)
│   └── commands/      # Subcommands: audit, fix (Phase 2), content (Phase 3)
├── crawler/           # Discovery phase (fetch & parse)
├── parser/            # Extract structured data from HTML
├── auditor/           # Analysis phase (apply SEO rules)
├── fetcher/           # Data Fetcher (Google APIs)
├── decision/          # Decision Engine (priority, categorization) — Phase 2
├── executor/          # Execution phase (PR submission, git ops)
├── config/            # Config Manager (load site configs, validate)
├── types/             # Shared TypeScript interfaces
├── utils/             # Helpers (logging, validation, state)
└── index.ts           # Orchestrator (main pipeline)
```

### Pattern 1: Modular Pipeline with Checkpoints

**What:** Divide work into discrete phases (Discovery → Analysis → Execution). Each phase produces concrete output that's persisted before moving to next.

**When:** Processing data through multiple transformation stages where failures in later stages shouldn't require re-running expensive early stages.

**Example for Phase 1:**
```typescript
// Orchestrator: coordinates pipeline with state checkpoints
async function runAudit(siteConfig: SiteConfig): Promise<AuditResult> {
  // Phase 1: Discovery (expensive—crawling)
  const inventory = await crawler.crawl(siteConfig.url);
  await state.saveCrawlState(siteConfig.id, inventory);

  // Phase 2: Analysis (medium cost—API calls)
  const issues = await auditor.audit(inventory);
  const vitals = await fetcher.getPageSpeedData(siteConfig.url);
  await state.saveAnalysisState(siteConfig.id, { issues, vitals });

  // Phase 3: Execution (medium cost—PR creation)
  const prUrl = await executor.createPR(siteConfig, { issues, vitals });

  return { inventory, issues, vitals, prUrl };
}
```

**Benefit:** If PR creation fails, you don't re-crawl. If Google API fails, you don't re-parse. Each component is independently testable.

### Pattern 2: Abstraction Layer for External Services

**What:** Use interface-based abstractions for GitHub, Google APIs, crawling. Implementations are swappable.

**When:** You want to test without real API calls, or swap implementations (Cheerio → Playwright, GitHub REST → GraphQL).

**Example:**
```typescript
// Abstractions
interface Crawler {
  crawl(url: string, options: CrawlOptions): Promise<Page[]>;
}

interface IssueDetector {
  audit(pages: Page[]): Promise<Issue[]>;
}

interface RepositoryManager {
  createBranch(repo: string, name: string): Promise<void>;
  commitChanges(repo: string, files: FileChange[]): Promise<void>;
  createPR(repo: string, branch: string, title: string, body: string): Promise<string>;
}

// Implementations
class CheerioHTMLCrawler implements Crawler { ... }
class RulesBasedAuditor implements IssueDetector { ... }
class OctokitRepositoryManager implements RepositoryManager { ... }
```

**Benefit:** Easy to test with mocks, swap Cheerio for Playwright without changing pipeline, change GitHub REST to GraphQL later.

### Pattern 3: Idempotent State Tracking

**What:** Track execution state (which PRs created, which sites completed) so reruns don't duplicate work.

**When:** Running batch processes that might fail partway and need resuming, or running repeatedly on schedule.

**Example:**
```typescript
interface AuditRunState {
  siteId: string;
  runDate: string;
  crawlState: { status: 'complete' | 'failed'; pageCount: number };
  analysisState: { status: 'complete' | 'failed'; issueCount: number };
  executionState: { status: 'complete' | 'failed'; prUrl?: string; prCreatedAt?: Date };
}

// Before creating PR, check if we already did it for this site/date
async function createPRIfNeeded(siteId: string, runDate: string, findings: Findings): Promise<string | null> {
  const previousRun = await state.getLastRun(siteId);
  if (previousRun?.runDate === runDate && previousRun.executionState.prUrl) {
    console.log(`PR already created for ${siteId} on ${runDate}: ${previousRun.executionState.prUrl}`);
    return null; // skip duplicate
  }
  return await executor.createPR(siteId, findings);
}
```

**Benefit:** Monthly cron runs don't create duplicate PRs. Failed runs can be resumed cleanly.

### Pattern 4: Config-Driven Site Management

**What:** Load all site configs from a single file; process each site sequentially with isolated state.

**When:** Managing multiple client sites with different credentials, URLs, and crawl parameters.

**Example:**
```typescript
interface SiteConfig {
  siteId: string;
  url: string;
  gitHubRepo: string;
  crawlLimits: { maxPages: number; maxDepth: number };
  googleCredentials: { serviceAccountPath: string }; // path to secrets
}

interface Config {
  sites: SiteConfig[];
  schedule: { cronExpression: string }; // "0 0 1 * * *" = 1st of month
}

// Load once, process each site in isolation
const config = await configManager.load('./config.json');
for (const site of config.sites) {
  const result = await runAudit(site);
  await state.logCompletion(site.siteId, result);
}
```

**Benefit:** Easy to add/remove sites, configure per-site crawl limits, credentials isolated from code.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML parsing, meta tag extraction | Custom regex/string parsing | Cheerio 1.0+ | Handles broken HTML, nested structures, entities. Regex is fragile and brittle. |
| HTTP crawling with redirects | Basic fetch loop | node-fetch 3.x + (wrap with redirect tracking) | node-fetch handles HTTP spec correctly. Custom code misses edge cases (cookies, redirects, timeouts). |
| GitHub branch/PR creation | Raw git CLI calls | @octokit/rest 20.x | Handles authentication, API errors, rate limiting. git CLI doesn't. GitHub API is well-specified; Octokit is battle-tested. |
| Google API authentication | Manual OAuth2 flow | google-auth-library-nodejs 9.x+ | OAuth2 is complex (token refresh, scopes, service accounts). Use official library. |
| PageSpeed Insights integration | Manual fetch + JSON parsing | @google-cloud/pagespeed-insights | API schema can change. Official SDK handles versioning and breaking changes. |
| CLI argument parsing | Manual `process.argv` | Yargs 17.x | Handles help text, subcommands, type coercion, validation. Manual parsing is tedious and error-prone. |
| Cron scheduling | Manual setInterval or node scripts | node-cron 3.0+ | Cron expressions are standard; node-cron handles edge cases (DST, missed runs, concurrent execution). |
| Runtime type validation | Manual `if (typeof x === '...')` checks | zod 3.22+ | Zod provides declarative schema validation, human-readable error messages, and composability. Manual checks don't scale. |

**Key insight:** Phase 1's value is in the business logic (crawling strategy, issue detection, PR quality), not in reimplementing standard protocols. Use proven libraries for HTTP, parsing, APIs, scheduling.

---

## Common Pitfalls

### Pitfall 1: Google API Quota Exhaustion

**What goes wrong:**
Monthly runs fail silently when Google APIs (PageSpeed Insights, Search Console) hit rate limits or quota exhaustion. Subsequent audits can't fetch Core Web Vitals data, so findings are incomplete.

**Why it happens:**
- No quota pre-flight check before starting audit
- Inefficient queries (e.g., fetching 30 days of data when only 1 day needed)
- No caching of repeat API calls
- Concurrent requests without backoff on 429/quota responses
- No monitoring of quota remaining

**How to avoid:**
- **Before Phase 1 launch:** Document actual quota limits for PageSpeed Insights and Search Console in Google Cloud Console
- **Pre-audit check:** Verify available quota at start of run; fail gracefully if insufficient
- **Response caching:** Cache PageSpeed and Search Console responses for 24-48 hours to avoid repeat queries
- **Exponential backoff:** If 429 response, wait 1s, then 2s, then 4s... up to 60s before retry
- **Quota logging:** After each API call, log quota remaining; alert when <20% remains
- **Request budget:** Per site, limit to 5 API requests per audit cycle (ordered by impact)
- **Fallback mode:** If quota exceeded, use cached data or mark as "needs manual review" instead of failing silently

**Warning signs:**
- API responses returning empty data or HTTP 403 (quota exhausted)
- Logs showing "request failed" with no retry or backoff
- Monthly runs completing but PRs missing Core Web Vitals section
- Google Cloud Console showing quota nearly exhausted

### Pitfall 2: Crawling Breaks on Complex Next.js Sites

**What goes wrong:**
Crawler gets stuck in redirect loops, misses dynamically-rendered content, or times out on slow API routes. Analysis phase can't complete because page discovery failed.

**Why it happens:**
- No loop detection in redirect following
- Next.js middleware redirects (rewrite rules) not handled
- Client-side rendered content not accessible to Cheerio
- Missing timeout/max depth limits (infinite crawl on misconfigured sites)
- No robots.txt or sitemap.xml parsing (crawling disallowed pages)

**How to avoid:**
- **Redirect loop detection:** Track redirect chain (A→B→C→A) and break at length > 5 or cycles detected
- **Max depth limit:** Default to 3 hops; configurable per site. Prevents infinite crawl.
- **Max page limit:** Default to 500 pages; abort if exceeded
- **Timeout per page:** 30s fetch timeout per page; skip unresponsive pages
- **robots.txt parsing:** Read and respect `Disallow` rules before crawling
- **Sitemap.xml parsing:** If available, use as crawl seed instead of depth-first traversal
- **Start URL validation:** Verify root URL responds before crawling

**Warning signs:**
- Crawler hangs or takes >5 minutes on a single site
- Memory usage grows unbounded during crawl
- Logs showing "max redirects exceeded" or "circular redirect detected"
- Crawl completes but page count is suspiciously low or extremely high

### Pitfall 3: Secrets Leakage in PR Body

**What goes wrong:**
PR description accidentally includes API keys, GitHub tokens, or credentials in logs, error messages, or debug output. Visible to all repo collaborators; indexed by GitHub.

**Why it happens:**
- Error messages containing full API responses (may include tokens)
- Debug logging of config objects (may contain credentials)
- Unfiltered output in PR body from audit logs
- No sanitization of user input (site config) before logging

**How to avoid:**
- **Config validation:** Load secrets from `.env.local` (gitignored), not config file
- **Log filtering:** Create logger wrapper that redacts known secret patterns (API keys, tokens) before output
- **Error message sanitization:** Catch API errors and return clean message without details
- **Dry-run preview:** Before PR submission, show PR diff in logs; operator reviews before commit
- **Secrets detection tool:** Run `git-secrets` or `detect-secrets` on PR diff before submission

**Warning signs:**
- PR description contains `GOOGLE_APPLICATION_CREDENTIALS`, `GITHUB_TOKEN`, or API key patterns
- GitHub security scanning flags PR as containing exposed secrets
- Config file committed to repo with actual credentials
- Error logs visible in PR showing raw API responses

### Pitfall 4: PR Created with Missing or Malformed Findings

**What goes wrong:**
PR body is empty, malformed, or missing critical data (issues table, Core Web Vitals). PR exists but findings are unreadable or incomplete, making manual review impossible.

**Why it happens:**
- PR generation logic doesn't handle edge cases (no issues found, malformed table markdown)
- Audit findings not validated before PR submission
- GitHub markdown rendering breaks on certain characters or structures
- PR title/description length limits exceeded

**How to avoid:**
- **Findings validation:** Before PR submission, validate findings structure (minimum fields, required sections)
- **Markdown formatting:** Use markdown linting or preview before committing PR body
- **Fallback content:** If no issues found, create "clean audit" PR with summary rather than empty PR
- **Character escaping:** Escape special characters in findings (backticks, pipes, brackets) before markdown rendering
- **PR size limits:** If findings exceed GitHub's limits (65536 characters), split into multiple PRs or link to external document

**Warning signs:**
- PR renders with formatting errors (tables broken, links malformed)
- PR description is empty or just says "Audit complete"
- GitHub renders PR with syntax errors
- Manual review required because findings are unreadable

### Pitfall 5: Site Configuration Management and Credential Leakage

**What goes wrong:**
Site configs are not isolated; credentials from one site leak into another's audit, or config file is accidentally committed with secrets.

**Why it happens:**
- Global state shared across site processing
- Credentials embedded directly in config file (JSON with plaintext keys)
- Config file not in `.gitignore`
- Insufficient validation of per-site isolation

**How to avoid:**
- **Config file in .gitignore:** Never commit `config.json` or `sites.yml` with real credentials
- **Environment variable injection:** Load site configs from file, but inject credentials from `.env.local` separately
- **Per-site state isolation:** Each site gets its own state object; no cross-site data sharing
- **Validate site isolation:** In tests, verify that auditing site A doesn't affect site B's findings
- **Credential validation:** Before processing site, verify credentials are valid for that specific site (e.g., GitHub token has access to that repo)

**Warning signs:**
- Config file with plaintext API keys found in git history
- Audit of site A includes findings from site B (cross-site data leak)
- CI/CD logs showing raw credentials from config file
- "Permission denied" errors when accessing wrong GitHub repo (indicates credential mixing)

---

## Code Examples

### Example 1: Crawling a Site with Redirect Loop Detection

Source: Modeled after Cheerio + node-fetch patterns; see STACK.md for library details.

```typescript
interface CrawlResult {
  url: string;
  status: number;
  html: string;
  redirectChain: string[]; // [A, B, C] = redirects A→B→C
}

interface CrawlOptions {
  maxDepth: number;
  maxPages: number;
  timeoutMs: number;
}

async function fetchWithRedirectTracking(url: string, maxRedirects: number = 5): Promise<CrawlResult> {
  const redirectChain: string[] = [url];
  let currentUrl = url;
  let response;

  for (let i = 0; i < maxRedirects; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      response = await fetch(currentUrl, {
        redirect: 'manual', // handle redirects manually to track chain
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        const nextUrl = new URL(response.headers.get('location')!, currentUrl).toString();

        // Detect redirect loop: if next URL already in chain, abort
        if (redirectChain.includes(nextUrl)) {
          throw new Error(`Redirect loop detected: ${redirectChain.join(' → ')} → ${nextUrl}`);
        }

        redirectChain.push(nextUrl);
        currentUrl = nextUrl;
      } else {
        // Not a redirect, process response
        const html = await response.text();
        return { url, status: response.status, html, redirectChain };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Timeout fetching ${currentUrl} after 30s`);
      }
      throw error;
    }
  }

  throw new Error(`Too many redirects: ${redirectChain.join(' → ')}`);
}
```

### Example 2: Parsing Meta Tags and Detecting Issues

Source: Cheerio 1.0+ API; see ARCHITECTURE.md for Parser component.

```typescript
interface PageData {
  url: string;
  title: string;
  metaDescription: string;
  openGraphTags: Record<string, string>;
  canonicalUrl?: string;
  images: Array<{ src: string; alt?: string }>;
  headings: Array<{ level: number; text: string }>;
  internalLinks: string[];
}

function parsePageHTML(html: string, pageUrl: string): PageData {
  const $ = cheerio.load(html);
  const baseUrl = new URL(pageUrl).origin;

  // Extract meta tags
  const title = $('title').text().trim();
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';

  const openGraphTags: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const property = $(el).attr('property')!;
    const content = $(el).attr('content')!;
    openGraphTags[property] = content;
  });

  const canonicalUrl = $('link[rel="canonical"]').attr('href');

  // Extract images with alt text
  const images = $('img')
    .map((_, el) => ({
      src: $(el).attr('src') || '',
      alt: $(el).attr('alt'),
    }))
    .get();

  // Extract heading structure
  const headings = $('h1, h2, h3, h4, h5, h6')
    .map((_, el) => ({
      level: parseInt(el.name[1], 10),
      text: $(el).text().trim(),
    }))
    .get();

  // Extract internal links
  const internalLinks = $('a[href]')
    .map((_, el) => {
      const href = $(el).attr('href') || '';
      try {
        const absoluteUrl = new URL(href, pageUrl).toString();
        return absoluteUrl.startsWith(baseUrl) ? absoluteUrl : null;
      } catch {
        return null; // invalid URL
      }
    })
    .get()
    .filter((url): url is string => url !== null);

  return {
    url: pageUrl,
    title,
    metaDescription,
    openGraphTags,
    canonicalUrl,
    images,
    headings,
    internalLinks: [...new Set(internalLinks)], // deduplicate
  };
}
```

### Example 3: SEO Rules-Based Auditor

Source: Pattern from ARCHITECTURE.md; implements IssueDetector interface.

```typescript
interface AuditIssue {
  type: string; // 'missing_title', 'short_description', etc.
  severity: 'critical' | 'high' | 'medium' | 'low';
  page: string;
  description: string;
  suggestedFix?: string;
}

class RulesBasedAuditor {
  audit(pages: PageData[]): AuditIssue[] {
    const issues: AuditIssue[] = [];

    // Track duplicates across site
    const titlesByPage = new Map(pages.map(p => [p.url, p.title]));
    const descByPage = new Map(pages.map(p => [p.url, p.metaDescription]));

    for (const page of pages) {
      // AUDIT-01: Missing/duplicate title tags
      if (!page.title) {
        issues.push({
          type: 'missing_title',
          severity: 'critical',
          page: page.url,
          description: 'Page missing <title> tag',
          suggestedFix: 'Add unique title (50-60 characters) to page head',
        });
      } else if (page.title.length < 30) {
        issues.push({
          type: 'short_title',
          severity: 'medium',
          page: page.url,
          description: `Page title too short: "${page.title}" (${page.title.length} chars)`,
          suggestedFix: 'Expand title to 50-60 characters for better CTR',
        });
      }

      // Check for duplicate titles across site
      for (const [otherUrl, otherTitle] of titlesByPage) {
        if (otherUrl !== page.url && otherTitle === page.title) {
          issues.push({
            type: 'duplicate_title',
            severity: 'high',
            page: page.url,
            description: `Duplicate title found on ${otherUrl}`,
            suggestedFix: 'Make each page title unique across site',
          });
          break;
        }
      }

      // AUDIT-02: Missing/short meta description
      if (!page.metaDescription) {
        issues.push({
          type: 'missing_meta_description',
          severity: 'high',
          page: page.url,
          description: 'Page missing meta description',
          suggestedFix: 'Add meta description (150-160 characters)',
        });
      } else if (page.metaDescription.length < 120) {
        issues.push({
          type: 'short_meta_description',
          severity: 'medium',
          page: page.url,
          description: `Meta description too short: ${page.metaDescription.length} chars`,
          suggestedFix: 'Expand to 150-160 characters for full SERP display',
        });
      }

      // AUDIT-03: Missing Open Graph tags
      if (!page.openGraphTags['og:title']) {
        issues.push({
          type: 'missing_og_title',
          severity: 'medium',
          page: page.url,
          description: 'Missing og:title tag (affects social sharing)',
          suggestedFix: 'Add <meta property="og:title" content="...">',
        });
      }

      // AUDIT-08: Heading hierarchy
      const headingLevels = page.headings.map(h => h.level);
      const hasH1 = headingLevels.includes(1);
      if (!hasH1) {
        issues.push({
          type: 'missing_h1',
          severity: 'critical',
          page: page.url,
          description: 'Page missing H1 heading',
          suggestedFix: 'Add exactly one H1 heading per page',
        });
      }
      if (headingLevels.filter(l => l === 1).length > 1) {
        issues.push({
          type: 'multiple_h1',
          severity: 'high',
          page: page.url,
          description: `Page has ${headingLevels.filter(l => l === 1).length} H1 tags (best practice: 1)`,
          suggestedFix: 'Reduce to single H1; use H2/H3 for subheadings',
        });
      }

      // AUDIT-09: Missing image alt text
      for (const img of page.images) {
        if (!img.alt || img.alt.trim() === '') {
          issues.push({
            type: 'missing_alt_text',
            severity: 'high',
            page: page.url,
            description: `Image missing alt text: ${img.src}`,
            suggestedFix: 'Add descriptive alt attribute (include target keyword if relevant)',
          });
        }
      }
    }

    return issues;
  }
}
```

### Example 4: GitHub PR Creation with Findings

Source: Octokit REST API pattern; see EXECUTOR component in ARCHITECTURE.md.

```typescript
async function createAuditPR(
  octokit: ReturnType<typeof Octokit>,
  repo: { owner: string; repo: string },
  findings: { issues: AuditIssue[]; vitals: CoreWebVitals },
): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const branchName = `seo-audit/${dateStr}`;

  // 1. Get latest commit SHA to base branch off
  const { data: refData } = await octokit.rest.git.getRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: 'heads/main',
  });
  const baseSha = refData.object.sha;

  // 2. Create branch
  await octokit.rest.git.createRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  // 3. Format audit findings as markdown table
  const issuesTable = formatIssuesAsMarkdownTable(findings.issues);
  const vitalsSection = formatCoreWebVitals(findings.vitals);

  const prBody = `
## SEO Audit Report — ${dateStr}

### Summary
- **Critical Issues:** ${findings.issues.filter(i => i.severity === 'critical').length}
- **High Priority:** ${findings.issues.filter(i => i.severity === 'high').length}
- **Medium:** ${findings.issues.filter(i => i.severity === 'medium').length}
- **Low:** ${findings.issues.filter(i => i.severity === 'low').length}

### Core Web Vitals
${vitalsSection}

### Detailed Findings
${issuesTable}

---
*Generated by SEO Agent on ${new Date().toISOString()}*
*No files modified — findings only. Review and take action as needed.*
`;

  // 4. Create PR
  const { data: pr } = await octokit.rest.pulls.create({
    owner: repo.owner,
    repo: repo.repo,
    title: `[SEO Audit] ${dateStr}`,
    head: branchName,
    base: 'main',
    body: prBody,
    draft: true, // Start as draft for review
  });

  return pr.html_url;
}

function formatIssuesAsMarkdownTable(issues: AuditIssue[]): string {
  const rows = issues
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .map(
      issue =>
        `| ${issue.severity.toUpperCase()} | ${issue.type} | ${issue.page} | ${issue.description} |`,
    );

  return `
| Severity | Issue Type | Page | Description |
|----------|-----------|------|-------------|
${rows.join('\n')}
`;
}

function formatCoreWebVitals(vitals: CoreWebVitals): string {
  return `
- **LCP** (Largest Contentful Paint): ${vitals.lcp}ms ${vitals.lcp < 2500 ? '✅' : '⚠️'}
- **FID** (First Input Delay): ${vitals.fid}ms ${vitals.fid < 100 ? '✅' : '⚠️'}
- **CLS** (Cumulative Layout Shift): ${vitals.cls} ${vitals.cls < 0.1 ? '✅' : '⚠️'}
`;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual SEO audits (spreadsheets, screenshots) | Automated crawl + rules-based detection + PR workflow | 2020-2023 SEO tool evolution | Consistency, speed, auditability |
| Using Puppeteer for all crawling | Cheerio for static content, Playwright for JS-heavy sites | 2021-2025 browser automation maturity | Cheerio is 10x faster; Playwright has better maintenance |
| CommonJS + `require()` for CLI tools | ESM + `import` statements in Node.js 20 LTS | 2023 Node.js standardization | Better tree-shaking, faster startup, ecosystem alignment |
| Jest for CLI testing | Vitest + Node 20 native test runner | 2023-2025 ESM-first testing | Vitest startup 50x faster, better TS support |
| Manual cron jobs (bash scripts) | node-cron or scheduled cloud functions | 2020-present DevOps standardization | Version control, error handling, observability |

**Deprecated/outdated:**
- **Selenium for web scraping** — Replaced by Puppeteer (2017), then Playwright (2019+). Maintenance burden, poor error handling.
- **Bull queue for task scheduling** — Overkill for <10 sites, monthly runs. node-cron sufficient; adds Redis dependency with no benefit at this scale.
- **GraphQL for simple GitHub operations** — REST API sufficient for PR creation. GraphQL adds complexity for Phase 1.
- **Firebase for state storage** — Use JSON files in git or S3 for Phase 1 (simple). Database later if scale increases.

---

## Open Questions

### Question 1: Exact Google API Quota Limits

**What we know:**
- Google provides free tier for PageSpeed Insights and Search Console APIs
- Quotas exist but exact limits are not clearly documented in public Google docs

**What's unclear:**
- Exact number of requests per month allowed on free tier
- Whether free tier quota is per-API or shared
- Behavior when quota exhausted (hard fail vs rate limiting)

**Recommendation:**
- **Action before Phase 1 launch:** Log into Google Cloud Console, navigate to PageSpeed Insights API and Search Console API, document actual quota limits visible in Dashboard
- **Implementation:** Create quota.json file with documented limits; fail audit if insufficient quota available at start

### Question 2: Cheerio vs Playwright for Phase 1

**What we know:**
- Cheerio is fast (no browser) but doesn't execute JavaScript
- Most Next.js pages are server-rendered, so Cheerio should work
- Playwright is slower but handles dynamic content

**What's unclear:**
- Will test sites have significantly JS-rendered content that Cheerio misses?
- Performance impact of using Playwright instead (crawl time, memory)

**Recommendation:**
- **Phase 1 scope:** Use Cheerio for MVP. Test on actual client sites during Phase 1
- **Fallback to Phase 2:** If discovery shows sites need JS rendering, implement Playwright as Phase 2 addition
- **No risk:** Cheerio and Playwright can coexist; easy to switch per-site or add adaptive logic

### Question 3: PR Report Format and Markdown Rendering

**What we know:**
- PR body supports markdown
- GitHub has limits on PR body size (65536 characters)
- Markdown rendering can break on certain characters

**What's unclear:**
- Exact markdown syntax that GitHub prefers for tables
- How to handle findings if they exceed PR size limit
- Whether to include raw JSON or human-readable markdown

**Recommendation:**
- **Phase 1 approach:** Use human-readable markdown tables (see Example 4 above)
- **Validation:** Render markdown locally; verify table syntax before submission
- **Fallback:** If findings exceed size limit, split into multiple PRs or link to external document (gist)

### Question 4: Portkey SDK Requirements for Phase 1

**What we know:**
- Portkey is a hard constraint from PROJECT.md
- Phase 1 doesn't generate code (no LLM needed yet)
- Phase 2 will use Portkey heavily

**What's unclear:**
- Whether to initialize Portkey in Phase 1 (no usage) or defer to Phase 2
- Portkey SDK version and TypeScript type availability

**Recommendation:**
- **Phase 1 scope:** Initialize Portkey client but don't use it (prepare infrastructure)
- **Before Phase 1 planning:** Verify @portkey-ai/portkey-node latest version has TypeScript types and all required methods
- **Phase 2 pickup:** All LLM calls already routed through Portkey from Phase 1

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.x with Node 20.9+ native `test` module |
| Config file | `vitest.config.ts` (minimal config for ESM) |
| Quick run command | `vitest run --reporter=verbose src/**/*.test.ts` |
| Full suite command | `vitest run` (runs all tests with coverage) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-01 | Detects missing title tags | unit | `vitest run src/auditor/auditor.test.ts -t "missing title"` | ❌ Wave 0 |
| AUDIT-01 | Detects duplicate title tags | unit | `vitest run src/auditor/auditor.test.ts -t "duplicate title"` | ❌ Wave 0 |
| AUDIT-02 | Detects missing meta description | unit | `vitest run src/auditor/auditor.test.ts -t "missing description"` | ❌ Wave 0 |
| AUDIT-03 | Detects missing OG tags | unit | `vitest run src/auditor/auditor.test.ts -t "open graph"` | ❌ Wave 0 |
| AUDIT-04 | Detects broken internal links | integration | `vitest run src/crawler/crawler.test.ts -t "broken links"` | ❌ Wave 0 |
| AUDIT-05 | Detects redirect chains and loops | integration | `vitest run src/crawler/crawler.test.ts -t "redirect"` | ❌ Wave 0 |
| AUDIT-06 | Detects duplicate content | unit | `vitest run src/auditor/auditor.test.ts -t "duplicate content"` | ❌ Wave 0 |
| AUDIT-07 | Detects missing canonical tags | unit | `vitest run src/auditor/auditor.test.ts -t "canonical"` | ❌ Wave 0 |
| AUDIT-08 | Validates heading hierarchy | unit | `vitest run src/auditor/auditor.test.ts -t "heading"` | ❌ Wave 0 |
| AUDIT-09 | Detects missing alt attributes | unit | `vitest run src/auditor/auditor.test.ts -t "alt text"` | ❌ Wave 0 |
| AUDIT-10 | Detects crawl errors (404, 500) | integration | `vitest run src/crawler/crawler.test.ts -t "crawl errors"` | ❌ Wave 0 |
| INFRA-01 | CLI commands exist and parse | unit | `vitest run src/cli/cli.test.ts -t "yargs"` | ❌ Wave 0 |
| INFRA-02 | Portkey client initializes | unit | `vitest run src/llm/portkey.test.ts -t "init"` | ❌ Wave 0 |
| INFRA-03 | PageSpeed API integration | integration | `vitest run src/fetcher/fetcher.test.ts -t "pagespeed"` | ❌ Wave 0 |
| INFRA-04 | GitHub PR creation | integration | `vitest run src/executor/executor.test.ts -t "create PR"` | ❌ Wave 0 |
| INFRA-05 | Config loading and validation | unit | `vitest run src/config/config.test.ts -t "load config"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `vitest run src/{component}/*.test.ts` (tests for changed component only; ~10 seconds)
- **Per wave merge:** `vitest run` (full suite; ~30 seconds)
- **Phase gate:** Full suite green + integration tests passing before `/gsd:verify-work`

### Wave 0 Gaps

The following test infrastructure is needed before Phase 1 implementation can be validated:

- [ ] `src/crawler/crawler.test.ts` — Tests for redirect loop detection, page discovery, robots.txt/sitemap parsing, timeout handling
- [ ] `src/auditor/auditor.test.ts` — Tests for all AUDIT-01 through AUDIT-10 rules with mock HTML pages
- [ ] `src/parser/parser.test.ts` — Tests for meta tag extraction, heading parsing, image alt detection
- [ ] `src/fetcher/fetcher.test.ts` — Mocked PageSpeed Insights API tests (verify response parsing, error handling)
- [ ] `src/executor/executor.test.ts` — Mocked Octokit GitHub API tests (verify branch creation, PR formatting)
- [ ] `src/config/config.test.ts` — Tests for config loading, validation, credential injection from env
- [ ] `src/cli/cli.test.ts` — Tests for Yargs CLI parsing (audit command, --site flag, --schedule flag)
- [ ] `src/llm/portkey.test.ts` — Portkey client initialization (no actual LLM calls; just verify client setup)
- [ ] `tests/conftest.ts` — Shared fixtures: mock HTML pages, mock API responses, test site configs
- [ ] `vitest.config.ts` — Framework config: ESM support, coverage thresholds (>80%), mock setup
- [ ] `package.json` test script: `"test": "vitest run"` and `"test:watch": "vitest"`
- [ ] `.env.test` (gitignored) — Test credentials for mocked API tests (or use empty strings)

**Note:** All test files should use Vitest syntax, not Jest. All tests should run without external API calls (use mocked responses).

---

## Sources

### Primary (HIGH confidence)
- **STACK.md** — Node.js 20 LTS ecosystem standards, Yargs/node-cron/Cheerio maturity verification
- **ARCHITECTURE.md** — Pipeline pattern documentation, component boundaries, data flow diagrams
- **PITFALLS.md** — Domain-specific failure modes identified through research of SEO tools and autonomous agents
- **CONTEXT.md** — Phase 1 user decisions (PR structure, locked choices, discretion areas)

### Secondary (MEDIUM confidence)
- **ROADMAP.md** — Phase 1 success criteria and requirement mapping
- **REQUIREMENTS.md** — Phase requirement definitions (AUDIT-01 through INFRA-05)
- Official documentation (implied but not fetched due to WebSearch/WebFetch blockage):
  - Node.js 20.x LTS: https://nodejs.org/docs/latest-v20.x/api/
  - Cheerio 1.0: https://cheerio.js.org/
  - @octokit/rest: https://octokit.github.io/rest.js/
  - Google Cloud SDKs: https://cloud.google.com/docs

### Tertiary (LOW confidence — flagged for validation)
- Portkey SDK version and TypeScript compatibility — WebSearch blocked; assume latest is compatible
- Exact Google API quota limits — Cannot verify without Google Cloud Console access; recommend pre-flight check
- Playwright vs Cheerio performance on real Next.js sites — Assumption that most sites are server-rendered; needs validation on test sites

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — Node.js 20 LTS + TypeScript is production standard, ESM mature, libraries (Yargs, Cheerio, Octokit) stable 5+ years
- Architecture: **HIGH** — Modular pipeline pattern proven in SEO tools and RPA systems; component boundaries clear
- Pitfalls: **MEDIUM-HIGH** — Critical pitfalls identified from domain analysis; some (code generation safety, plagiarism) confirmed via PITFALLS.md
- Patterns: **HIGH** — Patterns follow established best practices (checkpoints, abstraction layers, idempotency, config-driven design)
- Validation: **MEDIUM** — Test infrastructure defined; some integration tests need mocking strategy to be validated

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (30 days; stack is stable; revisit if major dependency updates occur)
**Next research:** After Phase 1 implementation, reassess Playwright requirement and Google API quota behavior

---

*Phase 1 research completed: 2026-03-21*
*Ready for planner to create PLAN.md*

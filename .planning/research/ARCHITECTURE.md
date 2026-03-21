# Architecture Patterns

**Domain:** SEO automation agent with Next.js site auditing, GitHub PR automation, and content generation
**Researched:** 2026-03-21

## Recommended Architecture

SEO automation agents typically follow a **modular pipeline architecture** with clear component boundaries and data flow from discovery → analysis → decision → execution. This allows each phase to be independently testable and replaceable.

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR (Main Agent)                   │
│  - Monthly cron trigger or manual CLI invocation                │
│  - Coordinates flow between components                           │
│  - Manages error handling and reporting                          │
└─────────────────────────────────────────────────────────────────┘
           ↓
    ┌──────────────────────────────────────────┐
    │      CONFIG & STATE MANAGER              │
    │  - Site configurations (GitHub, URLs)    │
    │  - Auth tokens (GitHub, Google APIs)     │
    │  - Previous run state/cache              │
    └──────────────────────────────────────────┘
           ↓
    ┌──────────────────────────────────────────┐
    │     DISCOVERY PIPELINE                   │
    │  ├─ Crawler (fetch & parse)              │
    │  ├─ Parser (extract structure)           │
    │  └─ Inventory Builder (catalog pages)    │
    └──────────────────────────────────────────┘
           ↓
    ┌──────────────────────────────────────────┐
    │     ANALYSIS PIPELINE                    │
    │  ├─ SEO Auditor (rules-based checks)     │
    │  ├─ Data Fetcher (Google APIs)           │
    │  ├─ Performance Analyzer                 │
    │  └─ Keyword Analyzer (GSC + research)    │
    └──────────────────────────────────────────┘
           ↓
    ┌──────────────────────────────────────────┐
    │     DECISION ENGINE                      │
    │  ├─ Issue Deduplicator                   │
    │  ├─ Priority Ranker                      │
    │  ├─ Fixer Selector (auto vs manual)      │
    │  └─ Content Generator (LLM via Portkey)  │
    └──────────────────────────────────────────┘
           ↓
    ┌──────────────────────────────────────────┐
    │     EXECUTION PIPELINE                   │
    │  ├─ Code Generator (markdown → code)     │
    │  ├─ Repository Manager (git + GitHub)    │
    │  ├─ PR Creator (submit to GitHub)        │
    │  └─ Notification Handler                 │
    └──────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | Input | Output |
|-----------|---------------|-------------------|-------|--------|
| **Orchestrator** | Coordinates entire pipeline, handles CLI/cron scheduling | All | Trigger event + config | Completion status, logs |
| **Config Manager** | Loads/validates site configs, manages secrets & auth | All components | Config files, env vars | Validated config objects |
| **Crawler** | Fetches site pages, respects robots.txt, tracks crawl state | Parser, Inventory | Site URL, depth limit | Raw HTML pages, crawl metadata |
| **Parser** | Extracts semantic structure (headings, meta, links) | Inventory Builder, Auditor | Raw HTML | Structured page data (JSON) |
| **Inventory Builder** | Catalogs all pages, detects changes from previous runs | Analyzer, Auditor | Parsed pages | Page inventory, change detection |
| **SEO Auditor** | Applies SEO rules (meta tags, heading structure, internal links) | Decision Engine | Parsed pages, inventory | List of issues with severity |
| **Data Fetcher** | Calls Google APIs (Search Console, PageSpeed, Analytics) | Analyzer | Site config, URLs | Performance metrics, search data |
| **Keyword Analyzer** | Researches keywords, finds content gaps, ranks opportunities | Content Generator | Search Console data, existing content | Keyword opportunities list |
| **LLM Gateway (Portkey)** | Routes requests to configured AI provider | Content Generator, Fixer | Prompt + config | Generated text (blog posts, fixes) |
| **Decision Engine** | Deduplicates issues, ranks by impact, decides fix strategy | Fixer, Content Generator | Issues list, opportunities | Prioritized action list |
| **Code Generator** | Converts audit fixes + content into runnable code | PR Creator | Action description, templates | Code files ready to commit |
| **Repository Manager** | Git operations (clone, branch, commit, push) | PR Creator | Repo URL, code to commit | Git refs, push status |
| **PR Creator** | Submits pull requests to GitHub | Notification | Code, branch metadata | PR URL, status |
| **Notification Handler** | Logs results, sends summaries | Orchestrator | Execution results | Formatted reports |

### Data Flow

**Monthly Cron Run:**

1. **Initialization Phase**
   - Orchestrator reads config file (sites, credentials)
   - Config Manager validates and decrypts secrets
   - Load previous run state (cache, last-seen issues)

2. **Discovery Phase**
   - For each site:
     - Crawler fetches all reachable pages
     - Parser extracts structured data (meta, headings, links, etc.)
     - Inventory Builder catalogs pages, detects new/removed/changed pages

3. **Analysis Phase**
   - SEO Auditor runs rule-based checks on each page
   - Data Fetcher calls Google APIs (Search Console, PageSpeed Insights)
   - Keyword Analyzer identifies keyword opportunities and content gaps
   - Results: `[{pageUrl, issues: [{type, severity, fix_strategy}]}, {keyword_opportunities}]`

4. **Decision Phase**
   - Decision Engine receives issues + opportunities
   - Deduplicates issues (same issue on multiple pages)
   - Ranks by severity and potential impact
   - Categorizes: auto-fix vs needs-review vs defer
   - Content Generator creates blog post outline for top keywords
   - Decision output: `[{pr_type: 'fix'|'content'|'both', changes: [{file, action}]}]`

5. **Execution Phase**
   - For each site with changes:
     - Repository Manager clones repo, creates feature branch
     - Code Generator transforms fixes into actual code changes
     - Commits and pushes branch
     - PR Creator submits PR to GitHub
   - Notification Handler logs summary and PR links

**Data structures flowing through pipeline:**

```typescript
// Discovery output
interface PageInventory {
  url: string;
  title: string;
  headings: string[];
  metaDescription: string;
  metaTags: Record<string, string>;
  internalLinks: string[];
  externalLinks: string[];
  wordCount: number;
  lastSeen: Date;
}

// Analysis output
interface AuditIssue {
  type: 'missing_meta' | 'short_description' | 'no_h1' | 'slow_page' | 'duplicate_content' | ...;
  severity: 'critical' | 'high' | 'medium' | 'low';
  page: string;
  description: string;
  suggestedFix: string;
  autoFixable: boolean;
}

interface KeywordOpportunity {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  pages: string[]; // pages that could rank
  contentGap: string; // why we're not ranking
  recommendedAction: 'create_post' | 'expand_existing' | 'optimize_meta';
}

// Decision output
interface Action {
  type: 'fix_issue' | 'create_content' | 'optimize_meta';
  issues: AuditIssue[];
  affectedPages: string[];
  prType: 'seo-fixes' | 'blog-post' | 'performance';
  generatedContent?: {
    file: string;
    title: string;
    body: string;
    frontmatter: Record<string, string>;
  };
  codeFixes?: Array<{
    file: string;
    changes: string; // diff or replacement
  }>;
}
```

## Patterns to Follow

### Pattern 1: Pipeline Architecture with Checkpoints

**What:** Divide work into discrete phases (Discovery → Analysis → Decision → Execution). Each phase produces concrete output that's persisted before moving to next.

**When:** Building systems that process data through multiple stages of transformation, especially when failures in later stages shouldn't require re-running expensive early stages.

**Example:**
```typescript
// Orchestrator.ts
async function runAudit(siteConfig: SiteConfig): Promise<AuditResult> {
  // Discovery: expensive (crawling)
  const inventory = await crawler.crawl(siteConfig.url);
  await state.saveCrawlState(siteConfig.id, inventory);

  // Analysis: medium cost (API calls)
  const issues = await auditor.audit(inventory);
  const keywords = await keywordAnalyzer.analyze(inventory);
  await state.saveAnalysisState(siteConfig.id, { issues, keywords });

  // Decision: cheap (in-process)
  const actions = await decisionEngine.prioritize(issues, keywords);

  // Execution: medium cost (PR creation)
  const prs = await executor.execute(siteConfig, actions);

  return { inventory, issues, actions, prs };
}
```

### Pattern 2: Separation of Concerns with Adapters

**What:** Each component handles one responsibility. External integrations (GitHub, Google APIs) are abstracted as adapters/interfaces.

**When:** You need to swap implementations (different crawlers, different API sources, different LLM providers).

**Example:**
```typescript
// Abstractions
interface SeoDatasource {
  fetchPages(url: string): Promise<Page[]>;
}

interface IssueDetector {
  audit(pages: Page[]): Promise<Issue[]>;
}

interface CodeFixer {
  generateFix(issue: Issue): Promise<CodeChange>;
}

// Implementations
class GoogleSearchConsoleDatasource implements SeoDatasource { ... }
class PlaywrightCrawler implements SeoDatasource { ... }

class RulesBasedAuditor implements IssueDetector { ... }

class PortkeyLLMFixer implements CodeFixer { ... }

// Easy to test and swap
const crawler = new PlaywrightCrawler();
const datasource = new GoogleSearchConsoleDatasource();
const auditor = new RulesBasedAuditor(crawler, datasource);
const fixer = new PortkeyLLMFixer({ provider: 'claude' });
```

### Pattern 3: Idempotent Operations with State Tracking

**What:** Track what's been done (via state files or database) so reruns don't duplicate work or create conflicting PRs.

**When:** Running batch processes that might fail partway and need resuming, or running repeatedly on a schedule.

**Example:**
```typescript
// Track which issues we've already created PRs for
interface AuditState {
  siteId: string;
  runId: string;
  timestamp: Date;
  crawlState: { url: string, pages: number, changes: string[] };
  analysisState: { issues: Issue[], totalSeverity: number };
  executionState: { prCreated: string[], failedActions: string[] };
}

// Before creating a PR, check if we already did it
async function executeActions(actions: Action[]): Promise<PR[]> {
  const previousRun = await state.getPreviousRun(siteId);

  const newActions = actions.filter(a => {
    const isDuplicate = previousRun?.executionState.prCreated.some(
      pr => pr.includes(a.issues[0].type)
    );
    return !isDuplicate;
  });

  return await prCreator.createPRs(newActions);
}
```

### Pattern 4: LLM Integration via Abstraction Layer

**What:** Use Portkey as a provider-agnostic gateway. Define prompt interfaces and let Portkey route to configured model.

**When:** You want to support multiple AI providers without rewriting prompts or application logic.

**Example:**
```typescript
// Define prompt interface
interface GenerationRequest {
  type: 'blog_post' | 'meta_description' | 'code_fix';
  context: Record<string, string>;
  constraints: string[];
}

class ContentGenerator {
  constructor(private portkey: PortkeyClient) {}

  async generateBlogPost(keyword: string, outline: string): Promise<string> {
    const request: GenerationRequest = {
      type: 'blog_post',
      context: { keyword, outline, siteNiche: 'web-dev' },
      constraints: ['2000 words', 'SEO-optimized', 'markdown format']
    };

    // Portkey handles provider selection based on config
    const response = await this.portkey.generate(request);
    return response.text;
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Crawler

**What:** One function that crawls, parses, audits, and fixes all in one pass without checkpoints.

**Why bad:** If crawling fails after 1 hour, you lose all analysis work. If auditing fails, you re-crawl the entire site. Debugging becomes impossible — you don't know which phase failed.

**Instead:** Separate into Crawler → Parser → Inventory Builder → Auditor with state saves between each.

### Anti-Pattern 2: Hardcoded AI Provider Logic

**What:** If statements checking provider type scattered throughout codebase:
```typescript
if (provider === 'claude') {
  const response = await claude.complete(...);
} else if (provider === 'gpt4') {
  const response = await openai.complete(...);
}
```

**Why bad:** Adding a new provider means touching multiple files. Switching providers requires code changes. Tests become complex.

**Instead:** Route all LLM calls through Portkey with provider configured externally. Application code doesn't know or care which provider is active.

### Anti-Pattern 3: Missing Idempotency

**What:** Running the same audit twice creates two PRs for the same issue.

**Why bad:** Duplicate PRs clutter repository, confuse reviewers, require manual cleanup.

**Instead:** Track execution state. Before creating PR, check if we already created one for this issue in recent runs. Deduplicate or update existing PR rather than creating new one.

### Anti-Pattern 4: Tight Coupling to GitHub

**What:** PR creation logic mixed with audit logic. GitHub-specific code in business logic.

**Why bad:** Can't test audit without GitHub auth. Can't switch VCS without major refactoring. Hard to add other delivery methods (direct commit, GitLab, etc.).

**Instead:** Define abstract `DeliveryAdapter` interface. Implement for GitHub, test with mock. Swap implementations easily.

### Anti-Pattern 5: Synchronous Waiting on External APIs

**What:**
```typescript
for (const page of pages) {
  const metrics = await googleApis.getPageSpeed(page.url); // blocks
  const data = await searchConsole.getQuery(page.url); // blocks
}
```

**Why bad:** If you have 100 pages and each API call takes 1s, this takes 200s. Rate limits kill you.

**Instead:** Batch and parallelize:
```typescript
const metrics = await Promise.all(
  pages.map(p => googleApis.getPageSpeed(p.url))
);
```

Or use queued rate-limited client to respect quotas.

## Scalability Considerations

| Concern | At 10 Sites / 1000 Pages | At 50 Sites / 5000 Pages | At 100+ Sites / 10K+ Pages |
|---------|---------------------------|--------------------------|---------------------------|
| **Crawl time** | Sequential per-site crawl (15-30 min total) | Parallel crawl with rate limiting (20-40 min) | Crawl jobs queued, run in parallel batches over multiple hours |
| **API quota** | Google APIs fit within free tier (100 req/day) | Approach quota limits, may need pagination caching | Require paid tier, implement quota tracking and backoff |
| **State storage** | JSON files in version control (simple) | JSON in S3/git LFS (avoids repo bloat) | Database (PostgreSQL) with audit log and state recovery |
| **PR creation** | Sequential, 1-2 min per PR (acceptable) | Batch PRs in groups of 5, create in parallel (5 min) | Implement PR queue, create 2-3 at a time, respect GitHub rate limits |
| **Memory** | Single process sufficient (< 1GB) | Single Node process fine (1-2GB) | May need worker pool or distributed processing |
| **Build order** | Phase 1-4 monolithic, Phase 5 add queuing | Introduce message queue (Redis), separate workers | Add database layer, implement job management |

For current project (under 10 sites), **Phase 1-2 strategy is sufficient:**
- Sequential site processing
- In-process pipeline (no queue)
- JSON file state management
- Single Node process

Scalability hooks:
- Use abstract interfaces for state storage (easy to swap file → database)
- Design components to work with batch operations (e.g., `auditor.audit(pages)` not `pages.map(p => auditor.audit(p))`)
- Log which phase each operation is in for debugging

## Build Order Implications

Based on component dependencies, recommended implementation order:

**Phase 1: Core Discovery & Analysis**
1. Config Manager (no dependencies, foundational)
2. Crawler (depends only on config)
3. Parser (depends on Crawler)
4. Inventory Builder (depends on Parser)
5. SEO Auditor (depends on Inventory)
6. Data Fetcher (Google APIs integration, depends on config)
7. Analysis pipeline works end-to-end

**Phase 2: Decision & Content Generation**
1. Decision Engine (depends on Analysis output)
2. Portkey integration (LLM gateway)
3. Keyword Analyzer (depends on Data Fetcher)
4. Content Generator (depends on Portkey + Keyword Analyzer)

**Phase 3: Execution & Delivery**
1. Code Generator (depends on Decision output)
2. Repository Manager (git operations)
3. PR Creator (GitHub integration)
4. Notification Handler

**Phase 4: Orchestration & Scheduling**
1. Orchestrator (coordinates all)
2. CLI interface
3. Cron scheduling integration

This order ensures:
- Phase 1 is testable in isolation (no external PR creation required)
- Phase 2 depends only on Phase 1 outputs
- Phase 3 is optional (could deliver as JSON report instead)
- Each phase can be validated before moving to next

## Sources

Patterns derived from:
- Production SEO automation tools (Semrush, SEMtrack, ContentStudio)
- Web crawler architecture (Colly, Puppeteer, Playwright design patterns)
- Microservices architecture principles (separation of concerns, adapters)
- Robotic Process Automation (RPA) frameworks (Blue Prism, UiPath pipeline design)
- AI agent literature (ReAct pattern, tool use, planning)

No specific external documentation referenced — these are industry-standard patterns for audit/analysis/execution pipelines in SEO and compliance automation domains.

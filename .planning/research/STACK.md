# Technology Stack

**Project:** SEO Agent (CLI-based autonomous SEO auditing & content generation)
**Researched:** 2026-03-21
**Overall Confidence:** MEDIUM (training data as of Feb 2025; WebSearch/WebFetch blocked)

## Recommended Stack

### Runtime & CLI Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Node.js** | 20.x LTS | JavaScript runtime | Mature, stable LTS for production CLI tools. 20.x supported until April 2026. ES modules fully supported. |
| **TypeScript** | 5.3+ | Type safety | Required for maintainability in a multi-module agent. Catches bugs at compile time. Improves IDE support for API integrations. |
| **tsx** | 4.x | TS execution & dev | Drop-in `ts-node` replacement. Faster, better module support. Use over `ts-node` for production CLI. |

**Rationale:** TypeScript + Node.js 20 LTS is the 2025 standard for production CLI agents. Zero JavaScript ecosystem drift. Use `tsx` instead of `ts-node` for faster development and better ESM support.

### CLI & Task Orchestration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Yargs** | 17.x | CLI argument parsing | Industry standard for Node.js CLI tools. Clear, composable, handles subcommands well. Used by major projects (Next.js plugins, Yarn, etc.). |
| **node-cron** | 3.0.3+ | Scheduled task execution | Lightweight cron-style scheduling. No dependencies beyond Node.js. Simple API for monthly runs. Production-ready. |

**Alternative considered:** Commander.js (also solid; prefer Yargs for subcommand composition). For scheduling: `bull` (needs Redis), `node-schedule` (deprecated), `later.js` (not maintained). `node-cron` is lean and perfect for under-10-site scale.

**Rationale:** Yargs + node-cron gives you CLI composability + reliable scheduling without external services.

### AI & LLM Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **@portkey-ai/portkey-node** | Latest (verify at npm) | AI model gateway | Portkey is your constraint. Node.js SDK provides unified interface to Claude, GPT-4, etc. Swap models without code changes. |
| **Anthropic SDK** (optional) | 0.20+ | Direct Claude access (fallback) | If Portkey SDK is unavailable or causes friction, fallback to direct Anthropic SDK. Keep as secondary option. |

**Portkey Decision Rationale:** This is a hard constraint from your project. Portkey abstracts model selection so you can A/B test Claude vs GPT-4 for SEO tasks without rewriting agent logic.

### GitHub Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **@octokit/rest** | 20.x | GitHub API client | Official Octokit SDK. Handles PR creation, branch management, file operations. Type-safe with TypeScript. Maintained by GitHub. |

**Usage pattern:** Create branches, commit changes, open PRs. Avoid `.createOrUpdateFileContents()` for multi-file workflows—instead use Git refs API for atomic operations.

### Google APIs Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **@google-cloud/search-console** | Latest | Google Search Console | Official Google SDK for GSC data (queries, impressions, CTR, pages). |
| **@google-cloud/pagespeed-insights** | Latest | PageSpeed Insights API | Official SDK for performance metrics. |
| **google-auth-library-nodejs** | 9.x+ | OAuth2 auth | Handles Google credential flow. Standardize all Google API calls through this. |

**Why official SDKs:** Maintained by Google, follow OAuth2 standards, type-safe. Avoid third-party wrappers which lag behind API changes.

**Authentication:** Service account JSON key (for scheduled runs) or OAuth2 (if manual CLI runs need personal GSC data). Store keys in `.env.local` (gitignored).

### Web Scraping & Crawling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **cheerio** | 1.0+ | HTML parsing | Fast, jQuery-like syntax. Parse Next.js markup for meta tags, structured data, headings. No browser overhead. |
| **node-fetch** | 3.x | HTTP requests | Lightweight fetch implementation. Use for crawling site pages and fetching markup. |
| **playwright** | 1.45+ | Headless browser (optional, phase 2) | For JavaScript-heavy sites requiring rendering. Defer this to Phase 2 if needed—adds complexity. For initial MVP, cheerio + node-fetch is sufficient. |

**Why not Puppeteer?** Playwright has better maintenance cadence and TypeScript support. Cheerio is faster for static content parsing.

**Anti-pattern:** Don't use Selenium or deprecated tools. Playwright is current standard.

### Utilities & Data Handling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **zod** | 3.22+ | Runtime type validation | Validate API responses (Google APIs, GitHub, Portkey). Gives you confidence in data shape. Lightweight, no transpilation needed. |
| **dotenv** | 16.x | Environment variables | Load `.env` and `.env.local` safely. Standard for API keys, credentials, site configs. |
| **pino** or **winston** | 8.x or 12.x | Structured logging | Pino is faster and lighter; Winston is more featureful. For a lean agent, use Pino. Structured logs help debug scheduled runs. |
| **axios** | 1.6+ | HTTP client (alternative to node-fetch) | If you need retry logic, timeout handling, interceptors. More batteries-included than node-fetch. Choose ONE. |

**Logging decision:** Use Pino for lean, fast logging. Structured logs make troubleshooting scheduled runs easier (you won't have SSH access to read console during cron jobs).

### Testing & Quality

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vitest** | 1.x | Unit & integration tests | Vite ecosystem, ESM-native, faster than Jest. Works seamlessly with TypeScript. |
| **@testing-library/node** or **node-test** (Node 20.9+) | Latest | Testing utilities | Node 20.9+ has native `test` module. Avoid Jest overhead if using Node 20. Vitest + Node test runner is lighter. |
| **tsx** (same as runtime) | 4.x | Run tests with TS | `vitest` automatically uses tsx internally. |

**Why Vitest over Jest?** Jest has CommonJS default and slower startup. Vitest is ESM-first, faster, better for modern Node.js.

### Package Management & Environment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **npm** or **pnpm** | npm 10.x / pnpm 9.x | Dependency management | Recommend **pnpm** for monorepo-ready lockfile and disk efficiency. If team standardizes on npm, npm 10.x is solid. |
| **.nvmrc** | Node 20.x | Runtime pinning | Ensure all developers & cron jobs use Node 20 LTS. Prevent drift. |
| **.env.local** (gitignored) | — | Secrets & config | Store Google API keys, GitHub token, Portkey API key here. Never commit. |

## Installation

```bash
# Core dependencies
npm install \
  yargs \
  node-cron \
  @octokit/rest \
  @portkey-ai/portkey-node \
  @google-cloud/search-console \
  @google-cloud/pagespeed-insights \
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

# Optional (Phase 2 if needed)
npm install playwright  # Defer unless sites require JS rendering
```

## Dependency Tree

```
seo-agent/
├── CLI Layer (yargs)
│   └── Task Scheduler (node-cron)
│       ├── SEO Audit Module
│       │   ├── Crawl (cheerio, node-fetch)
│       │   ├── Google APIs (search-console, pagespeed-insights)
│       │   └── LLM Analysis (Portkey)
│       └── PR Generator Module
│           ├── Content Generation (Portkey)
│           ├── Git Operations (@octokit/rest)
│           └── Validation (zod)
```

## Configuration Files

```bash
# .nvmrc (pin Node.js version)
20

# .env.local (not committed)
GOOGLE_APPLICATION_CREDENTIALS=./secrets/service-account.json
GITHUB_TOKEN=ghp_xxxx
PORTKEY_API_KEY=pk_xxxx
PORTKEY_BASE_URL=https://api.portkey.ai/v1
```

## What NOT to Use (and Why)

| Technology | Why Not |
|-----------|---------|
| **CommonJS** | ESM is standard in 2025. All new tooling (Portkey, modern APIs) is ESM-first. Don't mix module systems. |
| **Puppeteer** | Playwright is the 2025 standard. Better maintenance, TypeScript support, faster execution. |
| **Jest** | Overkill for Node.js CLI. Vitest is faster, ESM-native. Only choose Jest if team already depends on it. |
| **Selenium** | Deprecated in favor of Playwright/Puppeteer. Don't start new projects with it. |
| **Bull queue** | Overkill for under-10-sites, monthly runs. Adds Redis dependency. node-cron is sufficient. |
| **GraphQL Apollo (client)** | GitHub's GraphQL API is powerful, but REST API is sufficient for PR operations. Start with REST, migrate if needed. |
| **Express/Hapi** | You're building a CLI agent, not a web service. No need for a server framework. |

## Version Pinning

Always specify exact versions in package.json to ensure reproducible cron runs:

```json
{
  "dependencies": {
    "yargs": "17.7.2",
    "node-cron": "3.0.3",
    "@octokit/rest": "20.0.2",
    "cheerio": "1.0.0-rc.12"
  },
  "engines": {
    "node": "20.x",
    "npm": "10.x"
  }
}
```

## Phase-Specific Notes

### Phase 1 (MVP Crawl & Audit)
- Focus: Cheerio + Google APIs + Portkey
- Skip: Playwright, database, file storage
- Stack: Node 20 + TS + Yargs + node-cron (minimal)

### Phase 2 (Blog Generation & PRs)
- Focus: Content gen (Portkey LLM) + @octokit/rest
- Add: Pino logging (for PR creation debugging)
- Consider: Playwright if sites are heavily JavaScript-based

### Phase 3 (Multi-site Configuration)
- Add: Configuration file format (YAML or JSON schema validation with zod)
- No new major dependencies—use what Phase 1-2 established

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Node.js/TypeScript choice | HIGH | 20.x LTS is stable, ESM mature, clear path to 22 LTS. No churn expected. |
| CLI frameworks (Yargs) | HIGH | Yargs stable for 5+ years. Will not change. |
| GitHub API (@octokit/rest) | HIGH | Official, actively maintained, type-safe. |
| Scheduling (node-cron) | HIGH | Widely used, simple, no breaking changes expected. |
| Portkey SDK | MEDIUM | Portkey is a constraint. SDK exists and works. However, WebSearch/WebFetch blocked so I cannot verify exact current version or recent changes. Assume latest is compatible. |
| Google APIs (@google-cloud/\*) | MEDIUM | Official SDKs exist. Cannot verify exact versions without WebFetch. May require version bumps for newer API features. |
| Cheerio for scraping | HIGH | Stable library, jQuery API is familiar, production-ready. |
| Playwright (optional) | MEDIUM | Solid in 2025, but deferred to Phase 2. Assume latest 1.x is stable. |

## Rationale Summary

**Why this stack over alternatives:**

1. **Node.js + TypeScript** → Standard for modern CLI tools. Zero ecosystem thrash. Unified language across code.
2. **Yargs + node-cron** → Minimal, battle-tested. No learning curve for agency team.
3. **Portkey SDK** → Your constraint; it enables model flexibility without vendor lock-in.
4. **Official Google SDKs** → Maintained by Google, OAuth2-compliant, type-safe.
5. **@octokit/rest** → GitHub's official SDK. PR operations are well-supported.
6. **Cheerio + node-fetch** → Fast, lightweight. No browser overhead for mostly-static Next.js sites.
7. **Pino for logging** → Structured logs are critical for troubleshooting scheduled runs (no real-time console access).
8. **Vitest** → ESM-native, fast, low overhead for a lean agent.

**What's NOT here:**
- No database (Phase 1: store audit results as JSON, commit to PR branch)
- No Express/server (CLI + cron only; no web dashboard)
- No Redis/Bull (node-cron sufficient for < 10 sites, monthly runs)
- No Playwright yet (Phase 2 if sites require JS rendering)

## Next Steps for Implementation

1. **Verify Portkey SDK version** → Check npm for @portkey-ai/portkey-node latest, ensure TypeScript types included.
2. **Set up authentication flows** → Prepare service account JSON for Google APIs, GitHub PAT for @octokit/rest.
3. **Create sample crawl script** → Test Cheerio + node-fetch on a test Next.js site before scaling.
4. **Logging configuration** → Set up Pino with JSON output to stderr (for cron job observability).
5. **Cron scheduling** → Test node-cron with a no-op task scheduled for specific times before integrating real audit logic.

---

**Stack Status:** Ready for implementation.
**Next Research:** FEATURES.md (what SEO audit/content tasks to prioritize in Phase 1).

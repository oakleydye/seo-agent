# Requirements: SEO Agent

**Defined:** 2026-03-21
**Core Value:** Every client site gets consistent, automated SEO maintenance — audits run, issues get fixed, and fresh content gets created — without manual effort beyond reviewing PRs.

## v1 Requirements

### Audit

- [x] **AUDIT-01**: Agent crawls Next.js site and detects missing/duplicate title tags
- [x] **AUDIT-02**: Agent detects missing/duplicate meta descriptions
- [x] **AUDIT-03**: Agent detects missing Open Graph tags
- [x] **AUDIT-04**: Agent detects broken internal links
- [x] **AUDIT-05**: Agent detects redirect chains and loops
- [x] **AUDIT-06**: Agent detects duplicate content across pages
- [x] **AUDIT-07**: Agent detects missing or malformed canonical tags
- [x] **AUDIT-08**: Agent validates heading hierarchy (H1-H6 structure)
- [x] **AUDIT-09**: Agent detects missing image alt attributes
- [x] **AUDIT-10**: Agent detects crawl errors (404s, 500s)

### Auto-Fix

- [x] **FIX-01**: Agent generates code to add/fix missing title tags and submits as PR
- [x] **FIX-02**: Agent generates code to add/fix meta descriptions and submits as PR
- [x] **FIX-03**: Agent generates code to add Open Graph tags and submits as PR
- [x] **FIX-04**: Agent generates code to fix missing image alt text and submits as PR
- [x] **FIX-05**: Agent generates code to fix heading hierarchy issues and submits as PR
- [x] **FIX-06**: Agent generates JSON-LD schema markup and submits as PR
- [x] **FIX-07**: Each PR includes clear description explaining what was found and why it was fixed

### Content

- [x] **CONT-01**: Agent identifies keyword opportunities from Google Search Console data
- [x] **CONT-02**: Agent generates SEO-optimized blog posts targeting discovered keywords
- [x] **CONT-03**: Agent includes internal links to existing site content in generated posts
- [x] **CONT-04**: Agent submits blog posts as GitHub PRs for review

### Infrastructure

- [x] **INFRA-01**: CLI tool with commands for audit, fix, and content generation
- [x] **INFRA-02**: Portkey integration for flexible AI model selection
- [x] **INFRA-03**: Google Search Console API integration for SEO data
- [x] **INFRA-04**: GitHub API integration for PR creation and branch management
- [x] **INFRA-05**: Site configuration file for specifying client repo details

## v2 Requirements

### Performance

- **PERF-01**: Agent analyzes Core Web Vitals (LCP, FID, CLS) via PageSpeed Insights API
- **PERF-02**: Agent generates performance fix suggestions (image optimization, lazy loading)

### Operations

- **OPS-01**: Monthly cron scheduling for automated runs
- **OPS-02**: Multi-site batch execution (run all client sites in sequence)
- **OPS-03**: Run summary notifications (email or Slack)

### Advanced

- **ADV-01**: Next.js-native auditing (App Router, dynamic routes, middleware)
- **ADV-02**: Content authenticity — unique voice/tone per client brand
- **ADV-03**: Competitor keyword gap analysis

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web dashboard UI | CLI + scheduled runs sufficient for under 10 sites |
| Real-time monitoring | Monthly batch process, not real-time |
| Direct publishing | All changes go through PR review |
| Backlink analysis | No Ahrefs/SEMrush integration for v1 |
| Auto-merge of PRs | Agency must review all changes |
| E-commerce SEO | Focus on content/service sites |
| Multi-language/international SEO | Assume English-primary for v1 |
| Rank tracking history | Use Search Console current data only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | 1 | Complete |
| AUDIT-02 | 1 | Complete |
| AUDIT-03 | 1 | Complete |
| AUDIT-04 | 1 | Complete |
| AUDIT-05 | 1 | Complete |
| AUDIT-06 | 1 | Complete |
| AUDIT-07 | 1 | Complete |
| AUDIT-08 | 1 | Complete |
| AUDIT-09 | 1 | Complete |
| AUDIT-10 | 1 | Complete |
| FIX-01 | 2 | Complete |
| FIX-02 | 2 | Complete |
| FIX-03 | 2 | Complete |
| FIX-04 | 2 | Complete |
| FIX-05 | 2 | Complete |
| FIX-06 | 2 | Complete |
| FIX-07 | 2 | Complete |
| CONT-01 | 2 | Complete |
| CONT-02 | 3 | Complete |
| CONT-03 | 3 | Complete |
| CONT-04 | 3 | Complete |
| INFRA-01 | 1 | Complete |
| INFRA-02 | 1 | Complete |
| INFRA-03 | 1 | Complete |
| INFRA-04 | 1 | Complete |
| INFRA-05 | 1 | Complete |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0
- **Coverage: 100% ✓**

---

*Requirements defined: 2026-03-21*
*Roadmap mapped: 2026-03-21*

import { describe, it, expect } from 'vitest';
import {
  FixCategorySchema,
  RiskCategorySchema,
  KeywordOpportunitySchema,
  categorizeFixRisk,
  LOW_RISK_RULES,
} from './index.js';
import type { Issue } from './index.js';

describe('FixCategorySchema', () => {
  it('accepts all valid fix categories', () => {
    const validCategories = [
      'title-tag',
      'meta-description',
      'og-tags',
      'alt-text',
      'heading-hierarchy',
      'schema-markup',
    ];
    for (const cat of validCategories) {
      expect(FixCategorySchema.parse(cat)).toBe(cat);
    }
  });

  it('rejects invalid fix categories', () => {
    expect(() => FixCategorySchema.parse('unknown-category')).toThrow();
    expect(() => FixCategorySchema.parse('')).toThrow();
    expect(() => FixCategorySchema.parse('canonical')).toThrow();
  });
});

describe('RiskCategorySchema', () => {
  it('accepts low-risk', () => {
    expect(RiskCategorySchema.parse('low-risk')).toBe('low-risk');
  });

  it('accepts needs-review', () => {
    expect(RiskCategorySchema.parse('needs-review')).toBe('needs-review');
  });

  it('rejects invalid risk categories', () => {
    expect(() => RiskCategorySchema.parse('high-risk')).toThrow();
    expect(() => RiskCategorySchema.parse('')).toThrow();
  });
});

describe('KeywordOpportunitySchema', () => {
  const validKeyword = {
    keyword: 'next.js seo tips',
    clicks: 120,
    impressions: 3000,
    ctr: 0.04,
    position: 12.5,
    opportunityScore: 2880,
  };

  it('accepts a valid keyword opportunity', () => {
    const result = KeywordOpportunitySchema.parse(validKeyword);
    expect(result.keyword).toBe('next.js seo tips');
  });

  it('rejects ctr above 1', () => {
    expect(() => KeywordOpportunitySchema.parse({ ...validKeyword, ctr: 1.5 })).toThrow();
  });

  it('rejects negative clicks', () => {
    expect(() => KeywordOpportunitySchema.parse({ ...validKeyword, clicks: -1 })).toThrow();
  });

  it('rejects empty keyword', () => {
    expect(() => KeywordOpportunitySchema.parse({ ...validKeyword, keyword: '' })).toThrow();
  });

  it('rejects non-positive position', () => {
    expect(() => KeywordOpportunitySchema.parse({ ...validKeyword, position: 0 })).toThrow();
  });
});

describe('LOW_RISK_RULES', () => {
  it('contains the expected low-risk rules', () => {
    expect(LOW_RISK_RULES).toContain('missing-title-tag');
    expect(LOW_RISK_RULES).toContain('missing-meta-description');
    expect(LOW_RISK_RULES).toContain('missing-og-tags');
    expect(LOW_RISK_RULES).toContain('missing-alt-text');
    expect(LOW_RISK_RULES).toContain('missing-canonical');
    expect(LOW_RISK_RULES).toContain('invalid-schema-markup');
  });

  it('has exactly 6 entries', () => {
    expect(LOW_RISK_RULES.length).toBe(6);
  });
});

describe('categorizeFixRisk', () => {
  const makeIssue = (rule: string): Issue => ({
    id: 'test-001',
    rule,
    severity: 'warning',
    pageUrl: 'https://example.com/page',
    description: 'Test issue',
  });

  it('returns low-risk for missing-title-tag', () => {
    expect(categorizeFixRisk(makeIssue('missing-title-tag'))).toBe('low-risk');
  });

  it('returns low-risk for missing-meta-description', () => {
    expect(categorizeFixRisk(makeIssue('missing-meta-description'))).toBe('low-risk');
  });

  it('returns low-risk for missing-og-tags', () => {
    expect(categorizeFixRisk(makeIssue('missing-og-tags'))).toBe('low-risk');
  });

  it('returns low-risk for missing-alt-text', () => {
    expect(categorizeFixRisk(makeIssue('missing-alt-text'))).toBe('low-risk');
  });

  it('returns low-risk for missing-canonical', () => {
    expect(categorizeFixRisk(makeIssue('missing-canonical'))).toBe('low-risk');
  });

  it('returns low-risk for invalid-schema-markup', () => {
    expect(categorizeFixRisk(makeIssue('invalid-schema-markup'))).toBe('low-risk');
  });

  it('returns needs-review for heading-hierarchy issues', () => {
    expect(categorizeFixRisk(makeIssue('incorrect-heading-hierarchy'))).toBe('needs-review');
  });

  it('returns needs-review for unknown rules', () => {
    expect(categorizeFixRisk(makeIssue('some-unknown-rule'))).toBe('needs-review');
  });

  it('returns needs-review for duplicate-content', () => {
    expect(categorizeFixRisk(makeIssue('duplicate-content'))).toBe('needs-review');
  });
});

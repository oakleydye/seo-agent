import { describe, it, expect } from 'vitest';
import { flagClaims } from './claim-flagging.js';

describe('flagClaims', () => {
  it('flags sentence with percentage statistic and "studies show"', () => {
    const content = 'Studies show that 73% of users prefer X. No claims here.';
    const result = flagClaims(content);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('73%');
  });

  it('returns empty array when no flagged patterns exist', () => {
    const content = 'No stats here. Just normal text.';
    const result = flagClaims(content);
    expect(result).toEqual([]);
  });

  it('flags sentence with [FACT-CHECK] marker and large number claim', () => {
    const content = 'Revenue grew to $2 billion [FACT-CHECK]. Another sentence.';
    const result = flagClaims(content);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const flagged = result.join(' ');
    expect(flagged).toContain('[FACT-CHECK]');
  });

  it('returns all flagged sentences (deduplicated) when multiple exist', () => {
    const content = [
      'According to research, 45% of companies fail.',
      'Research shows growth of $5 billion in revenue.',
      'According to research, 45% of companies fail.',
      'Normal sentence with no statistics.',
    ].join(' ');

    const result = flagClaims(content);
    // Should have at least 2 unique flagged sentences
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Should be deduplicated — no duplicates
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it('flags sentence with "according to" attribution', () => {
    const content = 'According to industry experts, this approach is best. Regular advice here.';
    const result = flagClaims(content);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toMatch(/according to/i);
  });

  it('flags sentence with "research shows" attribution', () => {
    const content = 'Research shows that users prefer fast websites. Another normal sentence.';
    const result = flagClaims(content);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toMatch(/research shows/i);
  });

  it('flags sentence with large number in billions', () => {
    const content = 'The market reached 5 billion users last year. Regular text follows.';
    const result = flagClaims(content);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toContain('billion');
  });

  it('does not flag short or punctuation-only segments', () => {
    const content = 'Hello world. Yes. No.';
    const result = flagClaims(content);
    expect(result).toEqual([]);
  });
});

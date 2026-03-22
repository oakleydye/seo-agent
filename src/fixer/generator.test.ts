import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Issue } from '../types/index.js';

// Mock the portkey client BEFORE importing generator
vi.mock('../portkey/client.js', () => {
  const mockCreate = vi.fn();
  return {
    getPortkeyClient: vi.fn(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// Mock logger to suppress output during tests
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { generateFixedFile, groupIssuesBySourceFile, FixGenerationError } from './generator.js';
import { getPortkeyClient } from '../portkey/client.js';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'AUDIT-01',
    rule: 'missing-title-tag',
    severity: 'critical',
    pageUrl: 'https://example.com/about',
    description: 'Missing title tag',
    ...overrides,
  };
}

describe('generateFixedFile', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    const portkey = getPortkeyClient();
    mockCreate = portkey.chat.completions.create as ReturnType<typeof vi.fn>;
  });

  it('calls Portkey chat.completions.create exactly once even for multiple issues', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'const x = 1; export default function Page() { return <div>Fixed</div>; }' } }],
    });

    const issues = [
      makeIssue({ id: 'AUDIT-01', rule: 'missing-title-tag' }),
      makeIssue({ id: 'AUDIT-02', rule: 'missing-meta-description' }),
      makeIssue({ id: 'AUDIT-03', rule: 'missing-og-tags' }),
    ];

    await generateFixedFile({
      filePath: 'app/about/page.tsx',
      sourceCode: 'export default function Page() { return <div>Hello</div>; }',
      issues,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('includes all issue descriptions in the user message', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'fixed content' } }],
    });

    const issues = [
      makeIssue({ id: 'AUDIT-01', description: 'Missing title tag on about page' }),
      makeIssue({ id: 'AUDIT-02', description: 'Meta description too short' }),
    ];

    await generateFixedFile({
      filePath: 'app/about/page.tsx',
      sourceCode: '<html></html>',
      issues,
    });

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user').content;

    expect(userMessage).toContain('Missing title tag on about page');
    expect(userMessage).toContain('Meta description too short');
  });

  it('returns trimmed text content from the first choice', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '  export default function Page() { return <div>Fixed</div>; }  ' } }],
    });

    const result = await generateFixedFile({
      filePath: 'app/about/page.tsx',
      sourceCode: 'original code',
      issues: [makeIssue()],
    });

    expect(result).toBe('export default function Page() { return <div>Fixed</div>; }');
  });

  it('throws FixGenerationError when Portkey returns empty string', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
    });

    await expect(
      generateFixedFile({
        filePath: 'app/about/page.tsx',
        sourceCode: 'original code',
        issues: [makeIssue()],
      })
    ).rejects.toThrow(FixGenerationError);
  });

  it('throws FixGenerationError when Portkey returns whitespace-only response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '   \n  ' } }],
    });

    await expect(
      generateFixedFile({
        filePath: 'app/about/page.tsx',
        sourceCode: 'original code',
        issues: [makeIssue()],
      })
    ).rejects.toThrow(FixGenerationError);
  });

  it('throws FixGenerationError when choices array is empty', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [] });

    await expect(
      generateFixedFile({
        filePath: 'app/about/page.tsx',
        sourceCode: 'original code',
        issues: [makeIssue()],
      })
    ).rejects.toThrow(FixGenerationError);
  });

  it('includes the source file path in the user message', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'fixed content' } }],
    });

    await generateFixedFile({
      filePath: 'app/products/page.tsx',
      sourceCode: 'some code',
      issues: [makeIssue()],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user').content;

    expect(userMessage).toContain('app/products/page.tsx');
  });
});

describe('groupIssuesBySourceFile', () => {
  it('groups issues by resolved file path', () => {
    const issues = [
      makeIssue({ id: 'AUDIT-01', pageUrl: 'https://example.com/about' }),
      makeIssue({ id: 'AUDIT-02', pageUrl: 'https://example.com/about' }),
      makeIssue({ id: 'AUDIT-03', pageUrl: 'https://example.com/contact' }),
    ];

    const resolveSourceFile = (issue: Issue): string | null => {
      const urlMap: Record<string, string> = {
        'https://example.com/about': 'app/about/page.tsx',
        'https://example.com/contact': 'app/contact/page.tsx',
      };
      return urlMap[issue.pageUrl] ?? null;
    };

    const result = groupIssuesBySourceFile(issues, resolveSourceFile);

    expect(result.size).toBe(2);
    expect(result.get('app/about/page.tsx')).toHaveLength(2);
    expect(result.get('app/contact/page.tsx')).toHaveLength(1);
    expect(result.get('app/about/page.tsx')?.[0].id).toBe('AUDIT-01');
  });

  it('excludes issues where resolveSourceFile returns null', () => {
    const issues = [
      makeIssue({ id: 'AUDIT-01', pageUrl: 'https://example.com/about' }),
      makeIssue({ id: 'AUDIT-02', pageUrl: 'https://example.com/unmapped' }),
    ];

    const resolveSourceFile = (issue: Issue): string | null => {
      return issue.pageUrl === 'https://example.com/about' ? 'app/about/page.tsx' : null;
    };

    const result = groupIssuesBySourceFile(issues, resolveSourceFile);

    expect(result.size).toBe(1);
    expect(result.get('app/about/page.tsx')).toHaveLength(1);
  });

  it('returns empty map when all issues resolve to null', () => {
    const issues = [makeIssue()];
    const result = groupIssuesBySourceFile(issues, () => null);
    expect(result.size).toBe(0);
  });

  it('returns empty map for empty issues array', () => {
    const result = groupIssuesBySourceFile([], () => 'some-file.tsx');
    expect(result.size).toBe(0);
  });
});

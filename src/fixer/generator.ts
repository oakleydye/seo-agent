import { logger } from '../utils/logger.js';
import { getPortkeyClient } from '../portkey/client.js';
import type { Issue } from '../types/index.js';

export interface BatchFixRequest {
  filePath: string;       // relative path in repo, e.g. "app/about/page.tsx"
  sourceCode: string;     // full file content
  issues: Issue[];        // all issues for this file — batched in one LLM call
}

export class FixGenerationError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly issueIds: string[],
  ) {
    super(message);
    this.name = 'FixGenerationError';
  }
}

/**
 * Generate a fixed version of a source file by sending all issues for that
 * file to the LLM in a single batch call (batch-per-file pattern).
 *
 * Returns the full fixed file content as a string.
 * Throws FixGenerationError if LLM returns empty or non-text response.
 */
export async function generateFixedFile(request: BatchFixRequest): Promise<string> {
  const { filePath, sourceCode, issues } = request;

  const issueList = issues
    .map(i => `- [${i.severity.toUpperCase()}] Rule: ${i.rule} | Page: ${i.pageUrl} | ${i.description}${i.details ? ` | Details: ${i.details}` : ''}`)
    .join('\n');

  const userMessage = `Fix the following SEO issues in this Next.js TypeScript/JSX file.

File: ${filePath}

Issues to fix:
${issueList}

Original source code:
\`\`\`typescript
${sourceCode}
\`\`\`

Return ONLY the complete modified file content — valid TypeScript/JSX, no markdown code fences, no explanation text.`;

  const portkey = getPortkeyClient();

  logger.info(
    { filePath, issueCount: issues.length, issueIds: issues.map(i => i.id) },
    'Calling LLM to generate fix',
  );

  const response = await portkey.chat.completions.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8000,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert Next.js/React/TypeScript developer fixing SEO issues. Return ONLY the complete modified file — valid TypeScript/JSX, no markdown fences, no explanation.',
      },
      { role: 'user', content: userMessage },
    ],
  });

  const choice = response.choices?.[0];
  const text = choice?.message?.content;

  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new FixGenerationError(
      `LLM returned empty response for ${filePath}`,
      filePath,
      issues.map(i => i.id),
    );
  }

  logger.info({ filePath, responseLength: text.length }, 'LLM fix generated');
  return text.trim();
}

/**
 * Group a list of issues by their source file path.
 * resolveSourceFile maps an issue to a relative file path (or null to skip).
 * Issues where resolveSourceFile returns null are excluded.
 */
export function groupIssuesBySourceFile(
  issues: Issue[],
  resolveSourceFile: (issue: Issue) => string | null,
): Map<string, Issue[]> {
  const groups = new Map<string, Issue[]>();

  for (const issue of issues) {
    const filePath = resolveSourceFile(issue);
    if (filePath === null) continue;

    const existing = groups.get(filePath) ?? [];
    existing.push(issue);
    groups.set(filePath, existing);
  }

  return groups;
}

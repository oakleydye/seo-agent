import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Fix } from '../types/index.js';

// Mock simple-git before imports
vi.mock('simple-git', () => {
  const mockClone = vi.fn().mockResolvedValue(undefined);
  return {
    default: vi.fn(() => ({
      clone: mockClone,
    })),
  };
});

// Mock execa before imports
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// Mock node:fs promises
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    promises: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      rm: vi.fn().mockResolvedValue(undefined),
    },
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

import { validateFixedCode } from './validator.js';
import { execa } from 'execa';
import { promises as fs } from 'node:fs';

function makeFix(overrides: Partial<Fix> = {}): Fix {
  return {
    id: 'fix-01',
    category: 'title-tag',
    risk: 'low-risk',
    sourceFile: 'app/about/page.tsx',
    originalContent: 'original',
    fixedContent: 'fixed content',
    issueIds: ['AUDIT-01'],
    ...overrides,
  };
}

describe('validateFixedCode', () => {
  const mockExeca = execa as ReturnType<typeof vi.fn>;
  const mockFsMkdir = fs.mkdir as ReturnType<typeof vi.fn>;
  const mockFsWriteFile = fs.writeFile as ReturnType<typeof vi.fn>;
  const mockFsRm = fs.rm as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: npm install success
    mockExeca.mockImplementation((cmd: string, args: string[]) => {
      if (args[0] === 'install') {
        return Promise.resolve({ exitCode: 0, stdout: 'installed', stderr: '' });
      }
      // Default: npm run build success
      return Promise.resolve({ exitCode: 0, stdout: 'Build complete', stderr: '' });
    });
  });

  it('returns success=true on successful build', async () => {
    const result = await validateFixedCode({
      gitHubRepo: 'acme/website',
      fixes: [makeFix()],
    });

    expect(result.success).toBe(true);
    expect(result.buildOutput).toBe('Build complete');
    expect(result.error).toBeUndefined();
  });

  it('writes fix files to correct paths in temp dir before build runs', async () => {
    const fixes = [
      makeFix({ sourceFile: 'app/about/page.tsx', fixedContent: 'about content' }),
      makeFix({ sourceFile: 'app/contact/page.tsx', fixedContent: 'contact content' }),
    ];

    await validateFixedCode({ gitHubRepo: 'acme/website', fixes });

    // Check writeFile was called for each fix
    expect(mockFsWriteFile).toHaveBeenCalledTimes(2);
    // First fix path should contain the sourceFile
    const firstCall = mockFsWriteFile.mock.calls[0];
    expect(firstCall[0]).toContain('app/about/page.tsx');
    expect(firstCall[1]).toBe('about content');
  });

  it('returns success=false on build failure (non-zero exit code)', async () => {
    mockExeca.mockImplementation((cmd: string, args: string[]) => {
      if (args[0] === 'install') {
        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
      }
      // Build fails
      return Promise.resolve({ exitCode: 1, stdout: '', stderr: 'Module not found: Error: Can\'t resolve \'./missing\'' });
    });

    const result = await validateFixedCode({
      gitHubRepo: 'acme/website',
      fixes: [makeFix()],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Build failed');
  });

  it('returns success=false with timeout error when build exceeds timeout', async () => {
    mockExeca.mockImplementation((cmd: string, args: string[]) => {
      if (args[0] === 'install') {
        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
      }
      // Simulate timeout
      const err = Object.assign(new Error('Timed out'), { timedOut: true, stdout: '', stderr: '' });
      return Promise.reject(err);
    });

    const result = await validateFixedCode({
      gitHubRepo: 'acme/website',
      fixes: [makeFix()],
      timeoutMs: 300_000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Build timed out after 300s');
  });

  it('calls fs.rm to clean up temp directory on success', async () => {
    await validateFixedCode({ gitHubRepo: 'acme/website', fixes: [makeFix()] });

    expect(mockFsRm).toHaveBeenCalledTimes(1);
    const rmCall = mockFsRm.mock.calls[0];
    expect(rmCall[0]).toMatch(/^\/tmp\/seo-agent-fix-\d+$/);
    expect(rmCall[1]).toEqual({ recursive: true, force: true });
  });

  it('calls fs.rm to clean up temp directory even when build throws', async () => {
    mockExeca.mockImplementation((cmd: string, args: string[]) => {
      if (args[0] === 'install') {
        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
      }
      return Promise.reject(new Error('Unexpected build crash'));
    });

    await validateFixedCode({ gitHubRepo: 'acme/website', fixes: [makeFix()] });

    expect(mockFsRm).toHaveBeenCalledTimes(1);
    const rmCall = mockFsRm.mock.calls[0];
    expect(rmCall[0]).toMatch(/^\/tmp\/seo-agent-fix-\d+$/);
  });

  it('uses correct temp directory name pattern', async () => {
    const before = Date.now();
    await validateFixedCode({ gitHubRepo: 'acme/website', fixes: [makeFix()] });
    const after = Date.now();

    const rmCall = mockFsRm.mock.calls[0];
    const tempDir = rmCall[0] as string;
    const match = tempDir.match(/^\/tmp\/seo-agent-fix-(\d+)$/);
    expect(match).not.toBeNull();
    const ts = parseInt(match![1], 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('creates temp dir via fs.mkdir before writing files', async () => {
    const fixes = [makeFix({ sourceFile: 'app/about/page.tsx' })];
    await validateFixedCode({ gitHubRepo: 'acme/website', fixes });

    // mkdir should be called before writeFile
    const mkdirCalls = mockFsMkdir.mock.invocationCallOrder;
    const writeFileCalls = mockFsWriteFile.mock.invocationCallOrder;
    expect(mkdirCalls[0]).toBeLessThan(writeFileCalls[0]);
  });
});

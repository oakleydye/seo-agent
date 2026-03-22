import { promises as fs } from 'node:fs';
import path from 'node:path';
import simpleGit from 'simple-git';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';
import type { Fix } from '../types/index.js';

export interface ValidationResult {
  success: boolean;
  buildOutput: string;
  error?: string;
}

export interface ValidateFixedCodeOptions {
  gitHubRepo: string;    // "owner/repo"
  fixes: Fix[];          // fixes to apply (sourceFile + fixedContent)
  githubToken?: string;  // for authenticated clone (private repos)
  timeoutMs?: number;    // default 300_000 (5 min)
}

/**
 * Clone the client repo locally, apply all fixes to their respective source files,
 * run `npm run build` (next build), and return whether the build passed.
 *
 * This is a SOFT gate: callers should still create the PR even on failure,
 * but should label it 'needs-review' and include the build error in the description.
 *
 * Always cleans up the temp clone directory.
 */
export async function validateFixedCode(options: ValidateFixedCodeOptions): Promise<ValidationResult> {
  const { gitHubRepo, fixes, githubToken, timeoutMs = 300_000 } = options;
  const tempDir = `/tmp/seo-agent-fix-${Date.now()}`;

  const cloneUrl = githubToken
    ? `https://${githubToken}@github.com/${gitHubRepo}.git`
    : `https://github.com/${gitHubRepo}.git`;

  logger.info({ gitHubRepo, fixCount: fixes.length, tempDir }, 'Starting build validation');

  try {
    // Clone repo to temp dir
    const git = simpleGit();
    await git.clone(cloneUrl, tempDir, ['--depth', '1']);

    // Apply all fixes to their source files
    for (const fix of fixes) {
      const absPath = path.join(tempDir, fix.sourceFile);
      const dir = path.dirname(absPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(absPath, fix.fixedContent, 'utf-8');
      logger.debug({ sourceFile: fix.sourceFile }, 'Applied fix to temp clone');
    }

    // Install dependencies (required for build)
    await execa('npm', ['install', '--prefer-offline'], {
      cwd: tempDir,
      timeout: 120_000,
    });

    // Run next build
    const buildResult = await execa('npm', ['run', 'build'], {
      cwd: tempDir,
      timeout: timeoutMs,
      reject: false, // don't throw on non-zero exit — we handle it
    });

    const buildOutput = [buildResult.stdout, buildResult.stderr].filter(Boolean).join('\n');

    if (buildResult.exitCode !== 0) {
      logger.warn({ gitHubRepo, exitCode: buildResult.exitCode }, 'Build failed — will label PR as needs-review');
      return {
        success: false,
        buildOutput,
        error: `Build failed with exit code ${buildResult.exitCode}: ${buildResult.stderr?.slice(0, 500)}`,
      };
    }

    logger.info({ gitHubRepo }, 'Build validation passed');
    return { success: true, buildOutput };

  } catch (error: unknown) {
    const err = error as { timedOut?: boolean; message?: string; stdout?: string; stderr?: string };
    const buildOutput = [err.stdout, err.stderr].filter(Boolean).join('\n');

    if (err.timedOut) {
      logger.warn({ gitHubRepo, timeoutMs }, 'Build timed out');
      return { success: false, buildOutput, error: `Build timed out after ${timeoutMs / 1000}s` };
    }

    logger.error({ gitHubRepo, error: err.message }, 'Unexpected build validation error');
    return { success: false, buildOutput, error: err.message ?? 'Unknown error during build validation' };

  } finally {
    // Always clean up — even if build failed or threw
    await fs.rm(tempDir, { recursive: true, force: true }).catch(e => {
      logger.warn({ tempDir, error: (e as Error).message }, 'Failed to clean up temp dir');
    });
  }
}

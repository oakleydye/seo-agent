import { readFile } from 'node:fs/promises';
import type { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { logger } from '../../utils/logger.js';
import { loadConfig } from '../../config/loader.js';
import { runFixForSite, runFixForAllSites, type RunFixOptions } from '../../fixer/index.js';
import type { AuditFindings } from '../../types/index.js';

interface FixArgs {
  config: string;
  site?: string;
  'dry-run': boolean;
  'audit-pr'?: number;
}

export const fixCommand: CommandModule<object, FixArgs> = {
  command: 'fix',
  describe: 'Generate and submit SEO fix PRs for detected issues',
  builder: (yargs: Argv) =>
    yargs
      .option('config', {
        alias: 'c',
        type: 'string' as const,
        description: 'Path to config file',
        default: './config.json',
      })
      .option('site', {
        alias: 's',
        type: 'string' as const,
        description: 'Run fix for a specific site ID only',
      })
      .option('dry-run', {
        alias: 'd',
        type: 'boolean' as const,
        description: 'Run pipeline without creating GitHub PRs',
        default: false,
      })
      .option('audit-pr', {
        alias: 'p',
        type: 'number' as const,
        description: 'Audit PR number to link from fix PRs',
      }) as Argv<FixArgs>,
  handler: async (argv: ArgumentsCamelCase<FixArgs>) => {
    let config;
    try {
      config = loadConfig(argv.config);
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Failed to load config');
      process.exit(1);
    }

    // Load audit findings from disk for each site
    const allFindings = new Map<string, AuditFindings>();
    const runDate = new Date().toISOString().slice(0, 10);

    for (const site of config.sites) {
      const findingsPath = `.seo-agent/${site.siteId}/audit-findings-${runDate}.json`;
      try {
        const raw = JSON.parse(await readFile(findingsPath, 'utf-8'));
        allFindings.set(site.siteId, raw as AuditFindings);
      } catch {
        logger.warn({ siteId: site.siteId, findingsPath }, 'No audit findings file — skipping site');
      }
    }

    const options: RunFixOptions = {
      dryRun: argv['dry-run'],
      githubToken: process.env['GITHUB_TOKEN'],
      auditPRNumber: argv['audit-pr'],
    };

    if (argv.site) {
      const site = config.sites.find(s => s.siteId === argv.site);
      if (!site) {
        logger.error({ siteId: argv.site }, 'Site not found in config');
        process.exit(1);
      }
      const findings = allFindings.get(argv.site);
      if (!findings) {
        logger.error({ siteId: argv.site }, 'No audit findings for site');
        process.exit(1);
      }
      const result = await runFixForSite(site, findings, options);
      if (result.fixState.status === 'failed') {
        logger.error({ siteId: argv.site, error: result.fixState.error }, 'Fix pipeline failed');
        process.exit(1);
      }
      logger.info({ siteId: argv.site, prUrls: result.fixState.prUrls }, 'Fix pipeline complete');
    } else {
      const results = await runFixForAllSites(config.sites, allFindings, options);
      const failed = results.filter(r => r.fixState.status === 'failed');
      if (failed.length === results.length) {
        // All sites failed
        logger.error({ failedSites: failed.map(r => r.siteId) }, 'All sites failed');
        process.exit(1);
      }
      if (failed.length > 0) {
        logger.warn({ failedSites: failed.map(r => r.siteId) }, 'Some sites failed');
      }
    }
  },
};

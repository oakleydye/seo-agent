import type { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { logger } from '../../utils/logger.js';
import { loadConfig } from '../../config/loader.js';
import { runAuditForSite, runAuditForAllSites, type RunAuditOptions } from '../../index.js';

interface AuditArgs {
  config: string;
  site?: string;
  'dry-run': boolean;
}

export const auditCommand: CommandModule<object, AuditArgs> = {
  command: 'audit',
  describe: 'Run SEO audit for one or all configured sites',
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
        description: 'Run audit for a specific site ID only',
      })
      .option('dry-run', {
        alias: 'd',
        type: 'boolean' as const,
        description: 'Run pipeline without creating GitHub PR',
        default: false,
      }) as Argv<AuditArgs>,
  handler: async (argv: ArgumentsCamelCase<AuditArgs>) => {
    let config;
    try {
      config = loadConfig(argv.config);
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Failed to load config');
      process.exit(1);
    }

    const options: RunAuditOptions = {
      dryRun: argv['dry-run'],
      githubToken: process.env['GITHUB_TOKEN'],
      pagespeedApiKey: process.env['GOOGLE_PAGESPEED_API_KEY'],
    };

    if (argv.site) {
      const site = config.sites.find(s => s.siteId === argv.site);
      if (!site) {
        logger.error({ siteId: argv.site }, 'Site not found in config');
        process.exit(1);
      }
      const result = await runAuditForSite(site, options);
      if (result.executionState.status === 'failed') {
        logger.error({ siteId: argv.site, error: result.executionState.error }, 'Audit failed');
        process.exit(1);
      }
      logger.info({ siteId: argv.site, prUrl: result.executionState.prUrl }, 'Audit complete');
    } else {
      const results = await runAuditForAllSites(config.sites, options);
      const failed = results.filter(r => r.executionState.status === 'failed');
      if (failed.length > 0) {
        logger.warn({ failedSites: failed.map(r => r.siteId) }, 'Some sites failed');
        process.exit(1);
      }
    }
  },
};

#!/usr/bin/env node
import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../config/loader.js';
import { runAuditForAllSites } from '../index.js';
import { auditCommand } from './commands/audit.js';
import { fixCommand } from './commands/fix.js';
import cron from 'node-cron';

const cli = yargs(hideBin(process.argv))
  .scriptName('seo-agent')
  .usage('$0 <command> [options]')
  .command(auditCommand)
  .command(fixCommand)
  .command({
    command: 'schedule',
    describe: 'Start the monthly cron scheduler',
    builder: (yargs) =>
      yargs.option('config', {
        alias: 'c',
        type: 'string' as const,
        description: 'Path to config file',
        default: './config.json',
      }),
    handler: async (argv) => {
      let config;
      try {
        config = loadConfig(argv['config'] as string);
      } catch (err) {
        logger.error({ error: (err as Error).message }, 'Failed to load config');
        process.exit(1);
      }

      const expression = config.schedule.cronExpression;
      if (!cron.validate(expression)) {
        logger.error({ expression }, 'Invalid cron expression in config');
        process.exit(1);
      }

      logger.info({ expression, siteCount: config.sites.length }, 'Starting SEO agent scheduler');

      cron.schedule(expression, async () => {
        logger.info('Cron trigger: starting audit run');
        const results = await runAuditForAllSites(config!.sites, {
          githubToken: process.env['GITHUB_TOKEN'],
          pagespeedApiKey: process.env['GOOGLE_PAGESPEED_API_KEY'],
        });
        const succeeded = results.filter(r => r.executionState.status === 'complete').length;
        logger.info({ total: config!.sites.length, succeeded }, 'Cron audit run complete');
      });

      // Keep process alive
      process.on('SIGINT', () => {
        logger.info('Scheduler stopped');
        process.exit(0);
      });
    },
  })
  .demandCommand(1, 'You must specify a command')
  .help()
  .alias('h', 'help')
  .version()
  .strict();

cli.parse();

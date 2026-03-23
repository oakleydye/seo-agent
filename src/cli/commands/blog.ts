import { readFile } from 'node:fs/promises';
import type { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { logger } from '../../utils/logger.js';
import { loadConfig } from '../../config/loader.js';
import { runBlogPipelineForSite, runBlogPipelineForAllSites, type RunBlogOptions } from '../../content/index.js';
import type { KeywordOpportunity } from '../../types/index.js';

interface BlogArgs {
  config: string;
  site?: string;
  'dry-run': boolean;
  'max-posts': number;
}

export const blogCommand: CommandModule<object, BlogArgs> = {
  command: 'blog',
  describe: 'Generate and submit SEO blog post PRs targeting keyword opportunities',
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
        description: 'Run blog generation for a specific site ID only',
      })
      .option('dry-run', {
        alias: 'd',
        type: 'boolean' as const,
        description: 'Run pipeline without creating GitHub PRs',
        default: false,
      })
      .option('max-posts', {
        alias: 'm',
        type: 'number' as const,
        description: 'Maximum posts to generate per site this run',
        default: 3,
      }) as Argv<BlogArgs>,
  handler: async (argv: ArgumentsCamelCase<BlogArgs>) => {
    let config;
    try {
      config = loadConfig(argv.config);
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Failed to load config');
      process.exit(1);
    }

    // Load keyword opportunities from disk for each site
    const allKeywords = new Map<string, KeywordOpportunity[]>();
    const runDate = new Date().toISOString().slice(0, 10);

    for (const site of config.sites) {
      const keywordsPath = `.seo-agent/${site.siteId}/keyword-opportunities-${runDate}.json`;
      try {
        const raw = JSON.parse(await readFile(keywordsPath, 'utf-8'));
        allKeywords.set(site.siteId, raw as KeywordOpportunity[]);
      } catch {
        logger.warn({ siteId: site.siteId, keywordsPath }, 'No keyword opportunities file — skipping site');
      }
    }

    const options: RunBlogOptions = {
      dryRun: argv['dry-run'],
      githubToken: process.env['GITHUB_TOKEN'],
      cseId: process.env['GOOGLE_CSE_ID'],
      googleApiKey: process.env['GOOGLE_API_KEY'],
      maxPostsPerSite: argv['max-posts'],
    };

    if (argv.site) {
      const site = config.sites.find(s => s.siteId === argv.site);
      if (!site) {
        logger.error({ siteId: argv.site }, 'Site not found in config');
        process.exit(1);
      }
      const keywords = allKeywords.get(argv.site) ?? [];
      if (keywords.length === 0) {
        logger.error({ siteId: argv.site }, 'No keyword opportunities found for site');
        process.exit(1);
      }
      const result = await runBlogPipelineForSite(site, keywords, options);
      if (result.contentState.status === 'failed') {
        logger.error({ siteId: argv.site, error: result.contentState.error }, 'Blog pipeline failed');
        process.exit(1);
      }
      logger.info({
        siteId: argv.site,
        postCount: result.contentState.postCount,
        prUrls: result.contentState.prUrls,
      }, 'Blog pipeline complete');
    } else {
      const results = await runBlogPipelineForAllSites(config.sites, allKeywords, options);
      const failed = results.filter(r => r.contentState.status === 'failed');
      if (failed.length === results.length) {
        logger.error({ failedSites: failed.map(r => r.siteId) }, 'All sites failed');
        process.exit(1);
      }
      if (failed.length > 0) {
        logger.warn({ failedSites: failed.map(r => r.siteId) }, 'Some sites failed');
      }
      const totalPosts = results.reduce((sum, r) => sum + r.contentState.postCount, 0);
      logger.info({ total: config.sites.length, totalPosts }, 'Blog pipeline complete for all sites');
    }
  },
};

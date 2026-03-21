import { logger } from '../utils/logger.js';
import {
  checkTitleTags,
  checkMetaDescriptions,
  checkOpenGraphTags,
  checkHeadingHierarchy,
  checkImageAltAttributes,
  checkCanonicalTags,
  checkDuplicateContent,
} from './rules.js';
import type { PageData, Issue } from '../types/index.js';

/**
 * Run all SEO audit rules against the given page inventory.
 * Returns a flat list of all issues found across all pages.
 *
 * Rules that require cross-page comparison (duplicate title, duplicate content)
 * receive the full pages array. Per-page rules are also passed the full array
 * to keep the signature consistent.
 */
export function audit(pages: PageData[]): Issue[] {
  const successfulPages = pages.filter(p => p.statusCode === 200 && p.html);
  logger.info({ totalPages: pages.length, auditable: successfulPages.length }, 'Starting SEO audit');

  const allIssues: Issue[] = [
    ...checkTitleTags(pages),
    ...checkMetaDescriptions(pages),
    ...checkOpenGraphTags(pages),
    ...checkCanonicalTags(pages),
    ...checkHeadingHierarchy(pages),
    ...checkImageAltAttributes(pages),
    ...checkDuplicateContent(pages),
  ];

  const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  const infoCount = allIssues.filter(i => i.severity === 'info').length;

  logger.info(
    { total: allIssues.length, critical: criticalCount, warning: warningCount, info: infoCount },
    'Audit complete',
  );

  return allIssues;
}

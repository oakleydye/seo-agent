import matter from 'gray-matter';
import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger.js';
import { formatBlogPRTitle, formatBlogPRBody } from './pr-formatter.js';
import type { BlogPost, BlogPostResult } from '../types/index.js';

export interface BlogPROptions {
  gitHubRepo: string;           // "owner/repo"
  blogDirectory?: string;       // e.g. "content/blog" — default "content/blog"
  siteId: string;
  blogPost: BlogPost;
  blogPostResult: BlogPostResult;
  githubToken?: string;
}

export interface BlogPRResult {
  prUrl: string;
  prNumber: number;
  wasExisting: boolean;
  filePath: string;             // Path written to in the repo
}

/**
 * Serialize a BlogPost to Markdown with YAML frontmatter using gray-matter.
 */
function serializeBlogPost(post: BlogPost): string {
  return matter.stringify(post.content, {
    title: post.title,
    slug: post.slug,
    description: post.description,
    keywords: post.keywords,
    publishedDate: post.publishedDate,
    author: post.author,
    targetKeyword: post.targetKeyword,
  });
}

/**
 * Create (or find existing) GitHub PR for a blog post.
 * Branch naming: seo-blog/{slug}/YYYY-MM-DD
 * File path: {blogDirectory}/{slug}.md
 * Idempotent: returns existing PR if branch/PR already exists.
 */
export async function createBlogPR(options: BlogPROptions): Promise<BlogPRResult> {
  const {
    gitHubRepo,
    blogDirectory = 'content/blog',
    siteId,
    blogPost,
    blogPostResult,
  } = options;

  const token = options.githubToken ?? process.env['GITHUB_TOKEN'];
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required for PR creation');
  }

  const [owner, repo] = gitHubRepo.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid gitHubRepo format: "${gitHubRepo}" — expected "owner/repo"`);
  }

  const octokit = new Octokit({ auth: token });
  const date = blogPost.publishedDate;
  const branchName = `seo-blog/${blogPost.slug}/${date}`;
  const filePath = `${blogDirectory}/${blogPost.slug}.md`;

  const title = formatBlogPRTitle(blogPost, siteId);
  const body = formatBlogPRBody(blogPostResult, siteId);

  // ─── Check for existing PR ───────────────────────────────────────────────
  const existingPRs = await octokit.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${branchName}`,
    per_page: 1,
  });

  if (existingPRs.data.length > 0) {
    const existing = existingPRs.data[0]!;
    logger.info({ branchName, prUrl: existing.html_url }, 'Existing blog PR found — skipping creation');
    return {
      prUrl: existing.html_url,
      prNumber: existing.number,
      wasExisting: true,
      filePath,
    };
  }

  // ─── Get default branch SHA ───────────────────────────────────────────────
  const repoData = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.data.default_branch;

  const defaultBranchData = await octokit.repos.getBranch({ owner, repo, branch: defaultBranch });
  const baseSha = defaultBranchData.data.commit.sha;

  // ─── Create branch if it doesn't exist ───────────────────────────────────
  try {
    await octokit.repos.getBranch({ owner, repo, branch: branchName });
    logger.info({ branchName }, 'Blog branch already exists');
  } catch (err: unknown) {
    const octokitErr = err as { status?: number };
    if (octokitErr?.status !== 404) throw err;
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
    logger.info({ branchName }, 'Blog branch created');
  }

  // ─── Write blog post file to branch ──────────────────────────────────────
  const fileContent = serializeBlogPost(blogPost);
  const contentBase64 = Buffer.from(fileContent, 'utf-8').toString('base64');

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: `feat(content): add blog post "${blogPost.title}"`,
    content: contentBase64,
    branch: branchName,
  });

  logger.info({ filePath, branchName }, 'Blog post file committed to branch');

  // ─── Create PR ────────────────────────────────────────────────────────────
  const pr = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head: branchName,
    base: defaultBranch,
  });

  // ─── Add label ────────────────────────────────────────────────────────────
  try {
    await octokit.issues.createLabel({
      owner,
      repo,
      name: 'seo-blog-post',
      color: '0075ca',
      description: 'AI-generated SEO blog post for review',
    });
  } catch {
    // Label already exists — ignore 422
  }

  await octokit.issues.addLabels({
    owner,
    repo,
    issue_number: pr.data.number,
    labels: ['seo-blog-post'],
  });

  logger.info({ prUrl: pr.data.html_url, prNumber: pr.data.number }, 'Blog PR created');

  return {
    prUrl: pr.data.html_url,
    prNumber: pr.data.number,
    wasExisting: false,
    filePath,
  };
}

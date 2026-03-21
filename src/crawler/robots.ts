export interface RobotRules {
  disallowedPaths: string[];
}

/**
 * Parse robots.txt content and extract Disallow rules for User-agent: *
 * Only processes rules under `User-agent: *` blocks.
 * RFC: https://www.rfc-editor.org/rfc/rfc9309
 */
export function parseRobotsTxt(content: string): RobotRules {
  const lines = content.split('\n').map(l => l.trim());
  const disallowedPaths: string[] = [];

  let inStarBlock = false;
  for (const line of lines) {
    if (line.toLowerCase().startsWith('user-agent:')) {
      const agent = line.slice('user-agent:'.length).trim();
      inStarBlock = agent === '*';
    } else if (inStarBlock && line.toLowerCase().startsWith('disallow:')) {
      const path = line.slice('disallow:'.length).trim();
      if (path) {
        disallowedPaths.push(path);
      }
    }
  }

  return { disallowedPaths };
}

/**
 * Check whether a URL is allowed to be crawled per robots.txt rules.
 * Returns true if the URL path does NOT match any Disallow rule.
 */
export function isUrlAllowed(url: string, rules: RobotRules): boolean {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false; // invalid URL — don't crawl
  }

  for (const disallowed of rules.disallowedPaths) {
    if (pathname.startsWith(disallowed)) {
      return false;
    }
  }
  return true;
}

/**
 * Fetch robots.txt from the given root URL.
 * Returns permissive rules (allow all) if robots.txt is not found or fetch fails.
 */
export async function fetchRobotRules(
  rootUrl: string,
  timeoutMs: number = 10000,
): Promise<RobotRules> {
  const robotsUrl = new URL('/robots.txt', rootUrl).toString();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(robotsUrl, { signal: controller.signal as never });
    clearTimeout(timer);
    if (!response.ok) return { disallowedPaths: [] };
    const text = await response.text();
    return parseRobotsTxt(text);
  } catch {
    // robots.txt unavailable — allow all
    return { disallowedPaths: [] };
  }
}

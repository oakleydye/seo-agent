/**
 * Heuristic patterns that indicate a claim requiring human verification:
 * - [FACT-CHECK] markers explicitly added by the LLM
 * - Percentage statistics (e.g., "73% of users")
 * - Attribution phrases ("according to", "research shows", "studies show")
 * - Large number claims ("$2 billion", "5 million users")
 * - Superlative claims that imply data ("fastest", "largest", "#1")
 */
const CLAIM_PATTERNS = [
  /\[FACT-CHECK\]/i,
  /\d+(\.\d+)?\s*%/,
  /according\s+to/i,
  /research\s+shows?/i,
  /studies?\s+shows?/i,
  /\$[\d,]+\s*(million|billion|trillion)/i,
  /\d+\s*(million|billion|trillion)\s+(users?|people|customers?)/i,
  /(#1|number\s+one|fastest|largest|biggest|most\s+popular)\s+(in|for|among)/i,
];

/**
 * Split text into sentences (naive split on . ! ? followed by space or end of string).
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

/**
 * Scan blog post content for sentences containing statistical claims or
 * unsupported assertions that require human verification before merge.
 *
 * Returns deduplicated array of flagged sentences.
 */
export function flagClaims(content: string): string[] {
  const sentences = splitSentences(content);
  const flagged = new Set<string>();

  for (const sentence of sentences) {
    const matches = CLAIM_PATTERNS.some(pattern => pattern.test(sentence));
    if (matches) {
      flagged.add(sentence);
    }
  }

  return Array.from(flagged);
}

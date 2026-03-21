import pino from 'pino';

// Patterns to redact from all log output
const REDACT_PATTERNS = [
  'GITHUB_TOKEN',
  'PORTKEY_API_KEY',
  'GOOGLE_PAGESPEED_API_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'serviceAccountPath',
  'authorization',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'password',
];

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  redact: {
    paths: REDACT_PATTERNS,
    censor: '[REDACTED]',
  },
  transport: process.env['NODE_ENV'] === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

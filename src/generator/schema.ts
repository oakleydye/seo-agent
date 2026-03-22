import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { logger } from '../utils/logger.js';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export type SchemaType = 'Article' | 'BreadcrumbList' | 'WebPage' | 'Organization';

export interface SchemaData {
  title: string;
  description: string;
  url: string;
  datePublished?: string;   // ISO 8601 date (YYYY-MM-DD)
  authorName?: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
}

export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: ErrorObject[],
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

// ─── Ajv JSON Schemas for each supported type ──────────────────────────────

const articleSchema = {
  type: 'object',
  required: ['@context', '@type', 'headline', 'description', 'author', 'datePublished', 'url'],
  properties: {
    '@context': { type: 'string' },
    '@type': { type: 'string', const: 'Article' },
    headline: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    author: {
      type: 'object',
      required: ['@type', 'name'],
      properties: {
        '@type': { type: 'string' },
        name: { type: 'string' },
      },
    },
    datePublished: { type: 'string', format: 'date' },
    url: { type: 'string', format: 'uri' },
  },
};

const breadcrumbSchema = {
  type: 'object',
  required: ['@context', '@type', 'itemListElement'],
  properties: {
    '@context': { type: 'string' },
    '@type': { type: 'string', const: 'BreadcrumbList' },
    itemListElement: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['@type', 'position', 'name', 'item'],
        properties: {
          '@type': { type: 'string' },
          position: { type: 'integer', minimum: 1 },
          name: { type: 'string' },
          item: { type: 'string', format: 'uri' },
        },
      },
    },
  },
};

const webPageSchema = {
  type: 'object',
  required: ['@context', '@type', 'name', 'description', 'url'],
  properties: {
    '@context': { type: 'string' },
    '@type': { type: 'string', const: 'WebPage' },
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    url: { type: 'string', format: 'uri' },
  },
};

const organizationSchema = {
  type: 'object',
  required: ['@context', '@type', 'name', 'url', 'description'],
  properties: {
    '@context': { type: 'string' },
    '@type': { type: 'string', const: 'Organization' },
    name: { type: 'string', minLength: 1 },
    url: { type: 'string', format: 'uri' },
    description: { type: 'string', minLength: 1 },
  },
};

// Compile validators once at module load
const validators: Record<SchemaType, ReturnType<typeof ajv.compile>> = {
  Article: ajv.compile(articleSchema),
  BreadcrumbList: ajv.compile(breadcrumbSchema),
  WebPage: ajv.compile(webPageSchema),
  Organization: ajv.compile(organizationSchema),
};

// ─── Template builders ─────────────────────────────────────────────────────

export function getSchemaTemplate(type: SchemaType, data: SchemaData): Record<string, unknown> {
  switch (type) {
    case 'Article':
      return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: data.title,
        description: data.description,
        url: data.url,
        datePublished: data.datePublished ?? new Date().toISOString().slice(0, 10),
        author: {
          '@type': 'Person',
          name: data.authorName ?? 'Unknown',
        },
      };

    case 'BreadcrumbList':
      return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: (data.breadcrumbs ?? [{ name: data.title, url: data.url }]).map(
          (crumb, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: crumb.name,
            item: crumb.url,
          }),
        ),
      };

    case 'WebPage':
      return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: data.title,
        description: data.description,
        url: data.url,
      };

    case 'Organization':
      return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: data.title,
        url: data.url,
        description: data.description,
      };
  }
}

/**
 * Generate a validated <script type="application/ld+json"> string.
 * Validates the generated markup against schema.org spec using Ajv before returning.
 * Throws SchemaValidationError if validation fails.
 */
export function generateSchemaMarkup(type: SchemaType, data: SchemaData): string {
  const schema = getSchemaTemplate(type, data);
  const validate = validators[type];
  const valid = validate(schema);

  if (!valid) {
    const errors = validate.errors ?? [];
    logger.warn({ type, errors }, 'Schema validation failed');
    throw new SchemaValidationError(
      `Generated ${type} schema.org markup failed validation: ${errors.map(e => e.message).join(', ')}`,
      errors,
    );
  }

  logger.debug({ type }, 'Schema markup generated and validated');
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

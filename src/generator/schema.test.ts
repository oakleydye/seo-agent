import { describe, it, expect } from 'vitest';
import {
  generateSchemaMarkup,
  getSchemaTemplate,
  SchemaValidationError,
  type SchemaData,
  type SchemaType,
} from './schema.js';

const validArticleData: SchemaData = {
  title: 'How to Build an SEO Agent',
  description: 'A comprehensive guide to building an autonomous SEO agent.',
  url: 'https://example.com/seo-agent',
  datePublished: '2026-03-22',
  authorName: 'Jane Doe',
};

const validBreadcrumbData: SchemaData = {
  title: 'SEO Agent Guide',
  description: 'Guide description',
  url: 'https://example.com/guide',
  breadcrumbs: [
    { name: 'Home', url: 'https://example.com' },
    { name: 'Blog', url: 'https://example.com/blog' },
    { name: 'SEO Agent Guide', url: 'https://example.com/guide' },
  ],
};

describe('generateSchemaMarkup', () => {
  it('returns a string starting with <script type="application/ld+json"> and ending with </script>', () => {
    const output = generateSchemaMarkup('Article', validArticleData);
    expect(output).toMatch(/^<script type="application\/ld\+json">/);
    expect(output).toMatch(/<\/script>$/);
  });

  it('output contains @context set to https://schema.org', () => {
    const output = generateSchemaMarkup('Article', validArticleData);
    expect(output).toContain('"@context": "https://schema.org"');
  });

  it('BreadcrumbList with 3 items produces itemListElement with position 1, 2, and 3', () => {
    const output = generateSchemaMarkup('BreadcrumbList', validBreadcrumbData);
    const jsonMatch = output.match(/<script type="application\/ld\+json">\n([\s\S]+)\n<\/script>/);
    expect(jsonMatch).not.toBeNull();
    const parsed = JSON.parse(jsonMatch![1]);
    expect(parsed.itemListElement).toHaveLength(3);
    expect(parsed.itemListElement[0].position).toBe(1);
    expect(parsed.itemListElement[1].position).toBe(2);
    expect(parsed.itemListElement[2].position).toBe(3);
  });

  it('throws SchemaValidationError when Article has empty title (fails minLength: 1)', () => {
    const invalidData: SchemaData = { ...validArticleData, title: '' };
    expect(() => generateSchemaMarkup('Article', invalidData)).toThrow(SchemaValidationError);
  });

  it('throws SchemaValidationError with validationErrors array populated', () => {
    const invalidData: SchemaData = { ...validArticleData, title: '' };
    try {
      generateSchemaMarkup('Article', invalidData);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError);
      const schemaErr = err as SchemaValidationError;
      expect(schemaErr.validationErrors).toBeDefined();
      expect(Array.isArray(schemaErr.validationErrors)).toBe(true);
      expect(schemaErr.validationErrors.length).toBeGreaterThan(0);
    }
  });

  it('generates valid WebPage markup', () => {
    const output = generateSchemaMarkup('WebPage', validArticleData);
    const jsonMatch = output.match(/<script type="application\/ld\+json">\n([\s\S]+)\n<\/script>/);
    expect(jsonMatch).not.toBeNull();
    const parsed = JSON.parse(jsonMatch![1]);
    expect(parsed['@type']).toBe('WebPage');
    expect(parsed.name).toBe(validArticleData.title);
  });

  it('generates valid Organization markup', () => {
    const output = generateSchemaMarkup('Organization', validArticleData);
    const jsonMatch = output.match(/<script type="application\/ld\+json">\n([\s\S]+)\n<\/script>/);
    expect(jsonMatch).not.toBeNull();
    const parsed = JSON.parse(jsonMatch![1]);
    expect(parsed['@type']).toBe('Organization');
  });
});

describe('getSchemaTemplate', () => {
  it('returns object with @type === "Article" for Article type', () => {
    const template = getSchemaTemplate('Article', validArticleData);
    expect(template['@type']).toBe('Article');
    expect(template['@context']).toBe('https://schema.org');
  });

  it('returns object with @type === "BreadcrumbList" for BreadcrumbList type', () => {
    const template = getSchemaTemplate('BreadcrumbList', validBreadcrumbData);
    expect(template['@type']).toBe('BreadcrumbList');
  });

  it('BreadcrumbList with no breadcrumbs provided uses title/url as single item', () => {
    const dataWithoutBreadcrumbs: SchemaData = {
      title: 'Home Page',
      description: 'The homepage',
      url: 'https://example.com',
    };
    const template = getSchemaTemplate('BreadcrumbList', dataWithoutBreadcrumbs);
    const items = template.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Home Page');
    expect(items[0].item).toBe('https://example.com');
  });

  it('Article template includes headline from data.title', () => {
    const template = getSchemaTemplate('Article', validArticleData);
    expect(template.headline).toBe(validArticleData.title);
  });

  it('Article template uses default author name "Unknown" when authorName not provided', () => {
    const dataWithoutAuthor: SchemaData = {
      title: 'Test Article',
      description: 'A test article',
      url: 'https://example.com/test',
      datePublished: '2026-03-22',
    };
    const template = getSchemaTemplate('Article', dataWithoutAuthor);
    const author = template.author as Record<string, unknown>;
    expect(author.name).toBe('Unknown');
  });

  it('Article template uses today date when datePublished not provided', () => {
    const dataWithoutDate: SchemaData = {
      title: 'Test Article',
      description: 'A test article',
      url: 'https://example.com/test',
    };
    const template = getSchemaTemplate('Article', dataWithoutDate);
    // Should be a valid date string in YYYY-MM-DD format
    expect(typeof template.datePublished).toBe('string');
    expect(template.datePublished as string).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('SchemaValidationError', () => {
  it('has name "SchemaValidationError"', () => {
    const err = new SchemaValidationError('test error', []);
    expect(err.name).toBe('SchemaValidationError');
  });

  it('is an instance of Error', () => {
    const err = new SchemaValidationError('test error', []);
    expect(err).toBeInstanceOf(Error);
  });
});

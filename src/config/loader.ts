import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ConfigSchema, type Config } from '../types/index.js';

export function loadConfig(configPath: string = './config.json'): Config {
  const absolutePath = resolve(configPath);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(absolutePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to read config file at ${absolutePath}: ${(err as Error).message}`);
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid config file:\n${errors}`);
  }

  return result.data;
}

import { createHash } from 'crypto';
import { existsSync, readFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { atomicWriteOutput } from './atomicWrite.js';
import type { ScanFinding } from '../commands/scan.js';

export const SCAN_CACHE_SCHEMA_VERSION = 1;
export const DEFAULT_SCAN_CACHE_PATH = '.debughalo/cache.json';

export interface ScanCacheEntry {
  size: number;
  mtimeMs: number;
  hash: string;
  findings: Array<Omit<ScanFinding, 'preview' | 'start' | 'end'>>;
}

interface ScanCacheDocument {
  schemaVersion: number;
  configFingerprint: string;
  entries: Record<string, ScanCacheEntry>;
}

function isCacheFinding(value: unknown): value is ScanCacheEntry['findings'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const finding = value as Record<string, unknown>;
  return (
    typeof finding['file'] === 'string' &&
    typeof finding['category'] === 'string' &&
    typeof finding['detector'] === 'string' &&
    ['critical', 'high', 'medium', 'low'].includes(String(finding['severity'])) &&
    typeof finding['confidence'] === 'number' &&
    Number.isFinite(finding['confidence']) &&
    typeof finding['likelyTestValue'] === 'boolean' &&
    (finding['line'] === undefined || typeof finding['line'] === 'number') &&
    (finding['column'] === undefined || typeof finding['column'] === 'number') &&
    (finding['reason'] === undefined || typeof finding['reason'] === 'string')
  );
}

function isCacheEntry(value: unknown): value is ScanCacheEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry['size'] === 'number' &&
    Number.isFinite(entry['size']) &&
    typeof entry['mtimeMs'] === 'number' &&
    Number.isFinite(entry['mtimeMs']) &&
    typeof entry['hash'] === 'string' &&
    /^[a-f0-9]{64}$/.test(entry['hash']) &&
    Array.isArray(entry['findings']) &&
    entry['findings'].every(isCacheFinding)
  );
}

export function scanConfigFingerprint(config: {
  minConfidence: number;
  disabledCategories?: string[];
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        detectorRevision: 1,
        minConfidence: config.minConfidence,
        disabledCategories: [...(config.disabledCategories ?? [])].sort(),
      })
    )
    .digest('hex');
}

export function contentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function loadScanCache(path: string, configFingerprint: string): ScanCacheDocument {
  const empty = (): ScanCacheDocument => ({
    schemaVersion: SCAN_CACHE_SCHEMA_VERSION,
    configFingerprint,
    entries: {},
  });
  if (!existsSync(path)) return empty();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<ScanCacheDocument>;
    if (
      parsed.schemaVersion !== SCAN_CACHE_SCHEMA_VERSION ||
      parsed.configFingerprint !== configFingerprint ||
      !parsed.entries ||
      typeof parsed.entries !== 'object' ||
      Array.isArray(parsed.entries) ||
      !Object.values(parsed.entries).every(isCacheEntry)
    ) {
      return empty();
    }
    return parsed as ScanCacheDocument;
  } catch {
    return empty();
  }
}

export function writeScanCache(path: string, cache: ScanCacheDocument): void {
  atomicWriteOutput(path, `${JSON.stringify(cache, null, 2)}\n`);
}

export function scanCachePath(cwd: string): string {
  return resolve(cwd, DEFAULT_SCAN_CACHE_PATH);
}

export function clearScanCache(cwd: string): boolean {
  const path = scanCachePath(cwd);
  if (!existsSync(path)) return false;
  rmSync(path);
  return true;
}

export function scanCacheStatus(cwd: string): { path: string; exists: boolean; entries: number } {
  const path = scanCachePath(cwd);
  if (!existsSync(path)) return { path, exists: false, entries: 0 };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { entries?: unknown };
    const entries =
      parsed.entries && typeof parsed.entries === 'object' && !Array.isArray(parsed.entries)
        ? Object.keys(parsed.entries).length
        : 0;
    return { path, exists: true, entries };
  } catch {
    return { path, exists: true, entries: 0 };
  }
}

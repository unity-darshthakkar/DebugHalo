import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { mapConcurrent } from '@/cli/utils/concurrency.js';
import { outputText, runScan, type ScanOptions, type ScanResult } from '@/cli/commands/scan.js';
import { formatJson } from '@/cli/formatters/structured.js';
import { clearScanCache, scanCachePath, scanCacheStatus } from '@/cli/utils/scanCache.js';

const directories: string[] = [];
function directory(): string {
  const path = mkdtempSync(join(tmpdir(), 'debughalo-performance-'));
  directories.push(path);
  return path;
}
function write(root: string, path: string, content: string): void {
  const target = join(root, path);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, content);
}
function options(root: string, overrides: Partial<ScanOptions> = {}): ScanOptions {
  return {
    paths: [root],
    extensions: ['ts'],
    ignorePatterns: [],
    outputFormat: 'json',
    failOnFindings: false,
    verbose: false,
    cwd: root,
    cache: true,
    ...overrides,
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('large-project scan behavior', () => {
  it('bounds concurrent work and preserves input order', async () => {
    let active = 0;
    let maximum = 0;
    const result = await mapConcurrent([0, 1, 2, 3, 4, 5], 2, async (value) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active--;
      return value * 2;
    });
    expect(maximum).toBe(2);
    expect(result).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('scans hundreds of supported files with deterministic progress counts', async () => {
    const root = directory();
    for (let index = 0; index < 300; index++) {
      write(root, `src/file-${String(index).padStart(3, '0')}.ts`, 'const clean = true;');
    }
    const progress: number[] = [];
    const result = await runScan(
      options(root, {
        cache: false,
        onProgress: (completed) => progress.push(completed),
      })
    );
    expect(result.summary).toMatchObject({
      filesDiscovered: 300,
      filesScanned: 300,
      findings: 0,
    });
    expect(progress).toHaveLength(300);
    expect(progress.at(-1)).toBe(300);
  });

  it('continues independent work when a discovered file disappears', async () => {
    const root = directory();
    write(root, 'a.ts', 'const clean = true;');
    write(root, 'b.ts', 'const removed = true;');
    const result = await runScan(
      options(root, {
        cache: false,
        concurrency: 1,
        onProgress: (completed) => {
          if (completed === 1) rmSync(join(root, 'b.ts'));
        },
      })
    );
    expect(result.summary).toMatchObject({ filesScanned: 1, filesFailed: 1 });
    expect(result.errors[0]).toMatchObject({ file: 'b.ts' });
  });

  it('reuses secret-safe cached findings with deterministic structured output', async () => {
    const root = directory();
    const secret = `AIza${'Q7z_'.repeat(8)}Q7z`;
    write(root, 'a.ts', `const key = '${secret}';`);
    write(root, 'b.ts', 'const clean = true;');

    const first = await runScan(options(root));
    const second = await runScan(options(root));
    expect(first.performance).toMatchObject({ cacheHits: 0, cacheMisses: 2 });
    expect(second.performance).toMatchObject({ cacheHits: 2, cacheMisses: 0 });
    expect(formatJson(second)).toBe(formatJson(first));
    expect(readFileSync(scanCachePath(root), 'utf8')).not.toContain(secret);
  });

  it('invalidates by content hash even when cached size and mtime metadata match', async () => {
    const root = directory();
    write(root, 'value.ts', 'const value = "aaaa";');
    await runScan(options(root));
    write(root, 'value.ts', 'const value = "bbbb";');

    const path = scanCachePath(root);
    const document = JSON.parse(readFileSync(path, 'utf8'));
    const current = (await import('fs')).statSync(join(root, 'value.ts'));
    document.entries['value.ts'].size = current.size;
    document.entries['value.ts'].mtimeMs = current.mtimeMs;
    writeFileSync(path, JSON.stringify(document));

    expect((await runScan(options(root))).performance).toMatchObject({
      cacheHits: 0,
      cacheMisses: 1,
    });
  });

  it('invalidates all entries when detection configuration changes', async () => {
    const root = directory();
    write(root, 'clean.ts', 'const clean = true;');
    await runScan(options(root));
    const changed = await runScan(options(root, { minConfidence: 0.9 }));
    expect(changed.performance).toMatchObject({ cacheHits: 0, cacheMisses: 1 });
  });

  it.each([
    ['malformed', '{not json'],
    ['schema mismatch', JSON.stringify({ schemaVersion: 999, entries: {} })],
  ])('rebuilds a %s cache safely', async (_label, cacheContent) => {
    const root = directory();
    write(root, 'clean.ts', 'const clean = true;');
    write(root, '.debughalo/cache.json', cacheContent);
    const result = await runScan(options(root));
    expect(result.performance).toMatchObject({ cacheHits: 0, cacheMisses: 1 });
    expect(JSON.parse(readFileSync(scanCachePath(root), 'utf8')).schemaVersion).toBe(1);
  });

  it('rejects structurally corrupt entries instead of treating them as hits', async () => {
    const root = directory();
    write(root, 'clean.ts', 'const clean = true;');
    await runScan(options(root));
    const path = scanCachePath(root);
    const document = JSON.parse(readFileSync(path, 'utf8'));
    document.entries['clean.ts'].findings = 'not-an-array';
    writeFileSync(path, JSON.stringify(document));

    expect((await runScan(options(root))).performance).toMatchObject({
      cacheHits: 0,
      cacheMisses: 1,
    });
  });

  it('does not retain ignored-file entries and supports status and clear', async () => {
    const root = directory();
    write(root, 'active.ts', 'const active = true;');
    write(root, 'ignored.ts', 'const ignored = true;');
    await runScan(options(root, { ignorePatterns: ['ignored.ts'] }));
    const document = JSON.parse(readFileSync(scanCachePath(root), 'utf8'));
    expect(Object.keys(document.entries)).toEqual(['active.ts']);
    expect(scanCacheStatus(root)).toMatchObject({ exists: true, entries: 1 });
    expect(clearScanCache(root)).toBe(true);
    expect(clearScanCache(root)).toBe(false);
    expect(existsSync(scanCachePath(root))).toBe(false);
  });

  it('reports aggregate and grouped text summaries', () => {
    const result: ScanResult = {
      summary: {
        filesDiscovered: 5,
        filesScanned: 3,
        filesSkipped: 1,
        filesFailed: 1,
        findings: 2,
      },
      findings: [
        {
          file: 'a.ts',
          category: 'api_key',
          confidence: 0.9,
          start: 0,
          end: 1,
          detector: 'a',
          severity: 'critical',
          likelyTestValue: false,
        },
        {
          file: 'b.ts',
          category: 'email',
          confidence: 0.8,
          start: 0,
          end: 1,
          detector: 'b',
          severity: 'medium',
          likelyTestValue: false,
        },
      ],
      errors: [],
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    outputText(result, false);
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('Discovered: 5 files');
    expect(output).toContain('Skipped:    1 files');
    expect(output).toContain('Critical: 1');
    expect(output).toContain('Medium: 1');
    expect(output).toContain('Categories: api_key=1, email=1');
  });
});

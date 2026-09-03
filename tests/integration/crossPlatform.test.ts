import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { isAbsolute, join, relative, resolve, sep } from 'path';
import { discoverFiles } from '@/cli/utils/fileDiscovery.js';
import { runScan } from '@/cli/commands/scan.js';
import { runSanitize } from '@/cli/commands/sanitize.js';

describe('cross-platform filesystem behavior', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `debug-halo platform 世界 ${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it('discovers relative and absolute paths containing spaces and Unicode', async () => {
    const relativeFile = join('nested folder', '配置 file.TS');
    const absoluteFile = join(testDir, relativeFile);
    mkdirSync(join(testDir, 'nested folder'), { recursive: true });
    writeFileSync(absoluteFile, 'const value = 42;\n', 'utf8');

    const fromRelative = await discoverFiles([relativeFile], {
      cwd: testDir,
      extensions: ['ts'],
    });
    const fromAbsolute = await discoverFiles([absoluteFile], {
      cwd: testDir,
      extensions: ['TS'],
    });

    expect(fromRelative).toEqual([resolve(absoluteFile)]);
    expect(fromAbsolute).toEqual([resolve(absoluteFile)]);
    expect(isAbsolute(fromRelative[0] ?? '')).toBe(true);
    if (process.platform === 'win32') {
      expect(relativeFile).toContain('\\');
      expect(relative(testDir, fromRelative[0] ?? '')).toBe(relativeFile);
    } else {
      expect(relativeFile).toContain(sep);
    }
  });

  it('normalizes discovered separators before applying ignore globs', async () => {
    const nestedDir = join(testDir, 'nested');
    mkdirSync(nestedDir);
    writeFileSync(join(nestedDir, 'ignored.ts'), 'const value = 1;\n', 'utf8');
    writeFileSync(join(testDir, 'included.ts'), 'const value = 2;\n', 'utf8');

    const files = await discoverFiles([testDir], {
      cwd: testDir,
      extensions: ['ts'],
      ignorePatterns: ['nested/**'],
    });

    expect(files).toEqual([join(testDir, 'included.ts')]);
  });

  it('scans CRLF content and keeps a dry-run source byte-for-byte unchanged', async () => {
    const content =
      "const value = 42;\r\nconst apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';\r\n";
    const filePath = join(testDir, 'crlf secret.ts');
    writeFileSync(filePath, content, 'utf8');

    const scan = await runScan({
      paths: [filePath],
      extensions: ['ts'],
      ignorePatterns: [],
      outputFormat: 'json',
      failOnFindings: false,
      verbose: false,
      cwd: testDir,
    });
    const sanitize = await runSanitize({
      paths: [filePath],
      extensions: ['ts'],
      ignorePatterns: [],
      dryRun: true,
      verbose: false,
      cwd: testDir,
    });

    expect(scan.summary.findings).toBeGreaterThan(0);
    expect(sanitize.summary.filesChanged).toBe(1);
    expect(readFileSync(filePath, 'utf8')).toBe(content);
  });
});

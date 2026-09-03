import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

const writeMocks = vi.hoisted(() => ({
  atomicWriteFile: vi.fn(),
}));

vi.mock('@/cli/utils/atomicWrite.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/cli/utils/atomicWrite.js')>();
  return { ...actual, atomicWriteFile: writeMocks.atomicWriteFile };
});

import { runSanitize } from '@/cli/commands/sanitize.js';

describe('sanitize write safety', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `debug-halo-sanitize-write-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    writeMocks.atomicWriteFile.mockReset();
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it('does not invoke the writer during a dry run', async () => {
    const filePath = writeSecretFile();
    const original = readFileSync(filePath, 'utf8');

    const result = await sanitize(filePath, true);

    expect(result.summary.filesChanged).toBe(1);
    expect(writeMocks.atomicWriteFile).not.toHaveBeenCalled();
    expect(readFileSync(filePath, 'utf8')).toBe(original);
  });

  it('does not invoke the writer for unchanged content', async () => {
    const filePath = join(testDir, 'normal.ts');
    writeFileSync(filePath, 'const value = 42;', 'utf8');

    const result = await sanitize(filePath, false);

    expect(result.summary.filesUnchanged).toBe(1);
    expect(writeMocks.atomicWriteFile).not.toHaveBeenCalled();
  });

  it('reports an atomic replacement failure without changing the original', async () => {
    const filePath = writeSecretFile();
    const original = readFileSync(filePath, 'utf8');
    writeMocks.atomicWriteFile.mockImplementationOnce(() => {
      throw new Error('simulated atomic replacement failure');
    });

    const result = await sanitize(filePath, false);

    expect(result.summary.filesFailed).toBe(1);
    expect(result.summary.filesProcessed).toBe(0);
    expect(result.summary.filesChanged).toBe(0);
    expect(result.results[0]?.error).toBe('simulated atomic replacement failure');
    expect(result.results[0]?.error).not.toContain('1234567890abcdef');
    expect(readFileSync(filePath, 'utf8')).toBe(original);
  });

  function writeSecretFile(): string {
    const filePath = join(testDir, 'secret.ts');
    writeFileSync(
      filePath,
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';",
      'utf8'
    );
    return filePath;
  }

  function sanitize(filePath: string, dryRun: boolean) {
    return runSanitize({
      paths: [filePath],
      extensions: ['ts'],
      ignorePatterns: [],
      dryRun,
      verbose: false,
    });
  }
});

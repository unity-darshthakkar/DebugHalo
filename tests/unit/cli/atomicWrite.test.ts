import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { atomicWriteFile, type AtomicWriteOperations } from '@/cli/utils/atomicWrite.js';

function tempArtifacts(dir: string): string[] {
  return readdirSync(dir).filter((name) => name.startsWith('.debughalo-atomic-'));
}

describe('atomicWriteFile', () => {
  let testDir: string;
  let filePath: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `debug-halo-atomic-write-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    filePath = join(testDir, 'input.ts');
    writeFileSync(filePath, 'original', 'utf8');
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it('atomically replaces the original and removes the temporary file', () => {
    atomicWriteFile(filePath, 'sanitized');

    expect(readFileSync(filePath, 'utf8')).toBe('sanitized');
    expect(tempArtifacts(testDir)).toEqual([]);
  });

  it('preserves destination mode where supported', () => {
    chmodSync(filePath, 0o640);
    const originalMode = lstatSync(filePath).mode & 0o777;

    atomicWriteFile(filePath, 'sanitized');

    expect(lstatSync(filePath).mode & 0o777).toBe(originalMode);
  });

  it('leaves the original unchanged and cleans up after a temp write failure', () => {
    const operations = failingOperations('write');

    expect(() => atomicWriteFile(filePath, 'sanitized', { operations })).toThrow(
      'simulated write failure'
    );
    expect(readFileSync(filePath, 'utf8')).toBe('original');
    expect(tempArtifacts(testDir)).toEqual([]);
  });

  it('leaves the original unchanged and cleans up after a replacement failure', () => {
    const operations = failingOperations('rename');

    expect(() => atomicWriteFile(filePath, 'sanitized', { operations })).toThrow(
      'simulated rename failure'
    );
    expect(readFileSync(filePath, 'utf8')).toBe('original');
    expect(tempArtifacts(testDir)).toEqual([]);
  });
});

function failingOperations(step: 'write' | 'rename'): AtomicWriteOperations {
  return {
    lstat: lstatSync,
    open: openSync,
    write: (file, data, options) => {
      if (step === 'write') throw new Error('simulated write failure');
      return writeFileSync(file, data, options);
    },
    sync: fsyncSync,
    close: closeSync,
    chmod: chmodSync,
    rename: (oldPath, newPath) => {
      if (step === 'rename') throw new Error('simulated rename failure');
      return renameSync(oldPath, newPath);
    },
    unlink: unlinkSync,
  };
}

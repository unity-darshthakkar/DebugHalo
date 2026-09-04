import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { discoverFiles, FileDiscoveryError } from '@/cli/utils/fileDiscovery.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

function createTempDir(): string {
  const dir = join(tmpdir(), `debug-halo-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(dir: string, relPath: string, content: string = ''): string {
  const fullPath = join(dir, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content);
  return fullPath;
}

function cleanupDir(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function n(p: string): string {
  return resolve(p);
}

describe('File Discovery', { timeout: 10000 }, () => {
  let testDir: string;
  let cwd: string;

  beforeEach(() => {
    testDir = createTempDir();
    mkdirSync(join(testDir, 'src'), { recursive: true });
    cwd = testDir;
  });

  afterEach(() => cleanupDir(testDir));

  it('discovers an explicit file', async () => {
    const file = writeFile(testDir, 'config.json', '{}');
    const result = await discoverFiles([file], { cwd });
    expect(result).toEqual([resolve(file)]);
  });

  it('recursively discovers files in a directory', async () => {
    writeFile(testDir, 'root.ts', 'r');
    writeFile(join(testDir, 'src'), 'nested.ts', 'n');
    const result = await discoverFiles([testDir], { cwd });
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result).toContain(resolve(testDir, 'root.ts'));
    expect(result).toContain(resolve(testDir, 'src', 'nested.ts'));
  });

  it('discovers files from a glob pattern', async () => {
    writeFile(testDir, 'a.ts', 'a');
    writeFile(testDir, 'b.ts', 'b');
    writeFile(testDir, 'c.js', 'c');
    const result = await discoverFiles(['*.ts'], { cwd });
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.toLowerCase().endsWith('.ts'))).toBe(true);
  });

  it('filters by a single extension', async () => {
    writeFile(testDir, 'file.ts', 'ts');
    writeFile(testDir, 'file.js', 'js');
    const result = await discoverFiles([testDir], { cwd, extensions: ['ts'] });
    expect(result).toHaveLength(1);
    expect(result).toContain(resolve(testDir, 'file.ts'));
  });

  it('filters by multiple extensions', async () => {
    writeFile(testDir, 'file.ts', 'ts');
    writeFile(testDir, 'file.js', 'js');
    writeFile(testDir, 'file.json', 'json');
    const result = await discoverFiles([testDir], { cwd, extensions: ['ts', 'js'] });
    expect(result).toHaveLength(2);
    expect(
      result.every((f) => f.toLowerCase().endsWith('.ts') || f.toLowerCase().endsWith('.js'))
    ).toBe(true);
  });

  it('respects .gitignore', async () => {
    writeFile(testDir, 'app.ts', 'app');
    writeFile(testDir, 'secret.key', 'secret');
    writeFile(testDir, '.gitignore', '*.key');
    const result = await discoverFiles([testDir], { cwd, respectGitignore: true });
    expect(result).toHaveLength(1);
    expect(result).toContain(resolve(testDir, 'app.ts'));
  });

  it('loads .gitignore from a target directory that is not cwd', async () => {
    const targetDir = join(testDir, 'target');
    writeFile(targetDir, 'app.ts', 'app');
    writeFile(targetDir, 'secret.key', 'secret');
    writeFile(targetDir, '.gitignore', '*.key');

    const result = await discoverFiles([targetDir], {
      cwd: testDir,
      respectGitignore: true,
    });

    expect(result).toEqual([resolve(targetDir, 'app.ts')]);
  });

  it('respects CLI ignore patterns', async () => {
    writeFile(testDir, 'app.ts', 'app');
    writeFile(testDir, 'secret.key', 'secret');
    const result = await discoverFiles([testDir], { cwd, ignorePatterns: ['*.key'] });
    expect(result).toHaveLength(1);
    expect(result).toContain(resolve(testDir, 'app.ts'));
  });

  it('respects .debughaloignore independently of .gitignore', async () => {
    writeFile(testDir, 'app.ts', 'app');
    writeFile(testDir, 'fixture.secret', 'secret');
    writeFile(testDir, '.debughaloignore', '*.secret');
    const result = await discoverFiles([testDir], { cwd, respectGitignore: false });
    expect(result).toEqual([resolve(testDir, 'app.ts')]);
  });

  it('excludes default directories, including local vault storage', async () => {
    writeFile(join(testDir, '.git'), 'config', 'git');
    writeFile(join(testDir, 'node_modules', 'pkg'), 'index.js', 'mod');
    writeFile(join(testDir, 'dist'), 'bundle.js', 'bundle');
    writeFile(join(testDir, 'coverage'), 'report.json', '{}');
    writeFile(join(testDir, '.debughalo'), 'vault.json', 'plaintext mapping');
    writeFile(testDir, 'app.ts', 'app');
    const result = await discoverFiles([testDir], { cwd });
    expect(result).toHaveLength(1);
    expect(result).toContain(resolve(testDir, 'app.ts'));
  });

  it('does not discover files when .debughalo is passed explicitly', async () => {
    const vaultDirectory = join(testDir, '.debughalo');
    writeFile(vaultDirectory, 'vault.json', 'plaintext mapping');
    expect(await discoverFiles([vaultDirectory], { cwd })).toEqual([]);
  });

  it('deduplicates overlapping inputs', async () => {
    const file = writeFile(testDir, 'app.ts', 'app');
    const result = await discoverFiles([file, '*.ts'], { cwd });
    expect(result).toEqual([resolve(file)]);
  });

  it('returns deterministic sorted order', async () => {
    const fileC = writeFile(testDir, 'c.ts', 'c');
    const fileA = writeFile(testDir, 'a.ts', 'a');
    const fileB = writeFile(testDir, 'b.ts', 'b');
    const r1 = await discoverFiles([testDir], { cwd });
    const r2 = await discoverFiles([testDir], { cwd });
    expect(r1.map(n)).toEqual(r2.map(n));
    expect(r1.map(n)).toEqual([n(fileA), n(fileB), n(fileC)]);
  });

  it('throws FileDiscoveryError when all inputs are missing', async () => {
    await expect(discoverFiles(['/nonexistent/file.ts'], { cwd })).rejects.toThrow(
      FileDiscoveryError
    );
  });

  it('returns empty array when filters eliminate all files', async () => {
    writeFile(testDir, 'file.txt', 'txt');
    const result = await discoverFiles([testDir], { cwd, extensions: ['ts'] });
    expect(result).toHaveLength(0);
  });

  it('handles paths containing spaces', async () => {
    const file = writeFile(testDir, 'my file.ts', 'content');
    const result = await discoverFiles([file], { cwd });
    expect(result).toEqual([resolve(file)]);
  });

  it('accepts both "ts" and ".ts" extension forms', async () => {
    writeFile(testDir, 'a.ts', 'a');
    writeFile(testDir, 'b.js', 'b');
    const r1 = await discoverFiles([testDir], { cwd, extensions: ['ts'] });
    const r2 = await discoverFiles([testDir], { cwd, extensions: ['.ts'] });
    expect(r1.map(n)).toEqual(r2.map(n));
    expect(r1).toHaveLength(1);
  });
});

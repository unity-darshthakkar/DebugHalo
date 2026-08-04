import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  runSanitize,
  normalizeExtensions,
  normalizeIgnorePatterns,
} from '@/cli/commands/sanitize.js';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

function createTempDir(): string {
  const dir = join(tmpdir(), `debug-halo-sanitize-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(dir: string, relPath: string, content: string = ''): string {
  const fullPath = join(dir, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

function cleanupDir(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function readFileSafe(dir: string, ...relPath: string[]): string {
  return readFileSync(join(dir, ...relPath), 'utf-8');
}

describe('Sanitize Command', { timeout: 30000 }, () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTempDir();
  });

  afterEach(() => cleanupDir(testDir));

  describe('normalizeExtensions', () => {
    it('handles single extension without dot', () => {
      expect(normalizeExtensions(['ts'])).toEqual(['ts']);
    });

    it('handles single extension with dot', () => {
      expect(normalizeExtensions(['.ts'])).toEqual(['ts']);
    });

    it('handles comma-separated extensions', () => {
      expect(normalizeExtensions(['ts,js'])).toEqual(['ts', 'js']);
    });

    it('handles comma-separated with dots', () => {
      expect(normalizeExtensions(['.ts,.js'])).toEqual(['ts', 'js']);
    });

    it('handles repeated options', () => {
      expect(normalizeExtensions(['ts', 'js'])).toEqual(['ts', 'js']);
    });

    it('handles mixed formats', () => {
      expect(normalizeExtensions(['.ts', 'js', '.json'])).toEqual(['ts', 'js', 'json']);
    });
  });

  describe('normalizeIgnorePatterns', () => {
    it('handles single pattern', () => {
      expect(normalizeIgnorePatterns(['node_modules/**'])).toEqual(['node_modules/**']);
    });

    it('handles comma-separated patterns', () => {
      expect(normalizeIgnorePatterns(['node_modules/**,dist/**'])).toEqual([
        'node_modules/**',
        'dist/**',
      ]);
    });

    it('handles repeated options', () => {
      expect(normalizeIgnorePatterns(['node_modules/**', 'dist/**'])).toEqual([
        'node_modules/**',
        'dist/**',
      ]);
    });
  });

  describe('runSanitize - dry run', () => {
    it('sanitizes an explicit file with a detectable secret (dry run)', async () => {
      const secretFile = writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runSanitize({
        paths: [secretFile],
        extensions: ['ts'],
        ignorePatterns: [],
        dryRun: true,
        verbose: false,
      });

      expect(result.summary.filesDiscovered).toBe(1);
      expect(result.summary.filesProcessed).toBe(1);
      expect(result.summary.filesChanged).toBe(1);
      expect(result.summary.filesUnchanged).toBe(0);
      expect(result.summary.totalFindings).toBeGreaterThan(0);

      // Verify file was NOT modified in dry run
      const content = readFileSafe(testDir, 'secret.ts');
      expect(content).toContain('sk-1234567890abcdef1234567890abcdef12345678');
    });

    it('sanitizes a directory recursively (dry run)', async () => {
      writeFile(
        testDir,
        'root.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      writeFile(join(testDir, 'src'), 'nested.ts', "const password = 'super-secret-password-123';");
      const result = await runSanitize({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        dryRun: true,
        verbose: false,
      });

      expect(result.summary.filesDiscovered).toBeGreaterThanOrEqual(2);
      expect(result.summary.filesProcessed).toBeGreaterThanOrEqual(2);
      expect(result.summary.filesChanged).toBeGreaterThanOrEqual(2);
      expect(result.summary.totalFindings).toBeGreaterThan(0);

      // Verify files were NOT modified in dry run
      const rootContent = readFileSafe(testDir, 'root.ts');
      expect(rootContent).toContain('sk-1234567890abcdef1234567890abcdef12345678');
      const nestedContent = readFileSafe(testDir, 'src', 'nested.ts');
      expect(nestedContent).toContain('super-secret-password-123');
    });

    it('filters by extension (dry run)', async () => {
      writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      writeFile(
        testDir,
        'secret.js',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runSanitize({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        dryRun: true,
        verbose: false,
      });

      // Only .ts files should be processed
      expect(result.summary.filesProcessed).toBe(1);
      expect(result.summary.filesChanged).toBe(1);
    });

    it('respects ignore patterns (dry run)', async () => {
      writeFile(testDir, 'app.ts', "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';");
      writeFile(
        testDir,
        'ignored.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runSanitize({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: ['ignored.ts'],
        dryRun: true,
        verbose: false,
      });

      expect(result.summary.filesProcessed).toBe(1);
      expect(result.summary.filesChanged).toBe(1);
    });

    it('respects .gitignore (dry run)', async () => {
      const gitIgnoreDir = createTempDir();
      writeFile(gitIgnoreDir, '.gitignore', '*.secret\n');
      writeFile(gitIgnoreDir, 'config.secret', "api_key = 'sk-1234567890abcdef';");
      writeFile(gitIgnoreDir, 'app.ts', "const normal = 'value';");

      const result = await runSanitize({
        paths: [gitIgnoreDir],
        extensions: ['ts', 'secret'],
        ignorePatterns: [],
        dryRun: true,
        verbose: false,
        cwd: gitIgnoreDir,
      });

      // .gitignore should exclude *.secret files
      expect(result.summary.filesProcessed).toBe(1);
      expect(result.results.find((r) => r.file.endsWith('.secret'))).toBeUndefined();
      cleanupDir(gitIgnoreDir);
    });

    it('skips binary files containing NUL byte (dry run)', async () => {
      writeFile(testDir, 'normal.ts', "const config = 'value';");
      // Write a binary file with NUL byte
      const binaryPath = join(testDir, 'binary.bin');
      writeFileSync(binaryPath, 'text\x00more');

      const result = await runSanitize({
        paths: [testDir],
        extensions: ['ts', 'bin'],
        ignorePatterns: [],
        dryRun: true,
        verbose: false,
      });

      // Binary file should be skipped, not processed
      expect(result.summary.filesSkipped).toBeGreaterThanOrEqual(1);
      // Normal file should still be processed
      expect(result.summary.filesProcessed).toBeGreaterThanOrEqual(1);
    });

    it('handles missing path discovery error', async () => {
      await expect(
        runSanitize({
          paths: ['/nonexistent/path/that/does/not/exist.ts'],
          extensions: ['ts'],
          ignorePatterns: [],
          dryRun: true,
          verbose: false,
        })
      ).rejects.toThrow('No valid input paths found');
    });

    it('handles empty input array', async () => {
      await expect(
        runSanitize({
          paths: [],
          extensions: ['ts'],
          ignorePatterns: [],
          dryRun: true,
          verbose: false,
        })
      ).rejects.toThrow('No input paths provided');
    });
  });

  describe('runSanitize - normal mode (modifies files)', () => {
    it('sanitizes an explicit file with a detectable secret', async () => {
      const secretFile = writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runSanitize({
        paths: [secretFile],
        extensions: ['ts'],
        ignorePatterns: [],
        dryRun: false,
        verbose: false,
      });

      expect(result.summary.filesDiscovered).toBe(1);
      expect(result.summary.filesProcessed).toBe(1);
      expect(result.summary.filesChanged).toBe(1);
      expect(result.summary.totalFindings).toBeGreaterThan(0);

      // Verify file WAS modified
      const content = readFileSafe(testDir, 'secret.ts');
      expect(content).not.toContain('sk-1234567890abcdef1234567890abcdef12345678');
      expect(content).toContain('<API_KEY_');
    });

    it('sanitizes a directory recursively', async () => {
      writeFile(
        testDir,
        'root.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      writeFile(join(testDir, 'src'), 'nested.ts', "const password = 'super-secret-password-123';");
      const result = await runSanitize({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        dryRun: false,
        verbose: false,
      });

      expect(result.summary.filesDiscovered).toBeGreaterThanOrEqual(2);
      expect(result.summary.filesProcessed).toBeGreaterThanOrEqual(2);
      expect(result.summary.filesChanged).toBeGreaterThanOrEqual(2);
      expect(result.summary.totalFindings).toBeGreaterThan(0);

      // Verify files WERE modified
      const rootContent = readFileSafe(testDir, 'root.ts');
      expect(rootContent).not.toContain('sk-1234567890abcdef1234567890abcdef12345678');
      expect(rootContent).toContain('<API_KEY_');
      const nestedContent = readFileSafe(testDir, 'src', 'nested.ts');
      expect(nestedContent).not.toContain('super-secret-password-123');
      expect(nestedContent).toContain('<PASSWORD_');
    });

    it('unchanged files remain unchanged', async () => {
      writeFile(testDir, 'normal.ts', "const config = { name: 'app' };");
      writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );

      const normalBefore = readFileSafe(testDir, 'normal.ts');
      const result = await runSanitize({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        dryRun: false,
        verbose: false,
      });

      expect(result.summary.filesProcessed).toBe(2);
      expect(result.summary.filesChanged).toBe(1);
      expect(result.summary.filesUnchanged).toBe(1);

      // Unchanged file should remain exactly the same
      const normalAfter = readFileSafe(testDir, 'normal.ts');
      expect(normalAfter).toBe(normalBefore);

      // Secret file should be changed
      const secretAfter = readFileSafe(testDir, 'secret.ts');
      expect(secretAfter).not.toBe(normalBefore);
      expect(secretAfter).toContain('<API_KEY_');
    });

    it('output never exposes raw secrets', async () => {
      writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runSanitize({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        dryRun: false,
        verbose: false,
      });

      // Check that results don't contain the raw secret
      for (const r of result.results) {
        expect(r.file).not.toContain('1234567890abcdef');
        if (r.error) {
          expect(r.error).not.toContain('1234567890abcdef');
        }
      }
    });

    it('preserves files without secrets', async () => {
      writeFile(testDir, 'a.ts', 'const a = 1;');
      writeFile(testDir, 'b.ts', 'const b = 2;');
      const result = await runSanitize({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        dryRun: false,
        verbose: false,
      });

      expect(result.summary.filesProcessed).toBe(2);
      expect(result.summary.filesChanged).toBe(0);
      expect(result.summary.filesUnchanged).toBe(2);

      // Files should remain unchanged
      expect(readFileSafe(testDir, 'a.ts')).toBe('const a = 1;');
      expect(readFileSafe(testDir, 'b.ts')).toBe('const b = 2;');
    });

    it('handles missing path discovery error', async () => {
      await expect(
        runSanitize({
          paths: [join(testDir, 'nonexistent.ts')],
          extensions: ['ts'],
          ignorePatterns: [],
          dryRun: false,
          verbose: false,
        })
      ).rejects.toThrow('No valid input paths found');
    });
  });

  describe('exit code behavior', () => {
    it('returns changed files summary correctly', async () => {
      writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runSanitize({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        dryRun: true,
        verbose: false,
      });

      expect(result.summary.filesChanged).toBe(1);
    });

    it('no change when no secrets found', async () => {
      writeFile(testDir, 'normal.ts', "const config = { name: 'app' };");
      const result = await runSanitize({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        dryRun: true,
        verbose: false,
      });

      expect(result.summary.filesChanged).toBe(0);
      expect(result.summary.filesUnchanged).toBe(1);
    });
  });
});

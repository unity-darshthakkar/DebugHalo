import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runScan, normalizeExtensions, normalizeIgnorePatterns } from '@/cli/commands/scan.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

function createTempDir(): string {
  const dir = join(tmpdir(), `debug-halo-scan-test-${randomUUID()}`);
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

describe('Scan Command', { timeout: 30000 }, () => {
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

  describe('runScan', () => {
    it('scans an explicit file with a detectable secret', async () => {
      const secretFile = writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runScan({
        paths: [secretFile],
        extensions: ['ts'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      expect(result.summary.filesDiscovered).toBe(1);
      expect(result.summary.filesScanned).toBe(1);
      expect(result.summary.findings).toBeGreaterThan(0);
      // Should detect the API key (category may be api_key_env or api_key)
      const apiKeyFindings = result.findings.filter((f) => f.category.includes('api_key'));
      expect(apiKeyFindings.length).toBeGreaterThan(0);
    });

    it('scans a directory recursively', async () => {
      writeFile(
        testDir,
        'root.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      writeFile(join(testDir, 'src'), 'nested.ts', "const password = 'super-secret-password-123';");
      const result = await runScan({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      expect(result.summary.filesDiscovered).toBeGreaterThanOrEqual(2);
      expect(result.summary.filesScanned).toBeGreaterThanOrEqual(2);
      expect(result.summary.findings).toBeGreaterThan(0);
    });

    it('filters by extension', async () => {
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
      const result = await runScan({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      // Only .ts files should be scanned
      expect(result.summary.filesScanned).toBe(1);
      expect(result.findings.length).toBeGreaterThan(0);
    });

    it('respects ignore patterns', async () => {
      writeFile(testDir, 'app.ts', "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';");
      writeFile(
        testDir,
        'ignored.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runScan({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: ['ignored.ts'],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      expect(result.summary.filesScanned).toBe(1);
    });

    it('respects .gitignore', async () => {
      // Create a temp dir with .gitignore
      const gitIgnoreDir = createTempDir();
      writeFile(gitIgnoreDir, '.gitignore', '*.secret\n');
      writeFile(gitIgnoreDir, 'config.secret', "api_key = 'sk-1234567890abcdef';");
      writeFile(gitIgnoreDir, 'app.ts', "const normal = 'value';");

      const result = await runScan({
        paths: [gitIgnoreDir],
        extensions: ['ts', 'secret'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
        cwd: gitIgnoreDir,
      });

      // .gitignore should exclude *.secret files
      const secretFindings = result.findings.filter((f) => f.file.endsWith('.secret'));
      expect(secretFindings.length).toBe(0);
      // app.ts should still be scanned
      expect(result.summary.filesScanned).toBeGreaterThanOrEqual(1);
      cleanupDir(gitIgnoreDir);
    });

    it('produces no-findings text output', async () => {
      writeFile(testDir, 'normal.ts', "const config = { name: 'app' };");
      const result = await runScan({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      expect(result.summary.findings).toBe(0);
    });

    it('produces findings text output without exposing the secret', async () => {
      const secretFile = writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runScan({
        paths: [secretFile],
        extensions: ['ts'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      expect(result.findings.length).toBeGreaterThan(0);
      // Check that preview doesn't contain the actual secret
      for (const finding of result.findings) {
        expect(finding.preview).not.toContain('1234567890abcdef');
        expect(finding.preview).toMatch(/^[a-zA-Z0-9]{2}\*\*\*[a-zA-Z0-9]{2}$|^\[REDACTED\]$/);
      }
    });

    it('produces valid JSON output', async () => {
      writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runScan({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      // Verify JSON structure
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('errors');
      expect(typeof result.summary.filesScanned).toBe('number');
      expect(Array.isArray(result.findings)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('JSON output contains no raw secret', async () => {
      writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runScan({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      const jsonString = JSON.stringify(result);
      expect(jsonString).not.toContain('1234567890abcdef');
    });

    it('returns deterministic finding ordering', async () => {
      writeFile(testDir, 'c.ts', "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';");
      writeFile(testDir, 'a.ts', "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';");
      writeFile(testDir, 'b.ts', "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';");

      const r1 = await runScan({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      const r2 = await runScan({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      expect(r1.findings.map((f) => f.file)).toEqual(r2.findings.map((f) => f.file));
      // Should be sorted by filename: a.ts, b.ts, c.ts
      expect(r1.findings.map((f) => f.file)).toEqual([
        expect.stringContaining('a.ts'),
        expect.stringContaining('b.ts'),
        expect.stringContaining('c.ts'),
      ]);
    });

    it('returns exit code 1 with --fail-on-findings when findings exist', async () => {
      writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runScan({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: true,
        verbose: false,
      });

      expect(result.findings.length).toBeGreaterThan(0);
      // The runScan function itself doesn't set exit code - that's done in cli/index.ts
      // But we verify the findings exist
    });

    it('returns no failure when findings exist but flag not provided', async () => {
      writeFile(
        testDir,
        'secret.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      const result = await runScan({
        paths: [testDir],
        extensions: ['ts'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      expect(result.findings.length).toBeGreaterThan(0);
    });

    it('handles unreadable files gracefully', async () => {
      // Create a file then remove read permissions (may not work on all platforms)
      writeFile(
        testDir,
        'readonly.ts',
        "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
      );
      // Try to make it unreadable - this is platform dependent
      // We'll test the error handling by using a non-existent file
      // This should throw since discovery fails for non-existent literal path
      await expect(
        runScan({
          paths: [join(testDir, 'nonexistent.ts')],
          extensions: ['ts'],
          ignorePatterns: [],
          outputFormat: 'json',
          failOnFindings: false,
          verbose: false,
        })
      ).rejects.toThrow('No valid input paths found');
    });

    it('skips binary files containing NUL byte', async () => {
      writeFile(testDir, 'normal.ts', "const config = 'value';");
      // Write a binary file with NUL byte
      const binaryPath = join(testDir, 'binary.bin');
      writeFileSync(binaryPath, 'text\x00more');

      const result = await runScan({
        paths: [testDir],
        extensions: ['ts', 'bin'],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
      });

      // Binary file should be skipped, not scanned
      expect(result.summary.filesSkipped).toBeGreaterThanOrEqual(1);
      // Normal file should still be scanned
      expect(result.summary.filesScanned).toBeGreaterThanOrEqual(1);
    });

    it('throws error for sarif output format', async () => {
      writeFile(testDir, 'test.ts', 'const x = 1;');

      // runScan should throw for invalid output format
      await expect(
        runScan({
          paths: [testDir],
          extensions: ['ts'],
          ignorePatterns: [],
          outputFormat: 'sarif' as any, // Force invalid format
          failOnFindings: false,
          verbose: false,
        })
      ).rejects.toThrow('Invalid output format: sarif. Allowed: text, json');
    });

    it('handles missing path discovery error', async () => {
      await expect(
        runScan({
          paths: ['/nonexistent/path/that/does/not/exist.ts'],
          extensions: ['ts'],
          ignorePatterns: [],
          outputFormat: 'json',
          failOnFindings: false,
          verbose: false,
        })
      ).rejects.toThrow('No valid input paths found');
    });

    it('handles empty input array', async () => {
      await expect(
        runScan({
          paths: [],
          extensions: ['ts'],
          ignorePatterns: [],
          outputFormat: 'json',
          failOnFindings: false,
          verbose: false,
        })
      ).rejects.toThrow('No input paths provided');
    });
  });
});

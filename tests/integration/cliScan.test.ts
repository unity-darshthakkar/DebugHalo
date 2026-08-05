import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

function createTempDir(): string {
  const dir = join(tmpdir(), `debug-halo-integration-${randomUUID()}`);
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

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): Promise<CliResult> {
  const CLI_PATH = resolve('dist/cli/index.js');
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolvePromise({ exitCode: code ?? 0, stdout, stderr });
    });

    child.on('error', (err) => {
      resolvePromise({ exitCode: 2, stdout, stderr: err.message });
    });
  });
}

describe('CLI Integration - Scan Command', { timeout: 30000 }, () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = createTempDir();
    // Ensure build is up to date
    const { exitCode } = await runCli(['--version']);
    if (exitCode !== 0) {
      throw new Error('CLI not built, run npm run build first');
    }
  });

  afterEach(() => cleanupDir(testDir));

  it('scans a file with secret and outputs text format', async () => {
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const { stdout, exitCode } = await runCli(['scan', testDir]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Found');
    expect(stdout).toContain('API_KEY_ENV'); // actual category name in output
    expect(stdout).not.toContain('1234567890abcdef'); // secret not exposed
  });

  it('scans a directory recursively', async () => {
    writeFile(testDir, 'root.ts', "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';");
    writeFile(join(testDir, 'src'), 'nested.ts', "const password = 'super-secret-password-123';");

    const { stdout, exitCode } = await runCli(['scan', testDir]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Found');
    expect(stdout).toContain('API_KEY_ENV');
  });

  it('outputs JSON with --output json', async () => {
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const { stdout, exitCode } = await runCli(['scan', testDir, '--output', 'json']);

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('errors');
    expect(result.summary.filesScanned).toBeGreaterThan(0);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('JSON output contains no raw secret', async () => {
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const { stdout } = await runCli(['scan', testDir, '--output', 'json']);

    expect(stdout).not.toContain('1234567890abcdef');
  });

  it('returns exit code 1 with --fail-on-findings when findings exist', async () => {
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const { exitCode } = await runCli(['scan', testDir, '--fail-on-findings']);

    expect(exitCode).toBe(1);
  });

  it('returns exit code 0 with --fail-on-findings when no findings', async () => {
    writeFile(testDir, 'normal.ts', "const config = { name: 'app' };");

    const { exitCode } = await runCli(['scan', testDir, '--fail-on-findings']);

    expect(exitCode).toBe(0);
  });

  it('returns exit code 2 for invalid output format', async () => {
    const { exitCode } = await runCli(['scan', testDir, '--output', 'sarif']);

    expect(exitCode).toBe(2);
  });

  it('filters by extension with --ext', async () => {
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

    const { stdout } = await runCli(['scan', testDir, '--ext', 'ts', '--output', 'json']);

    const result = JSON.parse(stdout);
    expect(result.summary.filesScanned).toBe(1);
  });

  it('respects ignore patterns with --ignore', async () => {
    writeFile(testDir, 'app.ts', "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';");
    writeFile(
      testDir,
      'ignored.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const { stdout } = await runCli([
      'scan',
      testDir,
      '--ignore',
      'ignored.ts',
      '--output',
      'json',
    ]);

    const result = JSON.parse(stdout);
    expect(result.summary.filesScanned).toBe(1);
  });

  it('shows help with --help', async () => {
    const { stdout, exitCode } = await runCli(['scan', '--help']);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Scan files for secrets and PII');
    expect(stdout).toContain('--ext');
    expect(stdout).toContain('--ignore');
    expect(stdout).toContain('--output');
    expect(stdout).toContain('--fail-on-findings');
  });

  it('shows version', async () => {
    const { stdout, exitCode } = await runCli(['version']);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('DebugHalo');
  });

  it('handles missing path gracefully', async () => {
    const { exitCode, stderr } = await runCli(['scan', '/nonexistent/path.ts']);

    expect(exitCode).toBe(2);
    expect(stderr).toContain('No valid input paths found');
  });

  it('JSON output with --verbose keeps stdout clean', async () => {
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const { stdout, stderr, exitCode } = await runCli([
      'scan',
      testDir,
      '--output',
      'json',
      '--verbose',
    ]);

    expect(exitCode).toBe(0);

    // stdout must be valid JSON
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('errors');

    // stdout must not contain debug/skip prefixes
    expect(stdout).not.toContain('[DEBUG]');
    expect(stdout).not.toContain('[SKIP]');

    // neither stream must contain the raw secret
    expect(stdout).not.toContain('1234567890abcdef');
    expect(stderr).not.toContain('1234567890abcdef');

    // stderr may contain diagnostics
    expect(stderr).toContain('[DEBUG] Verbose mode enabled');
  });

  it('JSON output with --verbose and binary file keeps stdout clean', async () => {
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );
    // Create a binary file with NUL byte
    writeFile(testDir, 'binary.ts', "const binary\x00file = 'test';");

    const { stdout, stderr, exitCode } = await runCli([
      'scan',
      testDir,
      '--output',
      'json',
      '--verbose',
    ]);

    expect(exitCode).toBe(0);

    // stdout must be valid JSON
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('errors');

    // stdout must not contain debug/skip prefixes
    expect(stdout).not.toContain('[DEBUG]');
    expect(stdout).not.toContain('[SKIP]');

    // neither stream must contain the raw secret
    expect(stdout).not.toContain('1234567890abcdef');
    expect(stderr).not.toContain('1234567890abcdef');

    // stderr may contain diagnostics
    expect(stderr).toContain('[DEBUG] Verbose mode enabled');
    expect(stderr).toContain('[SKIP]');
    expect(stderr).toContain('binary.ts: Binary file skipped');
  });
});

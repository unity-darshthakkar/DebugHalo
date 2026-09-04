import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
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
  it('reports structured service-credential quality fields in JSON', async () => {
    writeFile(testDir, 'google.ts', `const key = 'AIza${'Ab3_'.repeat(8)}Ab3';`);
    const { stdout, exitCode } = await runCli(['scan', testDir, '--output', 'json']);
    const output = JSON.parse(stdout);
    expect(exitCode).toBe(0);
    expect(output.findings[0]).toMatchObject({
      category: 'google_api_key',
      severity: 'high',
      detector: 'service-credential-detector',
      likelyTestValue: false,
    });
    expect(output.findings[0].reason).toContain('Google API key');
  });

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
    const { exitCode } = await runCli(['scan', testDir, '--format', 'xml']);

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

  it('supports --format json with a stable secret-free schema', async () => {
    const secret = `AIza${'Z9x_'.repeat(8)}Z9x`;
    writeFile(testDir, 'secret.ts', `const key = '${secret}';`);
    const { stdout, exitCode } = await runCli(['scan', testDir, '--format', 'json']);
    const output = JSON.parse(stdout);
    expect(exitCode).toBe(0);
    expect(output.schemaVersion).toBe('1.0');
    expect(output.findings[0]).toMatchObject({
      category: 'google_api_key',
      detector: 'service-credential-detector',
      severity: 'high',
    });
    expect(output.findings[0]).not.toHaveProperty('preview');
    expect(stdout).not.toContain(secret);
    expect(stdout).not.toContain('\u001b[');
  });

  it('outputs independently parseable JSONL records', async () => {
    writeFile(testDir, 'secret.ts', `const key = 'AIza${'Z9x_'.repeat(8)}Z9x';`);
    const { stdout, exitCode } = await runCli(['scan', testDir, '--format', 'jsonl']);
    const records = stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(exitCode).toBe(0);
    expect(records.some((record) => record.type === 'finding')).toBe(true);
    expect(records.at(-1)).toMatchObject({ type: 'summary', schemaVersion: '1.0' });
  });

  it('honors a config-driven machine format', async () => {
    writeFile(testDir, 'clean.ts', 'const clean = true;');
    const config = writeFile(testDir, 'debughalo.json', JSON.stringify({ outputFormat: 'jsonl' }));
    const { stdout, exitCode } = await runCli(['--config', config, 'scan', testDir]);
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.trim())).toMatchObject({
      type: 'summary',
      schemaVersion: '1.0',
      findings: 0,
    });
  });

  it('writes SARIF to a file without mixing output into stdout', async () => {
    const secret = `AIza${'Z9x_'.repeat(8)}Z9x`;
    writeFile(testDir, 'secret.ts', `const key = '${secret}';`);
    const outputPath = join(testDir, 'debughalo.sarif');
    const { stdout, exitCode } = await runCli([
      'scan',
      testDir,
      '--format',
      'sarif',
      '--output',
      outputPath,
    ]);
    const sarifText = readFileSync(outputPath, 'utf8');
    const sarif = JSON.parse(sarifText);
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].tool.driver.name).toBe('DebugHalo');
    expect(sarif.runs[0].results).toHaveLength(1);
    expect(sarifText).not.toContain(secret);
  });

  it.each(['json', 'jsonl'] as const)('writes %s output to a file', async (format) => {
    writeFile(testDir, 'secret.ts', `const key = 'AIza${'Z9x_'.repeat(8)}Z9x';`);
    const outputPath = join(testDir, `debughalo.${format}`);
    const { stdout, exitCode } = await runCli([
      'scan',
      testDir,
      '--format',
      format,
      '--output',
      outputPath,
    ]);
    const content = readFileSync(outputPath, 'utf8');
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    if (format === 'json') expect(JSON.parse(content).schemaVersion).toBe('1.0');
    else
      expect(
        content
          .trim()
          .split('\n')
          .every((line) => JSON.parse(line))
      ).toBe(true);
  });

  it('reports output write failures without emitting a partial document', async () => {
    writeFile(testDir, 'clean.ts', 'const clean = true;');
    const { stdout, stderr, exitCode } = await runCli([
      'scan',
      testDir,
      '--format',
      'json',
      '--output',
      testDir,
    ]);
    expect(exitCode).toBe(2);
    expect(stdout).toBe('');
    expect(stderr).toContain('Refusing to sanitize non-regular file');
  });

  it('supports quiet text output without changing finding exit codes', async () => {
    writeFile(testDir, 'secret.ts', `const key = 'AIza${'Z9x_'.repeat(8)}Z9x';`);
    const result = await runCli(['scan', testDir, '--quiet', '--fail-on-findings']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
  });

  it('guarantees no ANSI sequences with --no-color', async () => {
    writeFile(testDir, 'secret.ts', `const key = 'AIza${'Z9x_'.repeat(8)}Z9x';`);
    const { stdout } = await runCli(['scan', testDir, '--no-color']);
    expect(stdout).toContain('DebugHalo Scan Results');
    expect(stdout).not.toContain('\u001b[');
  });
});

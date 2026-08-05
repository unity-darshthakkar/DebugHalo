import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

function createTempDir(): string {
  const dir = join(tmpdir(), `debug-halo-init-integration-${randomUUID()}`);
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

function readFile(dir: string, ...relPath: string[]): string {
  return readFileSync(join(dir, ...relPath), 'utf-8');
}

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], workingDir: string): Promise<CliResult> {
  const CLI_PATH = resolve('dist/cli/index.js');
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: workingDir,
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

describe('CLI Integration - Init Command', { timeout: 30000 }, () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = createTempDir();
    // Ensure build is up to date
    const { exitCode } = await runCli(['--version'], process.cwd());
    if (exitCode !== 0) {
      throw new Error('CLI not built, run npm run build first');
    }
  });

  afterEach(() => cleanupDir(testDir));

  it('creates default .debughalo.json in current directory', async () => {
    const { stdout, stderr, exitCode } = await runCli(['init'], testDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Created config file');
    expect(stderr).toBe('');

    const configPath = join(testDir, '.debughalo.json');
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFile(testDir, '.debughalo.json'));
    expect(config.extensions).toEqual(['ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml', 'env']);
    expect(config.ignorePatterns).toEqual(['node_modules/**', 'dist/**', '.git/**']);
    expect(config.outputFormat).toBe('text');
    expect(config.failOnFindings).toBe(false);
    expect(config.dryRun).toBeUndefined();
  });

  it('refuses to overwrite existing config without --force', async () => {
    // Create existing config
    writeFile(testDir, '.debughalo.json', JSON.stringify({ custom: 'value' }));

    const { stderr, exitCode } = await runCli(['init'], testDir);

    expect(exitCode).toBe(2);
    expect(stderr).toContain('Config file already exists');
    expect(stderr).toContain('--force');

    // Original config should be unchanged
    const config = JSON.parse(readFile(testDir, '.debughalo.json'));
    expect(config.custom).toBe('value');
  });

  it('overwrites existing config with --force', async () => {
    // Create existing config
    writeFile(testDir, '.debughalo.json', JSON.stringify({ custom: 'value' }));

    const { stdout, stderr, exitCode } = await runCli(['init', '--force'], testDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Created config file');
    expect(stderr).toBe('');

    // Config should be replaced with defaults
    const config = JSON.parse(readFile(testDir, '.debughalo.json'));
    expect(config.extensions).toEqual(['ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml', 'env']);
    expect(config.custom).toBeUndefined();
  });

  it('shows help with --help', async () => {
    const { stdout, exitCode } = await runCli(['init', '--help'], testDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Initialize DebugHalo configuration');
    expect(stdout).toContain('--force');
    expect(stdout).toContain('Overwrite existing config');
  });

  it('creates valid JSON that can be used by scan command', async () => {
    await runCli(['init'], testDir);

    // Write a test file with secret
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const { stdout, exitCode } = await runCli(['scan', testDir], testDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Found');
  });

  it('creates valid JSON that can be used by sanitize command', async () => {
    await runCli(['init'], testDir);

    // Write a test file with secret
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const { stdout, exitCode } = await runCli(['sanitize', testDir, '--dry-run'], testDir);

    expect(exitCode).toBe(1); // would change
    expect(stdout).toContain('Would change: 1 file');
  });

  it('config file is formatted with pretty printing', async () => {
    await runCli(['init'], testDir);

    const content = readFile(testDir, '.debughalo.json');
    expect(content).toContain('  "extensions"');
    expect(content).not.toContain('\t');
    expect(content).toMatch(/^\{\s*$/m);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

function createTempDir(): string {
  const dir = join(tmpdir(), `debug-halo-sanitize-integration-${randomUUID()}`);
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

describe('CLI Integration - Sanitize Command', { timeout: 30000 }, () => {
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

  it('sanitizes a file with secret and outputs text format (dry run)', async () => {
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const originalContent = readFile(testDir, 'secret.ts');

    const { stdout, stderr, exitCode } = await runCli(['sanitize', testDir, '--dry-run'], testDir);

    expect(exitCode).toBe(1); // Files would be changed
    expect(stdout).toContain('DebugHalo Sanitize Results');
    expect(stdout).toContain('[DRY RUN]');
    expect(stdout).toContain('Would change: 1 file');
    expect(stderr).not.toContain('1234567890abcdef'); // secret not exposed in stderr

    // File should be unchanged in dry run
    const content = readFile(testDir, 'secret.ts');
    expect(content).toBe(originalContent);
    expect(content).toContain('sk-1234567890abcdef1234567890abcdef12345678');
  });

  it('sanitizes a file with secret (normal mode)', async () => {
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const { stdout, stderr, exitCode } = await runCli(['sanitize', testDir], testDir);

    expect(exitCode).toBe(1); // Files changed
    expect(stdout).toContain('DebugHalo Sanitize Results');
    expect(stdout).not.toContain('[DRY RUN]');
    expect(stdout).toContain('Changed: 1 file');
    expect(stderr).not.toContain('1234567890abcdef'); // secret not exposed in stderr

    // File should be modified
    const content = readFile(testDir, 'secret.ts');
    expect(content).not.toContain('sk-1234567890abcdef1234567890abcdef12345678');
    expect(content).toContain('<API_KEY_');
  });

  it('sanitizes a directory recursively', async () => {
    writeFile(testDir, 'root.ts', "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';");
    writeFile(join(testDir, 'src'), 'nested.ts', "const password = 'super-secret-password-123';");

    const { stdout, exitCode } = await runCli(['sanitize', testDir], testDir);

    expect(exitCode).toBe(1);
    expect(stdout).toContain('Changed: 2 file');

    const rootContent = readFile(testDir, 'root.ts');
    expect(rootContent).toContain('<API_KEY_');
    expect(rootContent).not.toContain('sk-1234567890abcdef');

    const nestedContent = readFile(testDir, 'src', 'nested.ts');
    expect(nestedContent).toContain('<PASSWORD_');
    expect(nestedContent).not.toContain('super-secret-password-123');
  });

  it('dry-run leaves files unchanged', async () => {
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );
    const originalContent = readFile(testDir, 'secret.ts');

    const { exitCode } = await runCli(['sanitize', testDir, '--dry-run'], testDir);

    expect(exitCode).toBe(1);

    // File should be unchanged
    const content = readFile(testDir, 'secret.ts');
    expect(content).toBe(originalContent);
  });

  it('normal mode modifies files', async () => {
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );
    const originalContent = readFile(testDir, 'secret.ts');

    const { exitCode } = await runCli(['sanitize', testDir], testDir);

    expect(exitCode).toBe(1);

    // File should be modified
    const content = readFile(testDir, 'secret.ts');
    expect(content).not.toBe(originalContent);
    expect(content).toContain('<API_KEY_');
    expect(content).not.toContain('sk-1234567890abcdef1234567890abcdef12345678');
  });

  it('unchanged files remain unchanged', async () => {
    writeFile(testDir, 'normal.ts', "const config = { name: 'app' };");
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const normalBefore = readFile(testDir, 'normal.ts');

    const { stdout, exitCode } = await runCli(['sanitize', testDir], testDir);

    expect(exitCode).toBe(1);
    expect(stdout).toContain('Changed: 1 file');
    expect(stdout).toMatch(/Unchanged:\s+1 file\(s\)/);

    // Unchanged file should remain exactly the same
    const normalAfter = readFile(testDir, 'normal.ts');
    expect(normalAfter).toBe(normalBefore);

    // Secret file should be changed
    const secretAfter = readFile(testDir, 'secret.ts');
    expect(secretAfter).not.toBe(normalBefore);
    expect(secretAfter).toContain('<API_KEY_');
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

    const { stdout, exitCode } = await runCli(['sanitize', testDir, '--ext', 'ts'], testDir);

    expect(exitCode).toBe(1);
    expect(stdout).toContain('Changed: 1 file');

    // Only .ts file should be modified
    const tsContent = readFile(testDir, 'secret.ts');
    expect(tsContent).toContain('<API_KEY_');

    const jsContent = readFile(testDir, 'secret.js');
    expect(jsContent).toContain('sk-1234567890abcdef1234567890abcdef12345678');
  });

  it('respects ignore patterns with --ignore', async () => {
    writeFile(testDir, 'app.ts', "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';");
    writeFile(
      testDir,
      'ignored.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const { stdout, exitCode } = await runCli(
      ['sanitize', testDir, '--ignore', 'ignored.ts'],
      testDir
    );

    expect(exitCode).toBe(1);
    expect(stdout).toContain('Changed: 1 file');

    const appContent = readFile(testDir, 'app.ts');
    expect(appContent).toContain('<API_KEY_');

    const ignoredContent = readFile(testDir, 'ignored.ts');
    expect(ignoredContent).toContain('sk-1234567890abcdef1234567890abcdef12345678');
  });

  it('respects .gitignore', async () => {
    writeFile(testDir, '.gitignore', '*.secret\n');
    writeFile(testDir, 'config.secret', "api_key = 'sk-1234567890abcdef';");
    writeFile(testDir, 'app.ts', "const normal = 'value';");

    const { stdout, exitCode } = await runCli(['sanitize', testDir, '--ext', 'ts,secret'], testDir);

    expect(exitCode).toBe(0); // No changes since app.ts has no secrets
    expect(stdout).toContain('No files would be changed');

    // .secret file should remain unchanged (ignored by .gitignore)
    const secretContent = readFile(testDir, 'config.secret');
    expect(secretContent).toBe("api_key = 'sk-1234567890abcdef';");
  });

  it('skips binary files containing NUL byte', async () => {
    writeFile(testDir, 'normal.ts', "const config = 'value';");
    // Write a binary file with NUL byte
    const binaryPath = join(testDir, 'binary.bin');
    writeFileSync(binaryPath, 'text\x00more');

    const { stdout, exitCode } = await runCli(['sanitize', testDir, '--ext', 'ts,bin'], testDir);

    expect(exitCode).toBe(0); // normal.ts has no secrets
    expect(stdout).toContain('Skipped:');

    // normal.ts should be unchanged
    const normalContent = readFile(testDir, 'normal.ts');
    expect(normalContent).toBe("const config = 'value';");
  });

  it('handles missing path gracefully (exit code 2)', async () => {
    const { exitCode, stderr } = await runCli(['sanitize', '/nonexistent/path.ts'], testDir);

    expect(exitCode).toBe(2);
    expect(stderr).toContain('No valid input paths found');
  });

  it('output never exposes raw secrets', async () => {
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const { stdout, stderr } = await runCli(['sanitize', testDir], testDir);

    expect(stdout).not.toContain('1234567890abcdef');
    expect(stderr).not.toContain('1234567890abcdef');
  });

  it('shows help with --help', async () => {
    const { stdout, exitCode } = await runCli(['sanitize', '--help'], testDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Sanitize files by removing detected secrets/PII');
    expect(stdout).toContain('--ext');
    expect(stdout).toContain('--ignore');
    expect(stdout).toContain('--dry-run');
  });
});

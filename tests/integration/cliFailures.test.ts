import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

describe('CLI failure paths', { timeout: 30000 }, () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `debug-halo-cli-failures-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it.each([
    { name: 'unknown command', args: ['unknown-command'], expected: 'unknown command' },
    { name: 'unknown option', args: ['scan', '--unknown-option'], expected: 'unknown option' },
  ])('reports $name once on stderr with exit code 2', async ({ args, expected }) => {
    const result = await runCli(args);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr.toLowerCase()).toContain(expected);
    expect(result.stderr).not.toContain('CommanderError');
    expect(result.stderr).not.toContain('\n    at ');
    expect(result.stderr.toLowerCase().match(new RegExp(expected, 'g'))).toHaveLength(1);
  });

  it('reports malformed config once without a stack trace', async () => {
    writeFileSync(join(testDir, '.debughalo.json'), '{ invalid json', 'utf8');

    const result = await runCli(['scan', '.']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr.match(/Invalid JSON in config file/g)).toHaveLength(1);
    expect(result.stderr).not.toContain('\n    at ');
  });

  it('reports a missing explicit config once without a stack trace', async () => {
    const result = await runCli(['--config', 'missing.json', 'scan', '.']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr.match(/Config file not found/g)).toHaveLength(1);
    expect(result.stderr).not.toContain('\n    at ');
  });

  it('reports discovery failure once on stderr', async () => {
    const result = await runCli(['scan', 'missing-input.ts']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr.match(/No valid input paths found/g)).toHaveLength(1);
    expect(result.stderr).not.toContain('\n    at ');
  });

  it('uses the current directory when scan input is omitted', async () => {
    writeFileSync(join(testDir, 'clean.ts'), 'const value = 42;', 'utf8');

    const result = await runCli(['scan']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('No potential secrets or PII found');
  });

  it('keeps JSON stdout parseable while verbose diagnostics use stderr', async () => {
    writeFileSync(join(testDir, 'clean.ts'), 'const value = 42;', 'utf8');

    const result = await runCli(['--verbose', 'scan', '.', '--output', 'json']);

    expect(result.exitCode).toBe(0);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(result.stderr).toContain('[DEBUG] Verbose mode enabled');
    expect(result.stdout).not.toContain('[DEBUG]');
  });

  function runCli(args: string[]): Promise<CliResult> {
    const cliPath = resolve('dist/cli/index.js');
    return new Promise((resolveResult) => {
      const child = spawn(process.execPath, [cliPath, ...args], {
        cwd: testDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => (stdout += data.toString()));
      child.stderr.on('data', (data) => (stderr += data.toString()));
      child.on('close', (code) => resolveResult({ exitCode: code ?? 2, stdout, stderr }));
      child.on('error', (error) =>
        resolveResult({ exitCode: 2, stdout, stderr: `${stderr}${error.message}` })
      );
    });
  }
});

import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runSanitize } from '@/cli/commands/sanitize.js';
import { runRestore } from '@/cli/commands/restore.js';
import { runShare } from '@/cli/commands/share.js';

const directories: string[] = [];
function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), 'debughalo-reversible-'));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const google = `AIza${'Ab3_'.repeat(8)}Ab3`;

describe('reversible CLI command implementations', () => {
  it('writes a sanitized copy, preserves its source, and persists mappings', async () => {
    const cwd = fixture();
    const source = join(cwd, 'input.log');
    const output = join(cwd, 'copy.log');
    const vault = join(cwd, '.debughalo', 'vault.json');
    writeFileSync(source, `key=${google}`);
    const result = await runSanitize({
      paths: [source],
      extensions: [],
      ignorePatterns: [],
      dryRun: false,
      verbose: false,
      cwd,
      outputPath: output,
      vaultPath: vault,
      persistVault: true,
    });
    expect(readFileSync(source, 'utf8')).toBe(`key=${google}`);
    expect(readFileSync(output, 'utf8')).toBe('key=<GOOGLE_API_KEY_1>');
    expect(result.results[0]?.outputFile).toBe('copy.log');
    expect(readFileSync(vault, 'utf8')).not.toBe('');
  });

  it('rejects a copy path that is the source', async () => {
    const cwd = fixture();
    const source = join(cwd, 'input.log');
    writeFileSync(source, `key=${google}`);
    await expect(
      runSanitize({
        paths: [source],
        extensions: [],
        ignorePatterns: [],
        dryRun: false,
        verbose: false,
        cwd,
        outputPath: source,
      })
    ).rejects.toThrow('must not be the source');
  });

  it('rejects colliding external basenames before writing either output', async () => {
    const cwd = fixture();
    const firstDirectory = fixture();
    const secondDirectory = fixture();
    const first = join(firstDirectory, 'shared.log');
    const second = join(secondDirectory, 'shared.log');
    const output = join(cwd, 'out', 'shared.sanitized.log');
    writeFileSync(first, `first=${google}`);
    writeFileSync(second, `second=${google}`);

    await expect(
      runSanitize({
        paths: [first, second],
        extensions: [],
        ignorePatterns: [],
        dryRun: false,
        verbose: false,
        cwd,
        outputDirectory: 'out',
      })
    ).rejects.toThrow('same output path');

    expect(existsSync(output)).toBe(false);
    expect(existsSync(join(cwd, 'out'))).toBe(false);
  });

  it('restores known repeated aliases, leaves unknown aliases, and supports dry-run', async () => {
    const cwd = fixture();
    const source = join(cwd, 'input.log');
    const copy = join(cwd, 'copy.log');
    const vault = join(cwd, '.debughalo', 'vault.json');
    writeFileSync(source, `a=${google}\nb=${google}`);
    await runSanitize({
      paths: [source],
      extensions: [],
      ignorePatterns: [],
      dryRun: false,
      verbose: false,
      cwd,
      outputPath: copy,
      vaultPath: vault,
      persistVault: true,
    });
    writeFileSync(copy, `${readFileSync(copy, 'utf8')}\nunknown=<API_KEY_99>`);
    const dry = await runRestore({ paths: [copy], cwd, vaultPath: vault, dryRun: true });
    expect(dry.filesChanged).toBe(1);
    expect(readFileSync(copy, 'utf8')).toContain('<GOOGLE_API_KEY_1>');
    const restored = await runRestore({ paths: [copy], cwd, vaultPath: vault });
    expect(restored.aliasesRestored).toBe(2);
    expect(restored.unresolvedAliases).toBe(1);
    expect(readFileSync(copy, 'utf8')).toBe(`a=${google}\nb=${google}\nunknown=<API_KEY_99>`);
  });

  it('shares into copies, persists the vault, and validates the result', async () => {
    const cwd = fixture();
    const source = join(cwd, 'error.log');
    const vault = join(cwd, '.debughalo', 'vault.json');
    writeFileSync(source, `key=${google}`);
    const result = await runShare({
      paths: [source],
      cwd,
      extensions: [],
      ignorePatterns: [],
      outputDirectory: 'out',
      vaultPath: vault,
    });
    expect(result.safe).toBe(true);
    expect(readFileSync(source, 'utf8')).toBe(`key=${google}`);
    expect(readFileSync(join(cwd, 'out', 'error.sanitized.log'), 'utf8')).toContain(
      '<GOOGLE_API_KEY_1>'
    );
    expect(existsSync(vault)).toBe(true);
  });

  it('respects ignored inputs without failing validation', async () => {
    const cwd = fixture();
    writeFileSync(join(cwd, '.debughaloignore'), '*.log');
    writeFileSync(join(cwd, 'ignored.log'), `key=${google}`);
    const result = await runShare({
      paths: [cwd],
      cwd,
      extensions: [],
      ignorePatterns: [],
      outputDirectory: 'out',
      vaultPath: join(cwd, '.debughalo', 'vault.json'),
    });
    expect(result.safe).toBe(true);
    expect(result.sanitization.summary.filesProcessed).toBe(0);
    expect(result.validation.summary.filesScanned).toBe(0);
  });

  it('rejects a share output directory outside the working directory', async () => {
    const cwd = fixture();
    writeFileSync(join(cwd, 'input.log'), `key=${google}`);
    await expect(
      runShare({
        paths: ['input.log'],
        cwd,
        extensions: [],
        ignorePatterns: [],
        outputDirectory: '..',
        vaultPath: join(cwd, '.debughalo', 'vault.json'),
      })
    ).rejects.toThrow('must be a child');
  });
});

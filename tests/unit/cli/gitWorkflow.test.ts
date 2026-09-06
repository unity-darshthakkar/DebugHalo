import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runScan } from '@/cli/commands/scan.js';
import {
  GitError,
  getHookStatus,
  installHook,
  listStagedFiles,
  resolveHooksDirectory,
  uninstallHook,
} from '@/cli/utils/git.js';

const directories: string[] = [];
function repository(withSpace = false): string {
  const root = mkdtempSync(join(tmpdir(), withSpace ? 'debughalo git ' : 'debughalo-git-'));
  directories.push(root);
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'debughalo@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'DebugHalo Test'], { cwd: root });
  return root;
}
function git(root: string, args: string[]): void {
  execFileSync('git', args, { cwd: root, stdio: 'ignore' });
}
function write(root: string, path: string, content: string): string {
  const file = join(root, path);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
  return file;
}
function commit(root: string, path: string): void {
  git(root, ['add', '--', path]);
  git(root, ['commit', '--quiet', '-m', 'fixture']);
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const google = `AIza${'H7k_'.repeat(8)}H7k`;

describe('Git staged workflow', () => {
  it('reads staged index content and excludes unstaged and untracked content', () => {
    const root = repository();
    write(root, 'staged.ts', 'const clean = true;');
    git(root, ['add', '--', 'staged.ts']);
    write(root, 'staged.ts', `const key = '${google}';`);
    write(root, 'untracked.ts', `const key = '${google}';`);
    const staged = listStagedFiles(root);
    expect(staged.files.map((file) => file.path)).toEqual(['staged.ts']);
    expect(staged.files[0]?.content.toString()).toBe('const clean = true;');
  });

  it('handles staged renames, paths with spaces, and staged deletions', () => {
    const root = repository(true);
    write(root, 'old name.ts', 'const clean = true;');
    commit(root, 'old name.ts');
    git(root, ['mv', 'old name.ts', 'new name.ts']);
    expect(listStagedFiles(root).files.map((file) => file.path)).toEqual(['new name.ts']);
    git(root, ['commit', '--quiet', '-m', 'rename']);
    rmSync(join(root, 'new name.ts'));
    git(root, ['add', '-u']);
    expect(listStagedFiles(root).files).toEqual([]);
  });

  it('scans only supported staged snapshots and preserves suppression and ignore rules', async () => {
    const root = repository();
    write(root, '.debughaloignore', 'ignored.ts\n');
    write(root, 'active.ts', `const key = '${google}';`);
    write(root, 'ignored.ts', `const key = '${google}';`);
    write(root, 'suppressed.ts', `const key = '${google}'; // debughalo-ignore`);
    write(root, 'unsupported.bin', google);
    git(root, [
      'add',
      '-f',
      '--',
      '.debughaloignore',
      'active.ts',
      'ignored.ts',
      'suppressed.ts',
      'unsupported.bin',
    ]);
    const result = await runScan({
      paths: [],
      extensions: ['ts'],
      ignorePatterns: [],
      outputFormat: 'json',
      failOnFindings: false,
      verbose: false,
      cwd: root,
      staged: true,
    });
    expect(result.summary.filesDiscovered).toBe(2);
    expect(result.findings.map((finding) => finding.file)).toEqual(['active.ts']);
  });

  it('returns a clean result when nothing is staged and errors outside a repository', async () => {
    const root = repository();
    const result = await runScan({
      paths: [],
      extensions: [],
      ignorePatterns: [],
      outputFormat: 'json',
      failOnFindings: false,
      verbose: false,
      cwd: root,
      staged: true,
    });
    expect(result.summary).toMatchObject({ filesDiscovered: 0, filesScanned: 0, findings: 0 });
    const outside = mkdtempSync(join(tmpdir(), 'debughalo-no-git-'));
    directories.push(outside);
    await expect(
      runScan({
        paths: [],
        extensions: [],
        ignorePatterns: [],
        outputFormat: 'json',
        failOnFindings: false,
        verbose: false,
        cwd: outside,
        staged: true,
      })
    ).rejects.toBeInstanceOf(GitError);
  });

  it('installs, reports, and uninstalls an idempotent managed hook', () => {
    const root = repository();
    const installed = installHook(root);
    expect(installed.state).toBe('installed');
    expect(getHookStatus(root).state).toBe('installed');
    expect(installHook(root).state).toBe('installed');
    expect(readFileSync(installed.hookPath, 'utf8')).toContain('scan --staged --fail-on-findings');
    expect(uninstallHook(root).state).toBe('not-installed');
    expect(uninstallHook(root).state).toBe('not-installed');
  });

  it('refuses unrelated and malformed hooks without changing them', () => {
    const root = repository();
    const hook = join(resolveHooksDirectory(root), 'pre-commit');
    mkdirSync(join(hook, '..'), { recursive: true });
    writeFileSync(hook, '#!/bin/sh\necho user-hook\n');
    expect(() => installHook(root)).toThrow('was not modified');
    expect(readFileSync(hook, 'utf8')).toContain('user-hook');
    writeFileSync(hook, '# >>> DebugHalo managed pre-commit hook >>>\n');
    expect(() => getHookStatus(root)).toThrow('Malformed');
  });

  it('supports core.hooksPath and creates its missing directory', () => {
    const root = repository(true);
    git(root, ['config', 'core.hooksPath', 'custom hooks']);
    const status = installHook(root);
    const actualStat = statSync(status.hooksDirectory);
    const expectedStat = statSync(join(root, 'custom hooks'));
    expect(actualStat.dev).toBe(expectedStat.dev);
    expect(actualStat.ino).toBe(expectedStat.ino);
    expect(existsSync(join(root, 'custom hooks', 'pre-commit'))).toBe(true);
  });

  it('reports hook installation filesystem failures without replacing anything', () => {
    const root = repository();
    const hooksPath = write(root, 'not-a-directory', 'keep me');
    git(root, ['config', 'core.hooksPath', hooksPath]);
    expect(() => installHook(root)).toThrow('Unable to install');
    expect(readFileSync(hooksPath, 'utf8')).toBe('keep me');
  });

  it('blocks safely when the project-local CLI is unavailable', () => {
    const root = repository();
    installHook(root);
    write(root, 'clean.ts', 'const clean = true;');
    git(root, ['add', '--', 'clean.ts']);
    let output = '';
    try {
      execFileSync('git', ['commit', '--quiet', '-m', 'blocked'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string };
      output = `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
    }
    expect(output).toContain('could not find the local CLI');
    expect(() =>
      execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, stdio: 'ignore' })
    ).toThrow();
  });

  it('installed hook allows clean staged content and blocks a staged secret safely', () => {
    const root = repository();
    const bin = join(root, 'node_modules', '.bin');
    mkdirSync(bin, { recursive: true });
    const cli = join(process.cwd(), 'dist', 'cli', 'index.js').replaceAll('\\', '/');
    const shim = join(bin, 'debug-halo');
    writeFileSync(
      shim,
      `#!/bin/sh\nexec "${process.execPath.replaceAll('\\', '/')}" "${cli}" "$@"\n`
    );
    chmodSync(shim, 0o755);
    installHook(root);

    write(root, 'clean.ts', 'const clean = true;');
    write(root, 'unstaged.ts', `const key = '${google}';`);
    git(root, ['add', '--', 'clean.ts']);
    expect(() =>
      execFileSync('git', ['commit', '--quiet', '-m', 'clean'], { cwd: root, encoding: 'utf8' })
    ).not.toThrow();

    const secret = write(root, 'secret.ts', `const key = '${google}';`);
    git(root, ['add', '--', 'secret.ts']);
    const unstaged = `const key = '${google}';\nconst unstaged = true;`;
    writeFileSync(secret, unstaged);
    let output = '';
    try {
      execFileSync('git', ['commit', '--quiet', '-m', 'blocked'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string };
      output = `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
    }
    expect(output).toContain('Commit blocked');
    expect(output).not.toContain(google);
  }, 15000);
});

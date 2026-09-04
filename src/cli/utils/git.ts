import { execFileSync } from 'child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';

const START_MARKER = '# >>> DebugHalo managed pre-commit hook >>>';
const END_MARKER = '# <<< DebugHalo managed pre-commit hook <<<';

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitError';
  }
}

function git(
  cwd: string,
  args: string[],
  encoding: BufferEncoding | 'buffer' = 'utf8'
): string | Buffer {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: encoding === 'buffer' ? 'buffer' : encoding,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new GitError('Git command failed; ensure this is a valid Git repository');
  }
}

export function findGitRoot(cwd = process.cwd()): string {
  return (git(cwd, ['rev-parse', '--show-toplevel']) as string).trim();
}

export function resolveHooksDirectory(cwd = process.cwd()): string {
  const root = findGitRoot(cwd);
  try {
    const path = (
      git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']) as string
    ).trim();
    return resolve(path);
  } catch {
    let configured = '';
    try {
      configured = (git(root, ['config', '--get', 'core.hooksPath']) as string).trim();
    } catch {
      // An unset config key exits non-zero.
    }
    if (configured) return isAbsolute(configured) ? configured : resolve(root, configured);
    const gitDirectory = (git(root, ['rev-parse', '--git-dir']) as string).trim();
    return resolve(root, gitDirectory, 'hooks');
  }
}

export interface StagedGitFile {
  path: string;
  content: Buffer;
}

export function listStagedFiles(cwd = process.cwd()): { root: string; files: StagedGitFile[] } {
  const root = findGitRoot(cwd);
  const output = git(root, [
    'diff',
    '--cached',
    '--name-only',
    '-z',
    '--diff-filter=ACMR',
    '--',
  ]) as Buffer;
  const paths = output.toString('utf8').split('\0').filter(Boolean);
  const files: StagedGitFile[] = [];
  for (const path of paths) {
    const stage = (git(root, ['ls-files', '--stage', '-z', '--', path]) as Buffer).toString('utf8');
    const mode = stage.match(/^(\d{6}) /)?.[1];
    if (mode !== '100644' && mode !== '100755') continue;
    files.push({
      path: path.replaceAll('\\', '/'),
      content: git(root, ['show', `:${path}`], 'buffer') as Buffer,
    });
  }
  return { root, files };
}

export type HookState = 'installed' | 'not-installed' | 'conflict';

export interface HookStatus {
  state: HookState;
  hooksDirectory: string;
  hookPath: string;
}

export function managedHookContent(): string {
  return `#!/bin/sh
${START_MARKER}
repo_root=$(git rev-parse --show-toplevel) || exit 2
debughalo="$repo_root/node_modules/.bin/debug-halo"
if [ ! -x "$debughalo" ]; then
  echo "DebugHalo pre-commit hook could not find the local CLI. Run npm ci." >&2
  exit 2
fi
"$debughalo" scan --staged --fail-on-findings
status=$?
if [ "$status" -eq 1 ]; then
  echo "Commit blocked: DebugHalo found potential secrets in staged files." >&2
  echo "Run: debug-halo scan --staged" >&2
fi
exit "$status"
${END_MARKER}
`;
}

function inspectHook(cwd: string): HookStatus & { content?: string } {
  const hooksDirectory = resolveHooksDirectory(cwd);
  const hookPath = resolve(hooksDirectory, 'pre-commit');
  if (!existsSync(hookPath)) return { state: 'not-installed', hooksDirectory, hookPath };
  let content: string;
  try {
    content = readFileSync(hookPath, 'utf8');
  } catch {
    throw new GitError('Unable to read the existing pre-commit hook');
  }
  const hasStart = content.includes(START_MARKER);
  const hasEnd = content.includes(END_MARKER);
  if (hasStart !== hasEnd) throw new GitError('Malformed DebugHalo managed hook state');
  return { state: hasStart ? 'installed' : 'conflict', hooksDirectory, hookPath, content };
}

export function getHookStatus(cwd = process.cwd()): HookStatus {
  const status = inspectHook(cwd);
  return {
    state: status.state,
    hooksDirectory: status.hooksDirectory,
    hookPath: status.hookPath,
  };
}

export function installHook(cwd = process.cwd()): HookStatus {
  const status = inspectHook(cwd);
  if (status.state === 'installed') return status;
  if (status.state === 'conflict') {
    throw new GitError('A non-DebugHalo pre-commit hook already exists; it was not modified');
  }
  try {
    mkdirSync(status.hooksDirectory, { recursive: true });
    writeFileSync(status.hookPath, managedHookContent(), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o755,
    });
    chmodSync(status.hookPath, 0o755);
  } catch {
    throw new GitError('Unable to install the DebugHalo pre-commit hook');
  }
  return { ...status, state: 'installed' };
}

export function uninstallHook(cwd = process.cwd()): HookStatus {
  const status = inspectHook(cwd);
  if (status.state === 'not-installed' || status.state === 'conflict') return status;
  if (status.content !== managedHookContent()) {
    throw new GitError('Pre-commit hook contains additional content; it was not modified');
  }
  try {
    rmSync(status.hookPath);
  } catch {
    throw new GitError('Unable to uninstall the DebugHalo pre-commit hook');
  }
  return { ...status, state: 'not-installed' };
}

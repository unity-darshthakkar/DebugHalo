/**
 * File Discovery Utility
 */
import fastGlob from 'fast-glob';
import ignoreModule, { type Ignore } from 'ignore';
import { basename, extname, isAbsolute, relative, resolve } from 'path';
import { readFileSync, existsSync, statSync } from 'fs';

const { isDynamicPattern } = fastGlob;

const createIgnore = (
  'default' in ignoreModule ? ignoreModule.default : ignoreModule
) as () => Ignore;

export interface FileDiscoveryOptions {
  cwd?: string;
  extensions?: string[];
  ignorePatterns?: string[];
  respectGitignore?: boolean;
}

export class FileDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileDiscoveryError';
  }
}

const DEFAULT_EXCLUSIONS = [
  '.git/**',
  '.debughalo/**',
  'node_modules/**',
  'dist/**',
  'coverage/**',
];

function normalizeExtensions(exts?: string[]): Set<string> {
  if (!exts || exts.length === 0) return new Set();
  return new Set(exts.map((e) => e.replace(/^\./, '').toLowerCase()));
}

function toRelativePath(root: string, filePath: string): string {
  return relative(root, filePath).replaceAll('\\', '/');
}

function isInsideRoot(relativePath: string): boolean {
  return relativePath !== '..' && !relativePath.startsWith('../') && !isAbsolute(relativePath);
}

function buildIgnore(extraPatterns: string[] = [], ignoreFilePaths: string[] = []): Ignore {
  const matcher = createIgnore();

  matcher.add(DEFAULT_EXCLUSIONS);

  for (const ignoreFilePath of ignoreFilePaths) {
    if (existsSync(ignoreFilePath)) {
      try {
        matcher.add(readFileSync(ignoreFilePath, 'utf8'));
      } catch {
        // Ignore unreadable ignore files; file processing errors remain independent.
      }
    }
  }

  if (extraPatterns.length > 0) {
    matcher.add(extraPatterns);
  }

  return matcher;
}

type ClassifiedInput =
  | { kind: 'file'; path: string }
  | { kind: 'directory'; path: string }
  | { kind: 'glob'; pattern: string }
  | { kind: 'missing'; input: string };

function classifyInput(input: string, cwd: string): ClassifiedInput {
  const absolutePath = isAbsolute(input) ? input : resolve(cwd, input);

  try {
    const st = statSync(absolutePath);
    if (st.isFile()) return { kind: 'file', path: absolutePath };
    if (st.isDirectory()) return { kind: 'directory', path: absolutePath };
  } catch {
    /* not found */
  }

  const normalizedInput = input.replaceAll('\\', '/');
  if (isDynamicPattern(normalizedInput)) {
    if (normalizedInput.startsWith('../') || normalizedInput.includes('/../')) {
      return { kind: 'missing', input };
    }
    return { kind: 'glob', pattern: normalizedInput };
  }

  return { kind: 'missing', input };
}

export async function discoverFiles(
  inputs: string[],
  options: FileDiscoveryOptions = {}
): Promise<string[]> {
  const { cwd = process.cwd(), extensions, ignorePatterns = [], respectGitignore = true } = options;

  if (!inputs?.length) throw new FileDiscoveryError('No input paths provided');

  const extSet = normalizeExtensions(extensions);

  const classified = inputs.map((i) => classifyInput(i, cwd));
  const hasExplicit = classified.some((c) => c.kind !== 'missing');

  if (!hasExplicit)
    throw new FileDiscoveryError(`No valid input paths found: ${inputs.join(', ')}`);

  const gitignorePath = respectGitignore ? resolve(cwd, '.gitignore') : undefined;
  const cwdIgnoreFiles = [gitignorePath, resolve(cwd, '.debughaloignore')].filter(
    (path): path is string => path !== undefined
  );
  const optionLevelIgnore = buildIgnore(ignorePatterns, cwdIgnoreFiles);

  const results = new Set<string>();

  for (const c of classified) {
    if (c.kind === 'file') {
      const relativeToCwd = toRelativePath(cwd, c.path);

      if (isInsideRoot(relativeToCwd)) {
        if (optionLevelIgnore.ignores(relativeToCwd)) {
          continue;
        }
      } else {
        const externalFileIgnore = buildIgnore(ignorePatterns);
        if (externalFileIgnore.ignores(basename(c.path))) {
          continue;
        }
      }

      const ext = extname(c.path).slice(1).toLowerCase();
      if (!extSet.size || extSet.has(ext)) {
        results.add(resolve(c.path));
      }
      continue;
    }

    if (c.kind === 'directory') {
      const directoryPath = c.path;
      if (basename(directoryPath) === '.debughalo') {
        continue;
      }
      const directoryIgnoreFiles = [resolve(directoryPath, '.debughaloignore')];
      if (respectGitignore) directoryIgnoreFiles.push(resolve(directoryPath, '.gitignore'));
      const directoryIgnore = buildIgnore(ignorePatterns, directoryIgnoreFiles);

      const matches = await fastGlob('**/*', {
        cwd: directoryPath,
        absolute: true,
        onlyFiles: true,
        followSymbolicLinks: false,
        suppressErrors: true,
        ignore: DEFAULT_EXCLUSIONS,
      });

      for (const match of matches) {
        const resolvedMatch = resolve(match);
        const relativeToDirectory = toRelativePath(directoryPath, resolvedMatch);

        if (directoryIgnore.ignores(relativeToDirectory)) {
          continue;
        }

        const extension = extname(resolvedMatch).slice(1).toLowerCase();

        if (extSet.size === 0 || extSet.has(extension)) {
          results.add(resolvedMatch);
        }
      }
      continue;
    }

    if (c.kind === 'glob') {
      const matches = await fastGlob(c.pattern, {
        cwd,
        absolute: true,
        onlyFiles: true,
        followSymbolicLinks: false,
        suppressErrors: true,
        ignore: DEFAULT_EXCLUSIONS,
      });

      for (const match of matches) {
        const resolvedMatch = resolve(match);
        const relativeToCwd = toRelativePath(cwd, resolvedMatch);

        if (!isInsideRoot(relativeToCwd)) {
          continue;
        }

        if (optionLevelIgnore.ignores(relativeToCwd)) {
          continue;
        }

        const extension = extname(resolvedMatch).slice(1).toLowerCase();

        if (extSet.size === 0 || extSet.has(extension)) {
          results.add(resolvedMatch);
        }
      }
      continue;
    }
  }

  return Array.from(results).sort();
}

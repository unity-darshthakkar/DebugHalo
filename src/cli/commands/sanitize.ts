/**
 * Sanitize Command Implementation
 *
 * Sanitizes files by replacing detected secrets and PII with deterministic aliases.
 * Uses DebugHalo core sanitization API.
 */

import { sanitizeText } from '../../core/pipeline.js';
import { discoverFiles, FileDiscoveryError } from '../utils/fileDiscovery.js';
import { readFileSafe } from '../utils/fileReading.js';
import { assertNotSymbolicLink, atomicWriteFile } from '../utils/atomicWrite.js';
import { relative } from 'path';
import chalk from 'chalk';

export interface SanitizeFileResult {
  file: string;
  changed: boolean;
  findings: number;
  error?: string;
}

export interface SanitizeSummary {
  filesDiscovered: number;
  filesProcessed: number;
  filesChanged: number;
  filesUnchanged: number;
  filesSkipped: number;
  filesFailed: number;
  totalFindings: number;
}

export interface SanitizeResult {
  summary: SanitizeSummary;
  results: SanitizeFileResult[];
}

export interface SanitizeOptions {
  paths: string[];
  extensions: string[];
  ignorePatterns: string[];
  dryRun: boolean;
  verbose: boolean;
  cwd?: string;
}

/**
 * Normalize extensions from CLI input (handles "ts", ".ts", "ts,js", ".ts,.js", etc.)
 */
export function normalizeExtensions(input: string[]): string[] {
  const extensions = new Set<string>();
  for (const ext of input) {
    const parts = ext.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (part) {
        extensions.add(part.replace(/^\./, '').toLowerCase());
      }
    }
  }
  return Array.from(extensions);
}

/**
 * Normalize ignore patterns from CLI input
 */
export function normalizeIgnorePatterns(input: string[]): string[] {
  const patterns: string[] = [];
  for (const pattern of input) {
    const parts = pattern.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (part) {
        patterns.push(part);
      }
    }
  }
  return patterns;
}

/**
 * Sanitize a single file
 */
async function sanitizeFile(
  filePath: string,
  workingDir: string,
  dryRun: boolean
): Promise<SanitizeFileResult> {
  const relativePath = relative(workingDir, filePath);

  try {
    assertNotSymbolicLink(filePath);
  } catch (err) {
    return {
      file: relativePath,
      changed: false,
      findings: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Read file (handles missing/binary/unreadable files)
  const { content, error } = readFileSafe(filePath);
  if (error) {
    return {
      file: relativePath,
      changed: false,
      findings: 0,
      error,
    };
  }

  // Run sanitization via core pipeline
  try {
    const result = await sanitizeText(content, { minConfidence: 0.5 });
    const changed = result.sanitizedText !== content;
    const findings = result.detections.length;

    if (changed && !dryRun) {
      atomicWriteFile(filePath, result.sanitizedText);
    }

    return {
      file: relativePath,
      changed,
      findings,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      file: relativePath,
      changed: false,
      findings: 0,
      error: message,
    };
  }
}

/**
 * Run the sanitize with the given options
 * Throws Error for discovery failures
 */
export async function runSanitize(options: SanitizeOptions): Promise<SanitizeResult> {
  const { paths, extensions, ignorePatterns, dryRun, cwd } = options;
  const workingDir = cwd ?? process.cwd();

  const normalizedExtensions = normalizeExtensions(extensions);
  const normalizedIgnore = normalizeIgnorePatterns(ignorePatterns);

  // Discover files
  let discoveredFiles: string[];
  try {
    discoveredFiles = await discoverFiles(paths, {
      cwd: workingDir,
      extensions: normalizedExtensions.length > 0 ? normalizedExtensions : undefined,
      ignorePatterns: normalizedIgnore,
      respectGitignore: true,
    });
  } catch (err) {
    if (err instanceof FileDiscoveryError) {
      throw new Error(err.message);
    }
    throw err;
  }

  const summary: SanitizeSummary = {
    filesDiscovered: discoveredFiles.length,
    filesProcessed: 0,
    filesChanged: 0,
    filesUnchanged: 0,
    filesSkipped: 0,
    filesFailed: 0,
    totalFindings: 0,
  };

  const results: SanitizeFileResult[] = [];

  for (const filePath of discoveredFiles) {
    const fileResult = await sanitizeFile(filePath, workingDir, dryRun);

    if (fileResult.error) {
      if (fileResult.error === 'Binary file skipped') {
        summary.filesSkipped++;
      } else {
        summary.filesFailed++;
      }
    } else {
      summary.filesProcessed++;
      summary.totalFindings += fileResult.findings;
      if (fileResult.changed) {
        summary.filesChanged++;
      } else {
        summary.filesUnchanged++;
      }
    }

    results.push(fileResult);
  }

  return { summary, results };
}

/**
 * Output sanitize results in text format
 */
export function outputText(result: SanitizeResult, dryRun: boolean, verbose: boolean): void {
  const { summary, results } = result;
  void verbose;

  console.log(chalk.blue('DebugHalo Sanitize Results'));
  console.log('');

  if (dryRun) {
    console.log(chalk.dim('[DRY RUN] No files were modified'));
    console.log('');
  }

  console.log(chalk.dim(`Discovered: ${summary.filesDiscovered} files`));
  console.log(chalk.dim(`Processed:  ${summary.filesProcessed} files`));
  if (summary.filesSkipped > 0) {
    console.log(chalk.yellow(`Skipped:    ${summary.filesSkipped} binary/unreadable files`));
  }
  if (summary.filesFailed > 0) {
    console.log(chalk.red(`Failed:     ${summary.filesFailed} files`));
  }
  console.log('');

  if (summary.filesChanged > 0) {
    console.log(
      chalk.green(`${dryRun ? 'Would change' : 'Changed'}: ${summary.filesChanged} file(s)`)
    );
    for (const r of results) {
      if (r.changed) {
        console.log(
          `  ${chalk.dim(r.file)}  (${r.findings} finding${r.findings !== 1 ? 's' : ''})`
        );
      }
    }
  } else {
    console.log(chalk.green('No files would be changed'));
  }

  if (summary.filesUnchanged > 0) {
    console.log('');
    console.log(chalk.dim(`Unchanged:  ${summary.filesUnchanged} file(s)`));
  }

  console.log('');
  console.log(chalk.dim(`Total findings: ${summary.totalFindings}`));
}

import chalk from 'chalk';
import { isAbsolute, relative, resolve } from 'path';
import { runSanitize, type SanitizeResult } from './sanitize.js';
import { runScan, type ScanResult } from './scan.js';

export interface ShareResult {
  sanitization: SanitizeResult;
  validation: ScanResult;
  safe: boolean;
}

export async function runShare(options: {
  paths: string[];
  cwd?: string;
  extensions: string[];
  ignorePatterns: string[];
  outputDirectory: string;
  vaultPath?: string;
  minConfidence?: number;
  disabledCategories?: string[];
  verbose?: boolean;
}): Promise<ShareResult> {
  const cwd = options.cwd ?? process.cwd();
  const resolvedOutput = resolve(cwd, options.outputDirectory);
  const outputRelative = relative(cwd, resolvedOutput);
  if (
    outputRelative === '' ||
    outputRelative === '..' ||
    outputRelative.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(outputRelative)
  ) {
    throw new Error('Share output directory must be a child of the working directory');
  }
  const sanitization = await runSanitize({
    paths: options.paths,
    cwd,
    extensions: options.extensions,
    ignorePatterns: [
      ...options.ignorePatterns,
      `${options.outputDirectory.replaceAll('\\', '/')}/**`,
    ],
    outputDirectory: options.outputDirectory,
    vaultPath: options.vaultPath,
    persistVault: true,
    dryRun: false,
    verbose: options.verbose ?? false,
    minConfidence: options.minConfidence,
    disabledCategories: options.disabledCategories,
  });
  const outputs = sanitization.results
    .filter((result) => result.outputFile && !result.error)
    .map((result) => resolve(cwd, result.outputFile!));
  const validation: ScanResult =
    outputs.length === 0
      ? {
          summary: {
            filesDiscovered: 0,
            filesScanned: 0,
            filesSkipped: 0,
            filesFailed: 0,
            findings: 0,
          },
          findings: [],
          errors: [],
        }
      : await runScan({
          paths: outputs,
          cwd,
          extensions: [],
          ignorePatterns: [],
          outputFormat: 'text',
          failOnFindings: true,
          verbose: false,
          minConfidence: options.minConfidence,
          disabledCategories: options.disabledCategories,
        });
  return {
    sanitization,
    validation,
    safe:
      sanitization.summary.filesFailed === 0 &&
      validation.summary.filesFailed === 0 &&
      validation.findings.length === 0,
  };
}

export function outputShareText(result: ShareResult): void {
  console.log(chalk.blue('DebugHalo Share Results'));
  console.log(chalk.dim(`Files processed: ${result.sanitization.summary.filesProcessed}`));
  console.log(
    chalk.dim(
      `Files produced: ${result.sanitization.results.filter((item) => item.outputFile && !item.error).length}`
    )
  );
  console.log(chalk.dim(`Findings sanitized: ${result.sanitization.summary.totalFindings}`));
  console.log(
    result.safe
      ? chalk.green('Validation passed: local copies are ready to share')
      : chalk.red(
          `Validation failed: ${result.validation.findings.length} active finding(s) remain`
        )
  );
  console.log(chalk.dim('No files were uploaded or transmitted.'));
}

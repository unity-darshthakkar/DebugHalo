#!/usr/bin/env node
/**
 * DebugHalo CLI Entry Point
 *
 * DebugHalo - Pre-deployment PII/secret detox pipeline
 * Strip secrets before they ship
 */

import { Command, CommanderError } from 'commander';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

import { runScan, outputText, outputJson } from './commands/scan.js';
import { runSanitize, outputText as outputSanitizeText } from './commands/sanitize.js';
import {
  loadConfig,
  applyCliOptions,
  ConfigLoadError,
  type ConfigLoadResult,
} from './configLoader.js';
import { createDefaultConfigFile } from './config.js';
import { sanitizeExitCode, scanExitCode } from './exitCodes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load package.json for version
const pkgPath = resolve(__dirname, '../../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

const program = new Command();
const version = pkg.version;

program.exitOverride();

// Global options - config must be loaded before commands run
program
  .name('debug-halo')
  .description('Pre-deployment PII/secret detox pipeline')
  .version(version)
  .option('-v, --verbose', 'Enable verbose output')
  .option('-c, --config <path>', 'Path to config file')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts['verbose']) {
      console.error(chalk.dim('[DEBUG] Verbose mode enabled'));
    }
  });

function loadConfigForCommand(
  explicitConfigPath: string | undefined,
  cwd: string
): ConfigLoadResult | undefined {
  try {
    return loadConfig(explicitConfigPath, cwd);
  } catch (err) {
    reportFatalError(err);
    return undefined;
  }
}

function reportFatalError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red('Error:'), message);
  process.exitCode = error instanceof ConfigLoadError ? error.exitCode : 2;
}

function reportFileErrors(
  errors: ReadonlyArray<{ file: string; message: string }>,
  verbose: boolean
): void {
  for (const error of errors) {
    const prefix = verbose
      ? error.message === 'Binary file skipped'
        ? '[SKIP] '
        : '[ERROR] '
      : '';
    console.error(chalk.yellow(`${prefix}${error.file}: ${error.message}`));
  }
}

/**
 * Check if an option was explicitly provided by the user (not just default)
 */
function isOptionProvided(command: Command, optionName: string): boolean {
  // Commander stores options in command.opts() but we need to check the source
  // For boolean flags, they are false by default. We check if user explicitly passed it.
  // Use optionFlags to track explicitly set options
  const cmdOpts = command.opts();
  const optionDefinition = command.options.find((opt) => opt.attributeName() === optionName);
  if (!optionDefinition) return false;

  // For boolean flags, check if explicitly set to true
  if (optionDefinition.isBoolean()) {
    return cmdOpts[optionName] === true;
  }

  // For array/string options, check if it differs from default or is non-empty
  const defaultValue = optionDefinition.defaultValue;
  const currentValue = cmdOpts[optionName];
  if (Array.isArray(defaultValue) && Array.isArray(currentValue)) {
    return currentValue.length > 0;
  }
  if (defaultValue === undefined && currentValue !== undefined) {
    return true;
  }
  return currentValue !== defaultValue;
}

/**
 * Extract only explicitly provided CLI options for merging with config
 */
function getExplicitCliOptions(scanCommand: Command): {
  extensions?: string[];
  ignorePatterns?: string[];
  outputFormat?: 'text' | 'json';
  failOnFindings?: boolean;
} {
  const opts = scanCommand.opts();
  const result: {
    extensions?: string[];
    ignorePatterns?: string[];
    outputFormat?: 'text' | 'json';
    failOnFindings?: boolean;
  } = {};

  if (isOptionProvided(scanCommand, 'ext')) {
    result.extensions = opts['ext'];
  }
  if (isOptionProvided(scanCommand, 'ignore')) {
    result.ignorePatterns = opts['ignore'];
  }
  if (isOptionProvided(scanCommand, 'output')) {
    result.outputFormat = opts['output'];
  }
  if (isOptionProvided(scanCommand, 'failOnFindings')) {
    result.failOnFindings = true;
  }
  return result;
}

function getExplicitSanitizeOptions(sanitizeCommand: Command): {
  extensions?: string[];
  ignorePatterns?: string[];
  dryRun?: boolean;
} {
  const opts = sanitizeCommand.opts();
  const result: {
    extensions?: string[];
    ignorePatterns?: string[];
    dryRun?: boolean;
  } = {};

  if (isOptionProvided(sanitizeCommand, 'ext')) {
    result.extensions = opts['ext'];
  }
  if (isOptionProvided(sanitizeCommand, 'ignore')) {
    result.ignorePatterns = opts['ignore'];
  }
  if (isOptionProvided(sanitizeCommand, 'dryRun')) {
    result.dryRun = true;
  }
  return result;
}

program
  .command('scan')
  .description('Scan files for secrets and PII')
  .argument('[paths...]', 'Files or directories to scan', ['.'])
  .option('-e, --ext <extensions...>', 'File extensions to scan (comma-separated)', [])
  .option('-i, --ignore <patterns...>', 'Glob patterns to ignore (comma-separated)', [])
  .option('-o, --output <format>', 'Output format: json, text', undefined)
  .option('--fail-on-findings', 'Exit with non-zero code if findings detected')
  .action(async (paths, _options, scanCommand) => {
    const globalOpts = program.opts();
    const verbose = globalOpts['verbose'] ?? false;
    const cwd = process.cwd();

    // Load config
    const configResult = loadConfigForCommand(globalOpts['config'], cwd);
    if (!configResult) return;

    // Get explicitly provided CLI options
    const explicitCliOpts = getExplicitCliOptions(scanCommand);

    // Merge config with CLI options (CLI takes precedence only for explicitly provided options)
    const mergedConfig = applyCliOptions(configResult.config, {
      ...explicitCliOpts,
      // For array options, check if explicitly provided (non-empty) or pass through
      extensions: explicitCliOpts.extensions?.length ? explicitCliOpts.extensions : undefined,
      ignorePatterns: explicitCliOpts.ignorePatterns?.length
        ? explicitCliOpts.ignorePatterns
        : undefined,
    });

    // Validate output format
    if (mergedConfig.outputFormat !== 'text' && mergedConfig.outputFormat !== 'json') {
      console.error(
        chalk.red(`Error: Invalid output format: ${mergedConfig.outputFormat}. Allowed: text, json`)
      );
      process.exitCode = 2;
      return;
    }

    try {
      const result = await runScan({
        paths,
        extensions: mergedConfig.extensions,
        ignorePatterns: mergedConfig.ignorePatterns,
        outputFormat: mergedConfig.outputFormat,
        failOnFindings: mergedConfig.failOnFindings,
        verbose,
        cwd,
      });

      if (mergedConfig.outputFormat === 'json') {
        outputJson(result);
      } else {
        outputText(result, verbose);
      }
      reportFileErrors(result.errors, verbose);

      process.exitCode = scanExitCode(
        result.summary.filesFailed,
        mergedConfig.failOnFindings,
        result.findings.length
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Only print to stderr in text mode (json should have stdout only)
      if (mergedConfig.outputFormat !== 'json') {
        console.error(chalk.red('Error:'), message);
      } else {
        // For json mode, write error object to stderr
        console.error(JSON.stringify({ error: message }, null, 2));
      }
      process.exitCode = 2;
    }
  });

program
  .command('sanitize')
  .description('Sanitize files by removing detected secrets/PII')
  .argument('[paths...]', 'Files or directories to sanitize', ['.'])
  .option('-e, --ext <extensions...>', 'File extensions to sanitize', [])
  .option('-i, --ignore <patterns...>', 'Glob patterns to ignore', [])
  .option('--dry-run', 'Show what would be changed without writing')
  .action(async (paths, _options, sanitizeCommand) => {
    const globalOpts = program.opts();
    const verbose = globalOpts['verbose'] ?? false;
    const cwd = process.cwd();

    // Load config
    const configResult = loadConfigForCommand(globalOpts['config'], cwd);
    if (!configResult) return;

    // Get explicitly provided CLI options
    const explicitCliOpts = getExplicitSanitizeOptions(sanitizeCommand);

    // Merge config with CLI options (CLI takes precedence only for explicitly provided options)
    const mergedConfig = applyCliOptions(configResult.config, {
      ...explicitCliOpts,
      extensions: explicitCliOpts.extensions?.length ? explicitCliOpts.extensions : undefined,
      ignorePatterns: explicitCliOpts.ignorePatterns?.length
        ? explicitCliOpts.ignorePatterns
        : undefined,
    });

    try {
      const result = await runSanitize({
        paths,
        extensions: mergedConfig.extensions,
        ignorePatterns: mergedConfig.ignorePatterns,
        dryRun: mergedConfig.dryRun,
        verbose,
        cwd,
      });

      outputSanitizeText(result, mergedConfig.dryRun, verbose);
      reportFileErrors(
        result.results.flatMap((fileResult) =>
          fileResult.error ? [{ file: fileResult.file, message: fileResult.error }] : []
        ),
        verbose
      );

      // Exit codes: 0 = success, 1 = files changed, 2 = error
      process.exitCode = sanitizeExitCode(result.summary.filesFailed, result.summary.filesChanged);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red('Error:'), message);
      process.exitCode = 2;
    }
  });

program
  .command('init')
  .description('Initialize DebugHalo configuration')
  .option('-f, --force', 'Overwrite existing config')
  .action((options) => {
    const cwd = process.cwd();
    const configPath = resolve(cwd, '.debughalo.json');

    // Check if config already exists
    if (existsSync(configPath) && !options.force) {
      console.error(chalk.red('Error:'), `Config file already exists at ${configPath}`);
      console.error(chalk.dim('Use --force to overwrite'));
      process.exitCode = 2;
      return;
    }

    try {
      const defaultConfig = createDefaultConfigFile();
      writeFileSync(configPath, defaultConfig, 'utf-8');
      console.log(chalk.green('✓'), `Created config file: ${configPath}`);
      console.log(chalk.dim('Edit this file to customize your DebugHalo settings.'));
    } catch (err) {
      console.error(chalk.red('Error:'), err instanceof Error ? err.message : String(err));
      process.exitCode = 2;
    }
  });

program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(chalk.blue(`DebugHalo v${version}`));
    console.log(chalk.dim('Pre-deployment PII/secret detox pipeline'));
  });

program.parseAsync(process.argv).catch((error) => {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode === 0 ? 0 : 2;
    return;
  }
  reportFatalError(error);
});

export { program };

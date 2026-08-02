#!/usr/bin/env node
/**
 * DebugHalo CLI Entry Point
 *
 * DebugHalo - Pre-deployment PII/secret detox pipeline
 * Strip secrets before they ship
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load package.json for version
const pkgPath = resolve(__dirname, '../../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

const program = new Command();
const version = pkg.version;

program
  .name('debug-halo')
  .description('Pre-deployment PII/secret detox pipeline')
  .version(version)
  .option('-v, --verbose', 'Enable verbose output')
  .option('-c, --config <path>', 'Path to config file')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts['verbose']) {
      console.log(chalk.dim('[DEBUG] Verbose mode enabled'));
    }
  });

program
  .command('scan')
  .description('Scan files for secrets and PII')
  .argument('[paths...]', 'Files or directories to scan', ['.'])
  .option('-e, --ext <extensions...>', 'File extensions to scan', [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'yaml',
    'yml',
    'env',
  ])
  .option('-i, --ignore <patterns...>', 'Glob patterns to ignore', [
    'node_modules/**',
    'dist/**',
    '.git/**',
  ])
  .option('-o, --output <format>', 'Output format: json, text, sarif', 'text')
  .option('--fail-on-findings', 'Exit with non-zero code if findings detected')
  .action(async (paths, options) => {
    console.log(chalk.blue('DebugHalo CLI - Scan Command'));
    console.log(chalk.dim('Paths:'), paths.join(', '));
    console.log(chalk.dim('Extensions:'), options.ext.join(', '));
    console.log(chalk.dim('Ignore patterns:'), options.ignore.join(', '));
    console.log(chalk.dim('Output format:'), options.output);
    console.log(chalk.dim('Fail on findings:'), options.failOnFindings);
    console.log(chalk.yellow('\n⚠ Scan functionality not yet implemented (Phase 2)'));
    console.log(chalk.dim('This is a placeholder CLI for Phase 1 scaffolding.'));
  });

program
  .command('sanitize')
  .description('Sanitize files by removing detected secrets/PII')
  .argument('[paths...]', 'Files or directories to sanitize', ['.'])
  .option('-e, --ext <extensions...>', 'File extensions to sanitize', [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'yaml',
    'yml',
    'env',
  ])
  .option('-i, --ignore <patterns...>', 'Glob patterns to ignore', [
    'node_modules/**',
    'dist/**',
    '.git/**',
  ])
  .option('--dry-run', 'Show what would be changed without writing')
  .action(async (paths, options) => {
    console.log(chalk.blue('DebugHalo CLI - Sanitize Command'));
    console.log(chalk.dim('Paths:'), paths.join(', '));
    console.log(chalk.dim('Extensions:'), options.ext.join(', '));
    console.log(chalk.dim('Ignore patterns:'), options.ignore.join(', '));
    console.log(chalk.dim('Dry run:'), options.dryRun);
    console.log(chalk.yellow('\n⚠ Sanitize functionality not yet implemented (Phase 2)'));
    console.log(chalk.dim('This is a placeholder CLI for Phase 1 scaffolding.'));
  });

program
  .command('init')
  .description('Initialize DebugHalo configuration')
  .option('-f, --force', 'Overwrite existing config')
  .action((options) => {
    console.log(chalk.blue('DebugHalo CLI - Init Command'));
    console.log(chalk.dim('Force overwrite:'), options.force);
    console.log(chalk.yellow('\n⚠ Init functionality not yet implemented (Phase 2)'));
    console.log(chalk.dim('This is a placeholder CLI for Phase 1 scaffolding.'));
  });

program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(chalk.blue(`DebugHalo v${version}`));
    console.log(chalk.dim('Pre-deployment PII/secret detox pipeline'));
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});

export { program };

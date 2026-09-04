/**
 * Config Loader Utility
 *
 * Handles loading and resolving DebugHalo configuration from various sources:
 * - Explicit --config path
 * - Automatic .debughalo.json in current working directory
 * - Defaults
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import type { DebugHaloConfig } from './config.js';
import { validateConfig, mergeConfig } from './config.js';

/**
 * Result of config loading
 */
export interface ConfigLoadResult {
  /** The merged configuration with defaults applied */
  config: Required<DebugHaloConfig>;
  /** Path to the config file that was loaded, or null if none found */
  configPath: string | null;
  /** Whether a config file was explicitly provided (--config) */
  explicitConfig: boolean;
}

/**
 * Error thrown when config loading fails
 */
export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 2
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * Load and validate a JSON config file at the given path.
 * Throws ConfigLoadError on failure.
 */
function loadConfigFile(configPath: string): DebugHaloConfig {
  if (!existsSync(configPath)) {
    throw new ConfigLoadError(`Config file not found: ${configPath}`);
  }

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new ConfigLoadError(
      `Failed to read config file: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigLoadError(
      `Invalid JSON in config file: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Basic validation
  if (!parsed || typeof parsed !== 'object') {
    throw new ConfigLoadError('Config must be a JSON object');
  }

  return parsed as DebugHaloConfig;
}

/**
 * Find .debughalo.json in the current working directory only
 */
function findAutoConfig(cwd: string): string | null {
  const configPath = join(resolve(cwd), '.debughalo.json');
  if (existsSync(configPath)) {
    return configPath;
  }
  return null;
}

/**
 * Load configuration from all sources in priority order:
 * 1. Explicit --config path (highest priority)
 * 2. Auto-discovered .debughalo.json
 * 3. Defaults (lowest priority)
 *
 * CLI options override config values (handled by caller).
 *
 * @param explicitConfigPath - Path provided via --config option
 * @param cwd - Current working directory for auto-discovery
 * @returns ConfigLoadResult with merged config and metadata
 */
export function loadConfig(
  explicitConfigPath: string | undefined,
  cwd: string = process.cwd()
): ConfigLoadResult {
  let loadedConfig: DebugHaloConfig = {};
  let configPath: string | null = null;
  let explicitConfig = false;

  // 1. Explicit --config path
  if (explicitConfigPath) {
    const resolvedPath = resolve(cwd, explicitConfigPath);
    loadedConfig = loadConfigFile(resolvedPath);
    configPath = resolvedPath;
    explicitConfig = true;
  }
  // 2. Auto-discover .debughalo.json
  else {
    const autoPath = findAutoConfig(cwd);
    if (autoPath !== null) {
      loadedConfig = loadConfigFile(autoPath);
      configPath = autoPath;
      explicitConfig = false;
    }
  }

  // Validate and merge with defaults
  let validated: DebugHaloConfig;
  try {
    validated = validateConfig(loadedConfig);
  } catch (err) {
    throw new ConfigLoadError(err instanceof Error ? err.message : String(err));
  }
  const merged = mergeConfig(validated);

  return {
    config: merged,
    configPath,
    explicitConfig,
  };
}

/**
 * Apply CLI options on top of loaded config.
 * CLI options take precedence over config file values.
 */
export function applyCliOptions(
  config: Required<DebugHaloConfig>,
  cliOptions: {
    extensions?: string[];
    ignorePatterns?: string[];
    outputFormat?: 'text' | 'json' | 'jsonl' | 'sarif';
    failOnFindings?: boolean;
    dryRun?: boolean;
    minConfidence?: number;
    disabledCategories?: string[];
    vaultPath?: string;
    outputDirectory?: string;
  }
): Required<DebugHaloConfig> {
  return {
    extensions: cliOptions.extensions ?? config.extensions,
    ignorePatterns: cliOptions.ignorePatterns ?? config.ignorePatterns,
    outputFormat: cliOptions.outputFormat ?? config.outputFormat,
    failOnFindings: cliOptions.failOnFindings ?? config.failOnFindings,
    dryRun: cliOptions.dryRun ?? config.dryRun,
    minConfidence: cliOptions.minConfidence ?? config.minConfidence,
    disabledCategories: cliOptions.disabledCategories ?? config.disabledCategories,
    vaultPath: cliOptions.vaultPath ?? config.vaultPath,
    outputDirectory: cliOptions.outputDirectory ?? config.outputDirectory,
  };
}

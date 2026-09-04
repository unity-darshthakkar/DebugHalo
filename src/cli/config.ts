/**
 * DebugHalo CLI Configuration
 *
 * Defines the configuration shape for .debughalo.json
 */
import { ALL_CATEGORIES } from '../types/core.js';

export interface DebugHaloConfig {
  /** File extensions to scan/sanitize */
  extensions?: string[];
  /** Glob patterns to ignore */
  ignorePatterns?: string[];
  /** Output format for scan command: 'text' | 'json' */
  outputFormat?: 'text' | 'json';
  /** Fail with exit code 1 if findings detected (scan command) */
  failOnFindings?: boolean;
  /** Whether to run in dry-run mode (sanitize command) */
  dryRun?: boolean;
  /** Minimum detection confidence from 0 through 1 */
  minConfidence?: number;
  /** Detection categories to suppress */
  disabledCategories?: string[];
  /** Plaintext local alias vault path */
  vaultPath?: string;
  /** Default directory for locally prepared share copies */
  outputDirectory?: string;
}

/**
 * Valid output format values
 */
export const VALID_OUTPUT_FORMATS = ['text', 'json'] as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<DebugHaloConfig> = {
  extensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml', 'env'],
  ignorePatterns: ['node_modules/**', 'dist/**', '.git/**'],
  outputFormat: 'text',
  failOnFindings: false,
  dryRun: false,
  minConfidence: 0.5,
  disabledCategories: [],
  vaultPath: '',
  outputDirectory: 'debughalo-output',
};

/**
 * Validates a config object and returns validated config with defaults applied.
 * Throws if config contains invalid values.
 */
export function validateConfig(config: unknown): DebugHaloConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Config must be an object');
  }

  const obj = config as Record<string, unknown>;
  const validated: DebugHaloConfig = {};

  // Validate extensions
  if (Object.prototype.hasOwnProperty.call(obj, 'extensions')) {
    const extensions = obj['extensions'];
    if (!Array.isArray(extensions)) {
      throw new Error('Config "extensions" must be an array');
    }
    for (const ext of extensions) {
      if (typeof ext !== 'string') {
        throw new Error('Config "extensions" must be an array of strings');
      }
    }
    validated.extensions = extensions as string[];
  }

  // Validate ignorePatterns
  if (Object.prototype.hasOwnProperty.call(obj, 'ignorePatterns')) {
    const ignorePatterns = obj['ignorePatterns'];
    if (!Array.isArray(ignorePatterns)) {
      throw new Error('Config "ignorePatterns" must be an array');
    }
    for (const pattern of ignorePatterns) {
      if (typeof pattern !== 'string') {
        throw new Error('Config "ignorePatterns" must be an array of strings');
      }
    }
    validated.ignorePatterns = ignorePatterns as string[];
  }

  // Validate outputFormat
  if (Object.prototype.hasOwnProperty.call(obj, 'outputFormat')) {
    const outputFormat = obj['outputFormat'];
    if (typeof outputFormat !== 'string') {
      throw new Error('Config "outputFormat" must be a string');
    }
    if (!VALID_OUTPUT_FORMATS.includes(outputFormat as 'text' | 'json')) {
      throw new Error(`Config "outputFormat" must be one of: ${VALID_OUTPUT_FORMATS.join(', ')}`);
    }
    validated.outputFormat = outputFormat as 'text' | 'json';
  }

  // Validate failOnFindings
  if (Object.prototype.hasOwnProperty.call(obj, 'failOnFindings')) {
    const failOnFindings = obj['failOnFindings'];
    if (typeof failOnFindings !== 'boolean') {
      throw new Error('Config "failOnFindings" must be a boolean');
    }
    validated.failOnFindings = failOnFindings as boolean;
  }

  // Validate dryRun
  if (Object.prototype.hasOwnProperty.call(obj, 'dryRun')) {
    const dryRun = obj['dryRun'];
    if (typeof dryRun !== 'boolean') {
      throw new Error('Config "dryRun" must be a boolean');
    }
    validated.dryRun = dryRun as boolean;
  }

  if (Object.prototype.hasOwnProperty.call(obj, 'minConfidence')) {
    const minConfidence = obj['minConfidence'];
    if (typeof minConfidence !== 'number' || minConfidence < 0 || minConfidence > 1) {
      throw new Error('Config "minConfidence" must be a number between 0 and 1');
    }
    validated.minConfidence = minConfidence;
  }

  if (Object.prototype.hasOwnProperty.call(obj, 'disabledCategories')) {
    const disabledCategories = obj['disabledCategories'];
    if (
      !Array.isArray(disabledCategories) ||
      disabledCategories.some((item) => typeof item !== 'string')
    ) {
      throw new Error('Config "disabledCategories" must be an array of strings');
    }
    const unknown = disabledCategories.find(
      (item) => !ALL_CATEGORIES.includes(item as (typeof ALL_CATEGORIES)[number])
    );
    if (unknown) throw new Error(`Unknown detection category: "${String(unknown)}"`);
    validated.disabledCategories = disabledCategories as string[];
  }

  for (const key of ['vaultPath', 'outputDirectory'] as const) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Config "${key}" must be a non-empty string`);
      }
      validated[key] = value;
    }
  }

  // Reject unknown properties
  const knownKeys = new Set([
    'extensions',
    'ignorePatterns',
    'outputFormat',
    'failOnFindings',
    'dryRun',
    'minConfidence',
    'disabledCategories',
    'vaultPath',
    'outputDirectory',
  ]);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) {
      throw new Error(`Unknown config property: "${key}"`);
    }
  }

  return validated;
}

/**
 * Merges config with defaults, giving precedence to explicit config values.
 */
export function mergeConfig(
  config: DebugHaloConfig,
  defaults: Required<DebugHaloConfig> = DEFAULT_CONFIG
): Required<DebugHaloConfig> {
  return {
    extensions: config.extensions ?? defaults.extensions,
    ignorePatterns: config.ignorePatterns ?? defaults.ignorePatterns,
    outputFormat: config.outputFormat ?? defaults.outputFormat,
    failOnFindings: config.failOnFindings ?? defaults.failOnFindings,
    dryRun: config.dryRun ?? defaults.dryRun,
    minConfidence: config.minConfidence ?? defaults.minConfidence,
    disabledCategories: config.disabledCategories ?? defaults.disabledCategories,
    vaultPath: config.vaultPath ?? defaults.vaultPath,
    outputDirectory: config.outputDirectory ?? defaults.outputDirectory,
  };
}

/**
 * Creates the default config object for .debughalo.json
 */
export function createDefaultConfigFile(): string {
  return JSON.stringify(
    {
      extensions: DEFAULT_CONFIG.extensions,
      ignorePatterns: DEFAULT_CONFIG.ignorePatterns,
      outputFormat: DEFAULT_CONFIG.outputFormat,
      failOnFindings: DEFAULT_CONFIG.failOnFindings,
      minConfidence: DEFAULT_CONFIG.minConfidence,
      disabledCategories: DEFAULT_CONFIG.disabledCategories,
      outputDirectory: DEFAULT_CONFIG.outputDirectory,
    },
    null,
    2
  );
}

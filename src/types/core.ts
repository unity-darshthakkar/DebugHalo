/**
 * Core type definitions for DebugHalo Phase 2
 *
 * These types define the contracts for:
 * - Secret/PII detection results
 * - Alias vault for reversible masking
 * - Sanitization and restoration operations
 * - Debug bundle generation
 * - Pipeline configuration and execution
 */

/**
 * All detection categories as a union type
 */
export type DetectionCategory =
  | 'api_key'
  | 'aws_access_key'
  | 'aws_secret_key'
  | 'aws_session_token'
  | 'github_token'
  | 'gitlab_token'
  | 'slack_token'
  | 'discord_token'
  | 'stripe_key'
  | 'stripe_webhook_secret'
  | 'sendgrid_api_key'
  | 'openai_key'
  | 'anthropic_key'
  | 'generic_token'
  | 'generic_secret'
  | 'jwt'
  | 'authorization_header'
  | 'basic_auth'
  | 'bearer_token'
  | 'private_key'
  | 'ssh_private_key'
  | 'pgp_private_key'
  | 'database_url'
  | 'postgres_url'
  | 'mysql_url'
  | 'mongodb_url'
  | 'redis_url'
  | 'password'
  | 'password_env'
  | 'password_config'
  | 'api_key_env'
  | 'secret_env'
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'ip_address'
  | 'internal_url'
  | 'internal_domain'
  | 'localhost_url';

/**
 * All detection categories as a readonly array
 */
export const ALL_CATEGORIES: readonly DetectionCategory[] = [
  'api_key',
  'aws_access_key',
  'aws_secret_key',
  'aws_session_token',
  'github_token',
  'gitlab_token',
  'slack_token',
  'discord_token',
  'stripe_key',
  'stripe_webhook_secret',
  'sendgrid_api_key',
  'openai_key',
  'anthropic_key',
  'generic_token',
  'generic_secret',
  'jwt',
  'authorization_header',
  'basic_auth',
  'bearer_token',
  'private_key',
  'ssh_private_key',
  'pgp_private_key',
  'database_url',
  'postgres_url',
  'mysql_url',
  'mongodb_url',
  'redis_url',
  'password',
  'password_env',
  'password_config',
  'api_key_env',
  'secret_env',
  'email',
  'phone',
  'ssn',
  'credit_card',
  'ip_address',
  'internal_url',
  'internal_domain',
  'localhost_url',
] as const;

/**
 * Confidence level of a detection (0.0 to 1.0)
 */
export type DetectionConfidence = number & { readonly __brand: 'DetectionConfidence' };

/**
 * Create a branded DetectionConfidence value
 */
export function confidence(value: number): DetectionConfidence {
  if (value < 0 || value > 1) {
    throw new Error('Confidence must be between 0 and 1');
  }
  return value as DetectionConfidence;
}

/**
 * Validation function for a detection match
 * Returns true if the match is valid, false to reject
 */
export type DetectionValidator = (match: string, context: string) => boolean;

/**
 * Source location of a detection within the input text
 */
export interface SourceRange {
  /** Starting character index (inclusive) */
  readonly start: number;
  /** Ending character index (exclusive) */
  readonly end: number;
  /** Starting line number (1-indexed) */
  readonly startLine: number;
  /** Ending line number (1-indexed) */
  readonly endLine: number;
  /** Starting column number (1-indexed) */
  readonly startColumn: number;
  /** Ending column number (1-indexed) */
  readonly endColumn: number;
}

/**
 * Result of a single secret/PII detection
 */
export interface DetectionResult {
  /** Unique identifier for this detection */
  readonly id: string;
  /** Category of the detected secret/PII */
  readonly category: DetectionCategory;
  /** The original matched value (sensitive - not for logging) */
  readonly value: string;
  /** Confidence level of this detection (0.0 to 1.0) */
  readonly confidence: DetectionConfidence;
  /** Source location in the original text */
  readonly range: SourceRange;
  /** The detector that found this result */
  readonly detectorName: string;
  /** Optional context around the detection */
  readonly context?: string;
  /** Human-readable reason for this detection (e.g., 'AWS secret key with context', 'GitHub PAT prefix ghp_') */
  readonly reason?: string;
}

/**
 * Alias entry in the vault mapping original values to deterministic aliases
 */
export interface AliasEntry {
  /** The original sensitive value */
  readonly original: string;
  /** The deterministic alias (e.g., <API_KEY_1>) */
  readonly alias: string;
  /** Category of the secret */
  readonly category: DetectionCategory;
  /** First detection that created this alias */
  readonly firstDetectionId: string;
  /** Number of times this value was replaced */
  readonly replacementCount: number;
}

/**
 * Internal mutable alias vault for reversible masking operations
 */
export interface AliasVault {
  /** Map from original value to alias entry */
  entries: Map<string, AliasEntry>;
  /** Map from alias to original value (for restoration) */
  reverseMap: Map<string, string>;
  /** Counter for deterministic alias generation per category */
  counters: Map<DetectionCategory, number>;
}

/**
 * Public readonly view of AliasVault for external consumers
 */
export interface ReadonlyAliasVault {
  /** Map from original value to alias entry */
  readonly entries: ReadonlyMap<string, AliasEntry>;
  /** Map from alias to original value (for restoration) */
  readonly reverseMap: ReadonlyMap<string, string>;
  /** Counter for deterministic alias generation per category */
  readonly counters: ReadonlyMap<DetectionCategory, number>;
}

/**
 * Result of a sanitization operation
 */
export interface SanitizationResult {
  /** The sanitized text with secrets replaced by aliases */
  readonly sanitizedText: string;
  /** All detections found during sanitization */
  readonly detections: ReadonlyArray<DetectionResult>;
  /** The alias vault used for this sanitization */
  readonly vault: AliasVault;
  /** Statistics about the sanitization */
  readonly stats: SanitizationStats;
}

/**
 * Statistics about a sanitization operation
 */
export interface SanitizationStats {
  /** Total number of detections */
  readonly totalDetections: number;
  /** Number of unique secret values replaced */
  readonly uniqueValues: number;
  /** Breakdown by category */
  readonly byCategory: ReadonlyMap<DetectionCategory, number>;
  /** Number of characters replaced */
  readonly charactersReplaced: number;
}

/**
 * Result of a restoration operation
 */
export interface RestorationResult {
  /** The restored text with aliases replaced by original values */
  readonly restoredText: string;
  /** Aliases that were successfully restored */
  readonly restored: ReadonlyArray<{ alias: string; original: string }>;
  /** Aliases that could not be restored (not in vault) */
  readonly unresolved: ReadonlyArray<string>;
  /** Whether restoration was complete */
  readonly complete: boolean;
}

/**
 * Input for debug bundle generation
 */
export interface DebugBundleInput {
  /** Raw debug text to sanitize and bundle */
  readonly rawText: string;
  /** Optional metadata about the source */
  readonly metadata?: {
    /** Source identifier (e.g., filename, command) */
    readonly source?: string;
    /** Timestamp of capture */
    readonly timestamp?: string;
    /** Additional context */
    readonly context?: Record<string, unknown>;
  };
  /** Pipeline options */
  readonly options?: PipelineConfig;
}

/**
 * Output debug bundle with sanitized content and metadata
 */
export interface DebugBundleOutput {
  /** Formatted bundle as Markdown */
  readonly bundle: string;
  /** Sanitization result for programmatic access */
  readonly sanitization: SanitizationResult;
  /** Raw bundle metadata */
  readonly metadata: DebugBundleMetadata;
}

/**
 * Metadata included in a debug bundle
 */
export interface DebugBundleMetadata {
  /** Version of the bundle format */
  readonly formatVersion: string;
  /** Timestamp of bundle generation */
  readonly generatedAt: string;
  /** Source metadata from input */
  readonly source?: DebugBundleInput['metadata'];
  /** Summary of findings */
  readonly summary: FindingsSummary;
  /** Restoration manifest for downstream use */
  readonly restorationManifest: RestorationManifest;
}

/**
 * Summary of findings for the privacy report
 */
export interface FindingsSummary {
  /** Total detections */
  readonly total: number;
  /** Unique secret values */
  readonly uniqueValues: number;
  /** Counts by category */
  readonly byCategory: Readonly<Record<DetectionCategory, number>>;
  /** High-confidence findings (>= 0.8) */
  readonly highConfidence: number;
  /** Medium-confidence findings (0.5-0.8) */
  readonly mediumConfidence: number;
  /** Low-confidence findings (< 0.5) */
  readonly lowConfidence: number;
}

/**
 * Manifest for restoring aliases later
 */
export interface RestorationManifest {
  /** Map of alias -> category for reference */
  readonly aliases: ReadonlyArray<{
    readonly alias: string;
    readonly category: DetectionCategory;
    readonly count: number;
  }>;
  /** Instructions for restoration */
  readonly instructions: string;
}

/**
 * Configuration for the DebugHalo pipeline
 */
export interface PipelineConfig {
  /** Minimum confidence threshold for detections (0.0 to 1.0) */
  readonly minConfidence?: number;
  /** Categories to enable (empty = all) */
  readonly enabledCategories?: ReadonlyArray<DetectionCategory>;
  /** Categories to disable */
  readonly disabledCategories?: ReadonlyArray<DetectionCategory>;
  /** Custom regex patterns to add */
  readonly customPatterns?: ReadonlyArray<CustomPattern>;
  /** Whether to normalize line endings */
  readonly normalizeLineEndings?: boolean;
  /** Maximum file size to process (bytes) */
  readonly maxInputSize?: number;
  /** Whether to include context in detections */
  readonly includeContext?: boolean;
  /** Context window size (characters before/after) */
  readonly contextWindow?: number;
}

/**
 * Custom pattern definition for user-defined detections
 */
export interface CustomPattern {
  /** Unique name for this pattern */
  readonly name: string;
  /** Category to assign to matches */
  readonly category: DetectionCategory;
  /** Regular expression pattern */
  readonly pattern: string;
  /** Regex flags */
  readonly flags?: string;
  /** Confidence level for matches */
  readonly confidence: DetectionConfidence;
  /** Whether this pattern is enabled */
  readonly enabled?: boolean;
}

/**
 * Result of running the full pipeline
 */
export interface PipelineResult {
  /** Debug bundle output */
  readonly bundle: DebugBundleOutput;
  /** Whether the pipeline completed successfully */
  readonly success: boolean;
  /** Any errors that occurred (non-fatal) */
  readonly warnings: ReadonlyArray<string>;
}

/**
 * Type for detector functions
 */
export type DetectorFunction = (
  input: string,
  config: PipelineConfig
) => ReadonlyArray<DetectionResult>;

/**
 * BaseDetector type for the abstract base class
 */
export type BaseDetector = {
  readonly name: string;
  readonly categories: ReadonlyArray<DetectionCategory>;
  readonly confidence: DetectionConfidence;
  readonly priority: number;
  readonly enabled: boolean;
  detect: (input: string, options?: DetectionOptions) => ReadonlyArray<DetectionResult>;
};

/**
 * Detector instance type
 */
export type Detector = BaseDetector;

/**
 * Registry entry for a detector
 */
export interface DetectorRegistryEntry {
  /** Unique detector name */
  readonly name: string;
  /** Categories this detector handles */
  readonly categories: ReadonlyArray<DetectionCategory>;
  /** Detector function */
  readonly detect: DetectorFunction;
  /** Priority for overlap resolution (higher = runs first) */
  readonly priority?: number;
  /** Whether detector is enabled by default */
  readonly enabled?: boolean;
}

/**
 * Detector registry
 */
export interface DetectorRegistry {
  readonly detectors: BaseDetector[];
}

/**
 * Configuration for detection engine
 */
export interface DetectionConfig {
  /** Minimum confidence threshold */
  readonly minConfidence: number;
  /** Enabled categories */
  readonly enabledCategories: Set<DetectionCategory>;
  /** Custom patterns */
  readonly customPatterns: ReadonlyArray<CustomPattern>;
  /** Whether to include context */
  readonly includeContext: boolean;
  /** Context window size */
  readonly contextWindow: number;
}

/**
 * Options for detection
 */
export interface DetectionOptions {
  /** Minimum confidence threshold for matches (0.0 to 1.0) */
  threshold?: number;
  /** Categories to detect (empty = all) */
  categories?: ReadonlyArray<DetectionCategory>;
  /** Whether to include context in results */
  includeContext?: boolean;
  /** Context window size (characters before/after match) */
  contextWindow?: number;
  /** Custom patterns to add */
  customPatterns?: ReadonlyArray<CustomPattern>;
  /** Disabled categories */
  disabledCategories?: ReadonlyArray<DetectionCategory>;
}

/**
 * Options for sanitization
 */
export interface SanitizationOptions {
  /** Alias vault to use (creates new if not provided) */
  readonly vault?: AliasVault;
  /** Whether to preserve whitespace around replacements */
  readonly preserveWhitespace?: boolean;
  /** Custom alias prefix */
  readonly aliasPrefix?: string;
  /** Custom alias suffix */
  readonly aliasSuffix?: string;
}

/**
 * Options for restoration
 */
export interface RestorationOptions {
  /** Alias vault to use for restoration */
  readonly vault: AliasVault;
  /** Whether to throw on unresolved aliases */
  readonly strict?: boolean;
  /** Whether to include unresolved aliases in output */
  readonly includeUnresolved?: boolean;
}

/**
 * Options for bundle generation
 */
export interface BundleOptions {
  /** Include full sanitized text in bundle */
  readonly includeSanitizedText?: boolean;
  /** Include findings detail in bundle */
  readonly includeFindingsDetail?: boolean;
  /** Include restoration manifest */
  readonly includeRestorationManifest?: boolean;
  /** Custom template for bundle */
  readonly template?: string;
}

// Re-export utility types
export type { DeepReadonly } from './utils.js';

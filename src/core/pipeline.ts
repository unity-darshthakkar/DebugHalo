/**
 * DebugHalo Core Pipeline
 *
 * Orchestrates the full pipeline: detection -> sanitization -> bundle generation
 * Provides a clean public API for CLI and extension consumption.
 */

import type {
  DebugBundleInput,
  DebugBundleOutput,
  PipelineConfig,
  PipelineResult,
  DetectionResult,
  SanitizationResult,
  DetectionCategory,
  AliasVault,
} from '../types/core.js';
import { detect } from './detectors.js';
import { sanitize } from './sanitizer.js';
import { generateDebugBundle } from './debugBundle.js';
import { createAliasVault } from './aliasVault.js';
import { normalizeLineEndings, createDetectionConfig } from './detectors.js';

/**
 * Default maximum input size for pipeline operations (10 MB).
 * Used by both core pipeline validation and CLI file reading to enforce
 * the same decoded-text length limit.
 */
export const MAX_INPUT_SIZE = 10 * 1024 * 1024;

/**
 * Main pipeline entry point
 */
export async function createDebugBundle(input: DebugBundleInput): Promise<DebugBundleOutput> {
  const { rawText, metadata, options } = input;

  // Validate input
  validateInput(rawText, options);

  // Normalize line endings if configured
  let text = rawText;
  if (options?.normalizeLineEndings !== false) {
    text = normalizeLineEndings(text);
  }

  // Run detection
  const detectionConfig = options ? createDetectionConfig(options) : createDetectionConfig({});
  const detections = detect(text, detectionConfig);

  // Filter by confidence
  const minConfidence = options?.minConfidence ?? 0.5;
  const filteredDetections = detections.filter((d) => d.confidence >= minConfidence);

  // Create vault and sanitize
  const vault = createAliasVault();
  const sanitization = sanitize(text, filteredDetections, vault);

  // Generate bundle
  const bundleInput: DebugBundleInput = {
    rawText: text,
    metadata,
    options,
  };

  const bundle = generateDebugBundle(bundleInput, sanitization);

  return bundle;
}

/**
 * Run full pipeline with detailed result
 */
export async function runPipeline(
  rawText: string,
  config: PipelineConfig = {}
): Promise<PipelineResult> {
  try {
    const input: DebugBundleInput = {
      rawText,
      options: config,
    };

    const bundle = await createDebugBundle(input);

    return {
      bundle,
      success: true,
      warnings: [],
    };
  } catch (error) {
    return {
      bundle: createErrorBundle(),
      success: false,
      warnings: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Sanitize only (no bundle generation)
 */
export async function sanitizeText(
  text: string,
  config: PipelineConfig = {},
  vault?: AliasVault
): Promise<SanitizationResult> {
  // Normalize
  const processedText = config.normalizeLineEndings !== false ? normalizeLineEndings(text) : text;

  // Detect
  const detectionConfig = createDetectionConfig(config ?? {});
  const detections = detect(processedText, detectionConfig);

  // Filter
  const minConfidence = config.minConfidence ?? 0.5;
  const filtered = detections.filter((d) => d.confidence >= minConfidence);

  // Sanitize
  return sanitize(processedText, filtered, vault ?? createAliasVault());
}

/**
 * Detect only (no sanitization)
 */
export async function detectOnly(
  text: string,
  config: PipelineConfig = {}
): Promise<ReadonlyArray<DetectionResult>> {
  const processedText = config.normalizeLineEndings !== false ? normalizeLineEndings(text) : text;

  const detectionConfig = createDetectionConfig(config ?? {});
  return detect(processedText, detectionConfig);
}

/**
 * Validate input text
 */
function validateInput(text: string, config?: PipelineConfig): void {
  if (!text || typeof text !== 'string') {
    throw new Error('Input must be a non-empty string');
  }

  const maxSize = config?.maxInputSize ?? MAX_INPUT_SIZE;
  if (text.length > maxSize) {
    throw new Error(`Input exceeds maximum size of ${maxSize} bytes`);
  }
}

/**
 * Create error bundle for failed pipelines
 */
function createErrorBundle(): DebugBundleOutput {
  const errorSanitization: SanitizationResult = {
    sanitizedText: '[ERROR: Pipeline failed - see warnings]',
    detections: [],
    vault: createAliasVault(),
    stats: {
      totalDetections: 0,
      uniqueValues: 0,
      byCategory: new Map(),
      charactersReplaced: 0,
    },
  };

  return {
    bundle: `# DebugHalo Bundle (Error)

## Sanitized Debug Context

[ERROR: Pipeline failed - see warnings]

## Privacy Summary

No detections available due to error.
`,
    sanitization: errorSanitization,
    metadata: {
      formatVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      summary: {
        total: 0,
        uniqueValues: 0,
        byCategory: {} as any,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
      },
      restorationManifest: {
        aliases: [],
        instructions: 'Pipeline failed - no restoration manifest available.',
      },
    },
  };
}

/**
 * Get detection statistics without full pipeline
 */
export function getDetectionStats(detections: ReadonlyArray<DetectionResult>): {
  total: number;
  byCategory: Map<DetectionCategory, number>;
  byConfidence: Map<string, number>;
} {
  const byCategory = new Map<DetectionCategory, number>();
  const byConfidence = new Map<string, number>();

  for (const d of detections) {
    byCategory.set(d.category, (byCategory.get(d.category) ?? 0) + 1);

    const confRange = d.confidence >= 0.8 ? 'high' : d.confidence >= 0.5 ? 'medium' : 'low';
    byConfidence.set(confRange, (byConfidence.get(confRange) ?? 0) + 1);
  }

  return {
    total: detections.length,
    byCategory,
    byConfidence,
  };
}

/**
 * Quick check if text likely contains secrets
 */
export function quickScan(text: string): boolean {
  if (!text || text.length < 10) return false;

  // Quick heuristic checks
  const patterns = [
    /(api[_-]?key|secret|password|token)\s*[:=]/i,
    /\b(sk_|pk_|ghp_|xoxb-|gho_|ghs_|ghe_|ghr_)[a-zA-Z0-9_-]{20,}/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
    /\b[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+\b/,
  ];

  return patterns.some((p) => p.test(text));
}

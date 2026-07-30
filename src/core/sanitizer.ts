/**
 * Sanitization Engine
 *
 * Replaces sensitive values with deterministic aliases based on detection results.
 * Uses range-based replacement to avoid index shifting issues.
 */

import type {
  DetectionResult,
  SanitizationResult,
  SanitizationStats,
  AliasVault,
  DetectionCategory,
} from '../types/core.js';
import { createAliasVault, getOrCreateAlias } from './aliasVault.js';

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  /** Alias vault to use (created if not provided) */
  vault?: AliasVault;
  /** Whether to include context in results */
  includeContext?: boolean;
}

/**
 * Sanitize text using detection results
 */
export function sanitize(
  text: string,
  detections: ReadonlyArray<DetectionResult>,
  vault?: AliasVault
): SanitizationResult {
  if (!text || text.length === 0 || detections.length === 0) {
    return createEmptySanitizationResult(text, vault ?? createAliasVault());
  }

  // Use provided vault or create new one
  const activeVault = vault ?? createAliasVault();

  // First pass: assign aliases left-to-right to ensure deterministic ordering
  // We need to sort detections by start position ascending to assign aliases in order
  const detectionsForAlias = [...detections].sort((a, b) => a.range.start - b.range.start);
  for (const detection of detectionsForAlias) {
    const { value, category } = detection;
    // This will create the alias if it doesn't exist, or return existing one
    getOrCreateAlias(activeVault, value, category);
  }

  // Second pass: sort detections by start position descending (replace from end to start)
  // This avoids index shifting issues
  const sortedDetections = [...detections].sort((a, b) => b.range.start - a.range.start);

  // Build sanitized text by replacing from end to start
  let sanitizedText = text;
  let charactersReplaced = 0;

  for (const detection of sortedDetections) {
    const { range, value, category } = detection;
    const { start, end } = range;

    // Validate range
    if (start < 0 || end > text.length || start >= end) {
      continue;
    }

    // Get the alias (already created in first pass)
    const alias = getOrCreateAlias(activeVault, value, category);

    const replacementLength = alias.length - value.length;
    charactersReplaced += Math.abs(replacementLength);

    // Replace in sanitized text
    sanitizedText = sanitizedText.slice(0, start) + alias + sanitizedText.slice(end);
  }

  // Generate stats
  const stats = generateStats(detections, charactersReplaced);

  return {
    sanitizedText,
    detections,
    vault: activeVault,
    stats,
  };
}

/**
 * Create empty sanitization result
 */
function createEmptySanitizationResult(text: string, vault: AliasVault): SanitizationResult {
  return {
    sanitizedText: text,
    detections: [],
    vault,
    stats: {
      totalDetections: 0,
      uniqueValues: 0,
      byCategory: new Map(),
      charactersReplaced: 0,
    },
  };
}

/**
 * Generate sanitization statistics
 */
function generateStats(
  detections: ReadonlyArray<DetectionResult>,
  charactersReplaced: number
): SanitizationStats {
  const uniqueValues = new Set(detections.map((d) => d.value));
  const byCategory = new Map<DetectionCategory, number>();

  for (const detection of detections) {
    byCategory.set(detection.category, (byCategory.get(detection.category) ?? 0) + 1);
  }

  return {
    totalDetections: detections.length,
    uniqueValues: uniqueValues.size,
    byCategory,
    charactersReplaced,
  };
}

/**
 * Sanitize with custom alias prefix/suffix (for testing or special cases)
 */
export function sanitizeWithCustomAliases(
  text: string,
  detections: ReadonlyArray<DetectionResult>,
  getAlias: (value: string, category: DetectionCategory) => string
): SanitizationResult {
  if (!text || text.length === 0 || detections.length === 0) {
    const vault = createAliasVault();
    return createEmptySanitizationResult(text, vault);
  }

  const vault = createAliasVault();

  // First pass: assign aliases left-to-right
  const detectionsForAlias = [...detections].sort((a, b) => a.range.start - b.range.start);
  for (const detection of detectionsForAlias) {
    getAlias(detection.value, detection.category);
  }

  // Second pass: replace right-to-left
  const sortedDetections = [...detections].sort((a, b) => b.range.start - a.range.start);

  let sanitizedText = text;
  let charactersReplaced = 0;

  for (const detection of sortedDetections) {
    const { range, value, category } = detection;
    const { start, end } = range;

    if (start < 0 || end > text.length || start >= end) {
      continue;
    }

    const alias = getAlias(value, category);
    const replacementLength = alias.length - value.length;
    charactersReplaced += Math.abs(replacementLength);

    sanitizedText = sanitizedText.slice(0, start) + alias + sanitizedText.slice(end);
  }

  const stats = generateStats(detections, charactersReplaced);

  return {
    sanitizedText,
    detections,
    vault,
    stats,
  };
}

/**
 * Apply multiple sanitizations sequentially (for layered processing)
 */
export function sanitizeLayered(
  text: string,
  detectionLayers: ReadonlyArray<ReadonlyArray<DetectionResult>>,
  vault?: AliasVault
): SanitizationResult {
  const activeVault = vault ?? createAliasVault();
  let currentText = text;
  const allDetections: DetectionResult[] = [];

  for (const detections of detectionLayers) {
    const result = sanitize(currentText, detections, activeVault);
    currentText = result.sanitizedText;
    allDetections.push(...result.detections);
  }

  const stats = generateStats(allDetections, calculateReplacedChars(text, currentText));

  return {
    sanitizedText: currentText,
    detections: allDetections,
    vault: activeVault,
    stats,
  };
}

/**
 * Calculate character difference between original and sanitized
 */
function calculateReplacedChars(original: string, sanitized: string): number {
  return Math.abs(original.length - sanitized.length);
}

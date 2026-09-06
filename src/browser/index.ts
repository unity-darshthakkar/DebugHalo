/**
 * Browser-safe DebugHalo entry point.
 *
 * This module intentionally excludes filesystem-backed vault persistence and
 * CLI integrations. Browser consumers use the same detector and sanitization
 * pipeline as the CLI without importing Node.js built-ins.
 */
export { detectOnly as scanText, sanitizeText } from '../core/pipeline.js';

export type {
  AliasVault,
  DetectionCategory,
  DetectionConfidence,
  DetectionResult,
  DetectionSeverity,
  PipelineConfig,
  SanitizationResult,
  SourceRange,
} from '../types/core.js';

/**
 * DebugHalo Core - Public API
 *
 * Main entry point for the DebugHalo shared core pipeline.
 * Provides deterministic secret detection, sanitization, and debug bundle generation.
 */

// Types
import type { DebugBundleOutput } from '../types/core.js';

export type {
  DetectionCategory,
  DetectionConfidence,
  DetectionSeverity,
  SourceRange,
  DetectionResult,
  AliasEntry,
  AliasVault,
  ReadonlyAliasVault,
  SanitizationResult,
  SanitizationStats,
  RestorationResult,
  DebugBundleInput,
  DebugBundleOutput,
  DebugBundleMetadata,
  FindingsSummary,
  RestorationManifest,
  PipelineConfig,
  CustomPattern,
  PipelineResult,
  DetectorFunction,
  DetectorRegistryEntry,
  DetectionConfig,
  SanitizationOptions,
  RestorationOptions,
  BundleOptions,
} from '../types/core.js';

// Alias Vault
export {
  createAliasVault,
  getOrCreateAlias,
  getAlias,
  getOriginal,
  getAllEntries,
  getEntriesByCategory,
  getAllAliases,
  hasAlias,
  hasAliasKey,
  getReplacementCount,
  getVaultStats,
  cloneVault,
  mergeVaults,
  createRestorationVault,
  createVaultFromManifest,
  createVaultFromEntries,
  serializeVaultForExport,
  AliasVault as AliasVaultClass,
} from './aliasVault.js';

// Detectors
export {
  detectorRegistry,
  DEFAULT_DETECTION_OPTIONS,
  detect,
  resolveOverlaps,
  createDetection,
  extractContext,
  normalizeLineEndings,
  createDetectionConfig,
  compileCustomPatterns,
} from './detectors.js';

export type {
  BaseDetector,
  Detector,
  DetectorRegistry,
  DetectionOptions,
} from './detectors/index.js';

export { createApiKeyDetector, createApiKeyMediumDetector } from './detectors/apiKey.js';
export { createJwtDetector, createPermissiveJwtDetector } from './detectors/jwt.js';
export { createAuthorizationHeaderDetector } from './detectors/authHeader.js';
export { createPrivateKeyDetector } from './detectors/privateKey.js';
export { createDatabaseUrlDetector } from './detectors/databaseUrl.js';
export { createPasswordDetector } from './detectors/password.js';
export { createEmailDetector } from './detectors/email.js';
export { createInternalUrlDetector } from './detectors/internalUrl.js';
export { createIpAddressDetector } from './detectors/ipAddress.js';
export { createAwsSecretKeyDetector } from './detectors/awsSecretKey.js';
export { createGithubTokenDetector } from './detectors/githubToken.js';
export { createSlackTokenDetector } from './detectors/slackToken.js';
export { createGenericSecretDetector } from './detectors/genericSecret.js';
export { createServiceCredentialDetector } from './detectors/serviceCredentials.js';

export { severityForCategory, isObviousPlaceholder } from './detectionPolicy.js';

// Sanitization
export { sanitize, sanitizeWithCustomAliases, sanitizeLayered } from './sanitizer.js';

// Restoration
export {
  restore,
  restoreAll,
  hasAliases,
  findAliases,
  getUnresolvedAliases,
  validateRestoration,
  createRestorationManifest,
} from './restorer.js';
export type { RestorationValidation } from './restorer.js';

export {
  DEFAULT_VAULT_PATH,
  PersistentVaultError,
  resolveVaultPath,
  assertSafeVaultPath,
  loadPersistentVault,
  savePersistentVault,
} from './persistentVault.js';

// Debug Bundle
export { generateDebugBundle, generateCompactBundle, generateJsonBundle } from './debugBundle.js';

// Pipeline
export {
  createDebugBundle,
  runPipeline,
  sanitizeText,
  detectOnly,
  getDetectionStats,
  quickScan,
  MAX_INPUT_SIZE,
} from './pipeline.js';

// Core version
export const CORE_VERSION = '0.2.0';

/**
 * Quick start function for simple sanitization
 */
export async function quickSanitize(text: string): Promise<string> {
  const { sanitizeText } = await import('./pipeline.js');
  const result = await sanitizeText(text);
  return result.sanitizedText;
}

/**
 * Quick start function for creating a debug bundle
 */
export async function quickBundle(text: string): Promise<DebugBundleOutput> {
  const { createDebugBundle } = await import('./pipeline.js');
  const input = { rawText: text };
  return createDebugBundle(input);
}

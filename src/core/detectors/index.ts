/**
 * Detectors Index
 *
 * Exports all built-in detectors and the detector registry.
 */

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
} from '../detectors.js';
export type {
  BaseDetector,
  DetectorRegistry,
  Detector,
  DetectionOptions,
  BaseDetector as DetectorBase,
  DetectorRegistryEntry,
} from '../../types/core.js';

export { createApiKeyDetector, createApiKeyMediumDetector } from './apiKey.js';
export { createJwtDetector, createPermissiveJwtDetector } from './jwt.js';
export { createAuthorizationHeaderDetector } from './authHeader.js';
export { createPrivateKeyDetector } from './privateKey.js';
export { createDatabaseUrlDetector } from './databaseUrl.js';
export { createPasswordDetector } from './password.js';
export { createEmailDetector } from './email.js';
export { createInternalUrlDetector } from './internalUrl.js';
export { createIpAddressDetector } from './ipAddress.js';
export { createAwsSecretKeyDetector } from './awsSecretKey.js';
export { createAwsAccessKeyDetector } from './awsAccessKey.js';
export { createGithubTokenDetector } from './githubToken.js';
export { createSlackTokenDetector } from './slackToken.js';
export { createGenericSecretDetector } from './genericSecret.js';

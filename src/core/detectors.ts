/**
 * Detector Registry and Core Detection Engine
 *
 * This module provides the detector registry and core detection logic
 * for identifying secrets, PII, and other sensitive data in text.
 */

// All detection categories - imported from types
import { ALL_CATEGORIES as ALL_CATEGORIES_TYPE } from '../types/core.js';

import type {
  DetectionOptions,
  DetectorRegistry,
  CustomPattern,
  DetectionCategory,
  DetectionConfidence,
  DetectionResult,
  PipelineConfig,
} from '../types/core.js';
import { BaseDetector } from './detectors/baseDetector.js';

// Import all built-in detector factories at module load time
import { createApiKeyDetector, createApiKeyMediumDetector } from './detectors/apiKey.js';
import { createJwtDetector, createPermissiveJwtDetector } from './detectors/jwt.js';
import { createAuthorizationHeaderDetector } from './detectors/authHeader.js';
import { createPrivateKeyDetector } from './detectors/privateKey.js';
import { createDatabaseUrlDetector } from './detectors/databaseUrl.js';
import { createPasswordDetector } from './detectors/password.js';
import { createEmailDetector } from './detectors/email.js';
import { createInternalUrlDetector } from './detectors/internalUrl.js';
import { createIpAddressDetector } from './detectors/ipAddress.js';
import { createAwsSecretKeyDetector } from './detectors/awsSecretKey.js';
import { createGithubTokenDetector } from './detectors/githubToken.js';
import { createSlackTokenDetector } from './detectors/slackToken.js';
import { createGenericSecretDetector } from './detectors/genericSecret.js';

/**
 * Default detection options
 */
export const DEFAULT_DETECTION_OPTIONS: DetectionOptions = {
  threshold: 0.5,
  categories: ALL_CATEGORIES_TYPE,
  includeContext: true,
  contextWindow: 50,
  customPatterns: [],
};

/**
 * Create a detector registry
 */
export function createDetectorRegistry(): DetectorRegistry {
  return {
    detectors: [] as BaseDetector[],
  } as DetectorRegistry;
}

/**
 * Detector Registry Instance
 */
export const detectorRegistry = createDetectorRegistry();

/**
 * Category priority for overlap resolution (higher = more specific, wins ties)
 */
const CATEGORY_PRIORITY: Record<string, number> = {
  private_key: 100,
  ssh_private_key: 100,
  pgp_private_key: 100,
  aws_secret_key: 95,
  jwt: 90,
  github_token: 85,
  slack_token: 85,
  database_url: 80,
  mysql_url: 80,
  postgres_url: 80,
  mongodb_url: 80,
  redis_url: 80,
  authorization_header: 75,
  api_key: 70,
  api_key_env: 70,
  password_env: 65,
  password_config: 65,
  secret_env: 65,
  internal_url: 60,
  internal_domain: 60,
  ip_address: 55,
  email: 50,
  generic_secret: 10,
};

/**
 * Get priority for a category
 */
function getCategoryPriority(category: string): number {
  return CATEGORY_PRIORITY[category] ?? 0;
}

/**
 * Register a built-in detector
 */
function registerBuiltinDetector(detector: BaseDetector): void {
  detectorRegistry.detectors.push(detector);
}

/**
 * Initialize built-in detectors (called at module load)
 */
function initBuiltinDetectors(): void {
  // Register all built-in detectors
  registerBuiltinDetector(createApiKeyDetector());
  registerBuiltinDetector(createApiKeyMediumDetector());
  registerBuiltinDetector(createJwtDetector());
  registerBuiltinDetector(createPermissiveJwtDetector());
  registerBuiltinDetector(createAuthorizationHeaderDetector());
  registerBuiltinDetector(createPrivateKeyDetector());
  registerBuiltinDetector(createDatabaseUrlDetector());
  registerBuiltinDetector(createPasswordDetector());
  registerBuiltinDetector(createEmailDetector());
  registerBuiltinDetector(createInternalUrlDetector());
  registerBuiltinDetector(createIpAddressDetector());
  registerBuiltinDetector(createAwsSecretKeyDetector());
  registerBuiltinDetector(createGithubTokenDetector());
  registerBuiltinDetector(createSlackTokenDetector());
  registerBuiltinDetector(createGenericSecretDetector());

  // Sort detectors by priority (highest first)
  detectorRegistry.detectors.sort((a, b) => {
    const aPriority = getCategoryPriority(a.categories[0] ?? '');
    const bPriority = getCategoryPriority(b.categories[0] ?? '');
    return bPriority - aPriority;
  });
}

// Initialize detectors at module load
initBuiltinDetectors();

/**
 * Initialize built-in detectors asynchronously (no-op since already initialized)
 */
export async function initBuiltinDetectorsAsync(): Promise<void> {
  // Already initialized at module load
  return;
}

/**
 * Detect sensitive data in text
 */
export function detect(input: string, config: DetectionOptions): ReadonlyArray<DetectionResult> {
  if (!input || typeof input !== 'string') {
    return [];
  }

  const detectors = detectorRegistry.detectors;
  const allDetections: DetectionResult[] = [];

  for (const detector of detectors) {
    if (detector.enabled === false) continue;

    const detectorOptions: DetectionOptions = {
      ...DEFAULT_DETECTION_OPTIONS,
      ...config,
      threshold: Math.max(config.threshold ?? 0, detector.confidence),
    };

    const detections = detector.detect(input, detectorOptions);

    for (const detection of detections) {
      if (detection.confidence >= (detectorOptions.threshold ?? 0.5)) {
        allDetections.push(detection);
      }
    }
  }

  // Filter by confidence
  const filtered = allDetections.filter((d) => d.confidence >= (config.threshold ?? 0.5));

  // Resolve overlaps
  return resolveOverlaps(filtered);
}

/**
 * Resolve overlapping detections using priority rules
 * Priority: higher category priority > higher confidence > longer match > earlier registration
 */
export function resolveOverlaps(
  detections: ReadonlyArray<DetectionResult>
): ReadonlyArray<DetectionResult> {
  if (detections.length <= 1) {
    return detections;
  }

  // Sort by: category priority desc, confidence desc, length desc, registration order asc
  const sorted = [...detections].sort((a, b) => {
    if (a.range.start !== b.range.start) {
      return a.range.start - b.range.start;
    }
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    const aLen = a.range.end - a.range.start;
    const bLen = b.range.end - b.range.start;
    if (bLen !== aLen) {
      return bLen - aLen;
    }
    // Use category priority as tiebreaker
    const priorityA = CATEGORY_PRIORITY[a.category] ?? 0;
    const priorityB = CATEGORY_PRIORITY[b.category] ?? 0;
    return priorityB - priorityA;
  });

  const resolved: DetectionResult[] = [];
  let lastEnd = -1;

  for (const detection of sorted) {
    if (detection.range.start >= lastEnd) {
      resolved.push(detection);
      lastEnd = detection.range.end;
    }
    // If overlapping, skip the lower priority detection
  }

  return resolved;
}

/**
 * Create a detection result with standard fields
 */
export function createDetection(
  input: string,
  start: number,
  end: number,
  category: DetectionCategory,
  confidence: DetectionConfidence,
  options: {
    detectorName: string;
    contextWindow?: number;
    includeContext?: boolean;
    contextBefore?: string;
    contextAfter?: string;
  }
): DetectionResult {
  const value = input.slice(start, end);
  const contextWindow = options.contextWindow ?? 50;
  const includeContext = options.includeContext ?? true;

  let contextBefore = '';
  let contextAfter = '';

  if (includeContext) {
    const beforeStart = Math.max(0, start - contextWindow);
    const afterEnd = Math.min(input.length, end + contextWindow);
    contextBefore = input.slice(beforeStart, start);
    contextAfter = input.slice(end, afterEnd);
  }

  // Calculate line and column numbers
  const textBeforeStart = input.slice(0, start);
  const textBeforeEnd = input.slice(0, end);
  const startLine = textBeforeStart.split('\n').length;
  const endLine = textBeforeEnd.split('\n').length;
  const startColumn = start - textBeforeStart.lastIndexOf('\n');
  const endColumn = end - textBeforeEnd.lastIndexOf('\n');

  return {
    id: `${options.detectorName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    category,
    value,
    confidence,
    range: { start, end, startLine, endLine, startColumn, endColumn },
    detectorName: options.detectorName,
    context: includeContext ? `${contextBefore}...${value}...${contextAfter}` : undefined,
  };
}

/**
 * Extract context around a match
 */
export function extractContext(
  input: string,
  start: number,
  end: number,
  window: number
): { before: string; after: string } {
  const beforeStart = Math.max(0, start - window);
  const afterEnd = Math.min(input.length, end + window);
  return {
    before: input.slice(beforeStart, start),
    after: input.slice(end, afterEnd),
  };
}

/**
 * Normalize line endings to LF
 */
export function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Create a DetectionConfig from PipelineConfig
 */
export function createDetectionConfig(config: PipelineConfig): DetectionOptions {
  return {
    threshold: config.minConfidence ?? 0.5,
    categories: config.enabledCategories ?? ALL_CATEGORIES_TYPE,
    includeContext: config.includeContext ?? true,
    contextWindow: config.contextWindow ?? 50,
    customPatterns: config.customPatterns ?? [],
    disabledCategories: config.disabledCategories,
  };
}

/**
 * Validate and compile custom patterns
 */
export function compileCustomPatterns(
  patterns: ReadonlyArray<CustomPattern>
): ReadonlyArray<CustomPattern & { regex: RegExp }> {
  return patterns.map((p) => {
    try {
      const flags = p.flags || 'gi';
      return { ...p, regex: new RegExp(p.pattern, flags) };
    } catch {
      return { ...p, regex: /(?!)/ }; // Never-matching regex
    }
  });
}

// Re-export types
export type {
  BaseDetector,
  Detector,
  DetectorRegistry,
  DetectionOptions,
  CustomPattern,
  DetectionCategory,
  DetectionConfidence,
  DetectionResult,
  ALL_CATEGORIES,
} from '../types/core.js';

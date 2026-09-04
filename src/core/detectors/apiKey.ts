/**
 * API Key Detector
 *
 * Detects various API key patterns with high confidence.
 * Covers common formats from major cloud providers and services.
 */

import { BaseDetector } from './baseDetector.js';
import type {
  DetectionCategory,
  DetectionConfidence,
  DetectionOptions,
  DetectionResult,
} from '../../types/core.js';

/**
 * AWS Access Key ID pattern
 * Format: AKIA[0-9A-Z]{16} or ASIA[0-9A-Z]{16}
 */
const AWS_ACCESS_KEY_PATTERN = /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g;

/**
 * Generic API key patterns - high confidence
 * These are well-known prefix formats
 */
const HIGH_CONFIDENCE_PATTERNS: Array<{
  category: DetectionCategory;
  pattern: RegExp;
  prefixes: string[];
}> = [
  {
    category: 'api_key',
    prefixes: ['sk-', 'rk-', 'pk-'],
    pattern: /\b(sk|rk|pk)_[a-zA-Z0-9]{32,}\b/g,
  },
  {
    category: 'api_key',
    prefixes: ['api_', 'key_', 'token_'],
    pattern: /\b(api|key|token)_[a-zA-Z0-9_-]{20,}\b/g,
  },
  {
    category: 'stripe_key',
    prefixes: ['sk_live_', 'sk_test_', 'rk_live_', 'rk_test_', 'pk_live_', 'pk_test_'],
    pattern: /\b(sk|rk|pk)_(live|test)_[a-zA-Z0-9]{24,}\b/g,
  },
  {
    category: 'openai_key',
    prefixes: ['sk-'],
    pattern: /\bsk-[a-zA-Z0-9]{48,}\b/g,
  },
  {
    category: 'anthropic_key',
    prefixes: ['sk-ant-'],
    pattern: /\bsk-ant-[a-zA-Z0-9_-]{80,}\b/g,
  },
];

/**
 * Medium confidence patterns - common formats
 */
const MEDIUM_CONFIDENCE_PATTERNS: Array<{
  category: DetectionCategory;
  pattern: RegExp;
  description: string;
}> = [
  {
    category: 'api_key',
    pattern: /\b[A-Za-z0-9]{32,}\b/g,
    description: 'Long alphanumeric string (potential key)',
  },
  {
    category: 'api_key',
    pattern: /\b[0-9a-f]{32,}\b/g,
    description: 'Long hex string (potential key)',
  },
];

/**
 * Create API key detector with high confidence patterns
 */
function createHighConfidenceDetector(): new () => BaseDetector {
  const detectorName = 'api-key-high-confidence';

  class ApiKeyHighConfidenceDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = [
      'api_key',
      'aws_access_key',
      'stripe_key',
      'openai_key',
      'anthropic_key',
    ] as const;
    public readonly confidence = 0.95 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      // Check AWS Access Key
      for (const match of text.matchAll(AWS_ACCESS_KEY_PATTERN)) {
        if (match.index === undefined) continue;
        results.push(
          this.createDetection(
            text,
            match.index,
            match.index + match[0].length,
            'aws_access_key' as DetectionCategory,
            this.confidence,
            { contextWindow, reason: 'AWS access key with a recognized prefix' }
          )
        );
      }

      // Check high confidence patterns
      for (const { category, pattern } of HIGH_CONFIDENCE_PATTERNS) {
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;
          // Verify it's actually a key-like string (has entropy)
          if (!this.hasSufficientEntropy(match[0])) continue;
          results.push(
            this.createDetection(
              text,
              match.index,
              match.index + match[0].length,
              category,
              this.confidence,
              { contextWindow, reason: `${category} credential with a recognized key prefix` }
            )
          );
        }
      }

      return results;
    }
  }

  return ApiKeyHighConfidenceDetector;
}

/**
 * Create API key detector with medium confidence patterns
 */
function createMediumConfidenceDetector(): new () => BaseDetector {
  const detectorName = 'api-key-medium-confidence';

  class ApiKeyMediumConfidenceDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['api_key'] as const;
    public readonly confidence = 0.6 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      // Only apply in contexts that suggest keys
      const keyContextPatterns = [
        /api[_-]?key/i,
        /secret[_-]?key/i,
        /access[_-]?token/i,
        /auth[_-]?token/i,
        /bearer/i,
        /authorization/i,
      ];

      // Check if text has key context nearby
      const hasKeyContext = keyContextPatterns.some((p) => p.test(text));

      if (!hasKeyContext) return results;

      for (const { pattern, category } of MEDIUM_CONFIDENCE_PATTERNS) {
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;
          // Additional validation for medium confidence
          if (!this.looksLikeKey(match[0], text, match.index)) continue;
          results.push(
            this.createDetection(
              text,
              match.index,
              match.index + match[0].length,
              category,
              this.confidence,
              { contextWindow }
            )
          );
        }
      }

      return results;
    }

    /**
     * Check if match looks like a key in context
     */
    private looksLikeKey(match: string, text: string, index: number): boolean {
      // Check surrounding context
      const before = text.slice(Math.max(0, index - 50), index).toLowerCase();
      const after = text.slice(index + match.length, index + match.length + 50).toLowerCase();
      const context = before + after;

      // Must have key-related context
      const keyIndicators = ['key', 'token', 'secret', 'auth', 'api', 'credential', 'password'];
      return keyIndicators.some((indicator) => context.includes(indicator));
    }
  }

  return ApiKeyMediumConfidenceDetector;
}

/**
 * Export factory functions for detector creation
 */
export function createApiKeyDetector(): BaseDetector {
  return new (createHighConfidenceDetector())();
}

export function createApiKeyMediumDetector(): BaseDetector {
  return new (createMediumConfidenceDetector())();
}

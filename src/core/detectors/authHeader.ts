/**
 * Authorization Header Detector
 *
 * Detects Authorization headers with Bearer tokens, Basic auth, etc.
 * Replaces only the credential portion while preserving the header context.
 */

import { BaseDetector } from './baseDetector.js';
import type {
  DetectionCategory,
  DetectionConfidence,
  DetectionOptions,
  DetectionResult,
} from '../../types/core.js';

/**
 * Authorization header patterns
 */
const AUTH_HEADER_PATTERNS = [
  // Bearer tokens: Authorization: Bearer <token>
  {
    category: 'bearer_token' as DetectionCategory,
    pattern: /(authorization\s*:\s*Bearer\s+)([a-zA-Z0-9\-_.=+/]+)/gi,
    confidence: 0.95 as DetectionConfidence,
    replacementGroup: 2,
  },
  // Bearer tokens without header name: Bearer <token>
  {
    category: 'bearer_token' as DetectionCategory,
    pattern: /\b(Bearer\s+)([a-zA-Z0-9\-_.=+/]+)/gi,
    confidence: 0.85 as DetectionConfidence,
    replacementGroup: 2,
  },
  // Basic auth: Authorization: Basic <base64>
  {
    category: 'basic_auth' as DetectionCategory,
    pattern: /(authorization\s*:\s*Basic\s+)([a-zA-Z0-9+/=]+)/gi,
    confidence: 0.95 as DetectionConfidence,
    replacementGroup: 2,
  },
  // Basic auth without header: Basic <base64>
  {
    category: 'basic_auth' as DetectionCategory,
    pattern: /\b(Basic\s+)([a-zA-Z0-9+/=]+)/gi,
    confidence: 0.85 as DetectionConfidence,
    replacementGroup: 2,
  },
  // Generic Authorization header with credential-like value
  {
    category: 'authorization_header' as DetectionCategory,
    pattern: /(authorization\s*:\s*)([a-zA-Z0-9\-_.=+/]{20,})/gi,
    confidence: 0.7 as DetectionConfidence,
    replacementGroup: 2,
  },
  // Token in various formats
  {
    category: 'authorization_header' as DetectionCategory,
    pattern: /(token\s*[:=]\s*['"]?)([a-zA-Z0-9\-_.=+/]{20,})/gi,
    confidence: 0.75 as DetectionConfidence,
    replacementGroup: 2,
  },
  // API key headers
  {
    category: 'api_key' as DetectionCategory,
    pattern: /(x-api-key\s*[:=]\s*['"]?)([a-zA-Z0-9\-_.]{20,})/gi,
    confidence: 0.9 as DetectionConfidence,
    replacementGroup: 2,
  },
  {
    category: 'api_key' as DetectionCategory,
    pattern: /(api-key\s*[:=]\s*['"]?)([a-zA-Z0-9\-_.]{20,})/gi,
    confidence: 0.9 as DetectionConfidence,
    replacementGroup: 2,
  },
];

function createAuthHeaderDetectorImpl(): new () => BaseDetector {
  const detectorName = 'auth-header-detector';

  class AuthHeaderDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = [
      'bearer_token',
      'basic_auth',
      'authorization_header',
      'api_key',
    ] as const;
    public readonly confidence = 0.9 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      for (const { category, pattern, confidence, replacementGroup } of AUTH_HEADER_PATTERNS) {
        // Reset regex lastIndex
        pattern.lastIndex = 0;

        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const fullStart = match.index;
          // Calculate the start and end of just the credential portion
          const prefixLength = match[replacementGroup - 1]?.length ?? 0;
          const credential = match[replacementGroup];
          if (!credential) continue;
          const credentialStart = fullStart + prefixLength;
          const credentialEnd = credentialStart + credential.length;

          // Check for exact duplicate
          if (
            results.some((r) => r.range.start === credentialStart && r.range.end === credentialEnd)
          ) {
            continue;
          }

          // Only report the credential portion
          results.push(
            this.createDetection(text, credentialStart, credentialEnd, category, confidence, {
              contextWindow,
            })
          );
        }
      }

      return results;
    }
  }

  return AuthHeaderDetector;
}

export function createAuthorizationHeaderDetector(): BaseDetector {
  return new (createAuthHeaderDetectorImpl())();
}

/**
 * Authorization Header Detector
 *
 * Detects Authorization headers with Bearer tokens, Basic auth, etc.
 * Replaces only the credential portion while preserving the header context.
 * Avoids placeholders and coordinates with more-specific detectors (JWT, API keys).
 */

import { BaseDetector } from './baseDetector.js';
import type {
  DetectionCategory,
  DetectionConfidence,
  DetectionOptions,
  DetectionResult,
} from '../../types/core.js';

/**
 * Common placeholder values to reject
 */
const PLACEHOLDER_VALUES = new Set([
  '<token>',
  'your_token',
  'your_token_here',
  'replace_me',
  'example',
  'null',
  'undefined',
  'changeme',
  'placeholder',
  '<api_key>',
  '<secret>',
  '<password>',
]);

/**
 * Check if a value is a placeholder
 */
function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_VALUES.has(lower) || /^[<{}].*[>}]$/.test(value.trim());
}

/**
 * Authorization header patterns
 * Each pattern captures the full match and the credential portion (group 2)
 */
const AUTH_HEADER_PATTERNS = [
  // Bearer tokens: Authorization: Bearer <token>
  {
    category: 'bearer_token' as DetectionCategory,
    pattern: /(authorization\s*:\s*Bearer\s+)([a-zA-Z0-9\-_.=+/]{20,})/gi,
    confidence: 0.95 as DetectionConfidence,
    credentialGroup: 2,
  },
  // Bearer tokens without header name: Bearer <token>
  {
    category: 'bearer_token' as DetectionCategory,
    pattern: /\b(Bearer\s+)([a-zA-Z0-9\-_.=+/]{20,})/gi,
    confidence: 0.85 as DetectionConfidence,
    credentialGroup: 2,
  },
  // authorization = bearer <token> (config style)
  {
    category: 'bearer_token' as DetectionCategory,
    pattern: /(authorization\s*[=:]\s*['"]?bearer\s+)([a-zA-Z0-9\-_.=+/]{20,})/gi,
    confidence: 0.85 as DetectionConfidence,
    credentialGroup: 2,
  },
  // JSON-style: "authorization": "Bearer <token>"
  {
    category: 'bearer_token' as DetectionCategory,
    pattern: /("authorization"\s*:\s*"Bearer\s+)([a-zA-Z0-9\-_.=+/]{20,})/gi,
    confidence: 0.9 as DetectionConfidence,
    credentialGroup: 2,
  },
  // Basic auth: Authorization: Basic <base64>
  {
    category: 'basic_auth' as DetectionCategory,
    pattern: /(authorization\s*:\s*Basic\s+)([a-zA-Z0-9+/=]{8,})/gi,
    confidence: 0.95 as DetectionConfidence,
    credentialGroup: 2,
  },
  // Basic auth without header: Basic <base64>
  {
    category: 'basic_auth' as DetectionCategory,
    pattern: /\b(Basic\s+)([a-zA-Z0-9+/=]{8,})/gi,
    confidence: 0.85 as DetectionConfidence,
    credentialGroup: 2,
  },
  // Generic Authorization header with credential-like value
  {
    category: 'authorization_header' as DetectionCategory,
    pattern: /(authorization\s*:\s*)([a-zA-Z0-9\-_.=+/]{20,})/gi,
    confidence: 0.7 as DetectionConfidence,
    credentialGroup: 2,
  },
  // Token in various formats: token = "value" or token: value
  {
    category: 'authorization_header' as DetectionCategory,
    pattern: /(token\s*[=:]\s*['"]?)([a-zA-Z0-9\-_.=+/]{20,})/gi,
    confidence: 0.75 as DetectionConfidence,
    credentialGroup: 2,
  },
  // API key headers
  {
    category: 'api_key' as DetectionCategory,
    pattern: /(x-api-key\s*[=:]\s*['"]?)([a-zA-Z0-9\-_.]{20,})/gi,
    confidence: 0.9 as DetectionConfidence,
    credentialGroup: 2,
  },
  {
    category: 'api_key' as DetectionCategory,
    pattern: /(api-key\s*[=:]\s*['"]?)([a-zA-Z0-9\-_.]{20,})/gi,
    confidence: 0.9 as DetectionConfidence,
    credentialGroup: 2,
  },
  // Cookie-style auth (for log contexts)
  {
    category: 'authorization_header' as DetectionCategory,
    pattern: /(authorization=)([a-zA-Z0-9\-_.=+/]{20,})/gi,
    confidence: 0.8 as DetectionConfidence,
    credentialGroup: 2,
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
    public override readonly priority: number = 75;
    public override readonly aliasPrefix: string = 'AUTH_HEADER';
    public override readonly contextKeywords: ReadonlyArray<string> = [
      'authorization',
      'bearer',
      'basic',
      'token',
      'api-key',
      'x-api-key',
    ];

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];
      const contextWindow = options.contextWindow ?? 50;

      for (const { category, pattern, confidence, credentialGroup } of AUTH_HEADER_PATTERNS) {
        pattern.lastIndex = 0;

        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const fullStart = match.index;
          const credential = match[credentialGroup];
          if (!credential) continue;

          // Reject placeholder values
          if (isPlaceholder(credential)) continue;

          // Calculate credential position
          const prefixLength = match[credentialGroup - 1]?.length ?? 0;
          const credentialStart = fullStart + prefixLength;
          const credentialEnd = credentialStart + credential.length;

          // Check for exact duplicate
          if (
            results.some((r) => r.range.start === credentialStart && r.range.end === credentialEnd)
          ) {
            continue;
          }

          // Report only the credential portion
          results.push(
            this.createDetection(text, credentialStart, credentialEnd, category, confidence, {
              contextWindow,
              reason: `${category} credential in authorization context`,
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

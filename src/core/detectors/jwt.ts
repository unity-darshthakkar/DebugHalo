/**
 * JWT (JSON Web Token) Detector
 *
 * Detects standard three-section JWTs with high confidence.
 * Validates basic structure (header.payload.signature) to reduce false positives.
 * Avoids false positives from version numbers, domains, and other dotted strings.
 */

import { BaseDetector } from './baseDetector.js';
import type { DetectionConfidence, DetectionOptions, DetectionResult } from '../../types/core.js';

/**
 * JWT pattern - three base64url-encoded parts separated by dots
 * Matches strings starting with eyJ (base64url of {"alg":...) for stricter matching
 * Captures header, payload, and signature groups
 */
const JWT_PATTERN = /\b(eyJ[a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\b/g;

/**
 * Check if a string is valid base64url
 * Does not throw on invalid input - returns false instead
 */
function isValidBase64Url(str: string): boolean {
  if (!str || str.length === 0) return false;
  // Base64url uses A-Z, a-z, 0-9, -, _
  // No padding with = is used in JWT
  if (!/^[A-Za-z0-9_-]+$/.test(str)) {
    return false;
  }
  try {
    // Add padding if needed and decode
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
    // Convert base64url to standard base64
    const standard = padded.replace(/-/g, '+').replace(/_/g, '/');
    // Try to decode - will throw if invalid
    atob(standard);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely decode base64url to string
 * Returns undefined if decoding fails
 */
function safeBase64UrlDecode(str: string): string | undefined {
  if (!str) return undefined;
  try {
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
    const standard = padded.replace(/-/g, '+').replace(/_/g, '/');
    return atob(standard);
  } catch {
    return undefined;
  }
}

/**
 * Check if JWT header looks valid (contains credible JWT metadata)
 * Accepts: alg alone, typ: "JWT" alone (if header looks credible), or both
 * Rejects: malformed JSON, non-objects, clearly incompatible typ values
 * Does not throw - returns false on any error
 */
function isValidJwtHeader(header: string | undefined): boolean {
  if (!header) return false;
  const decoded = safeBase64UrlDecode(header);
  if (!decoded) return false;
  try {
    const parsed = JSON.parse(decoded);
    if (typeof parsed !== 'object' || parsed === null) return false;

    const hasAlg = typeof parsed.alg === 'string' && parsed.alg.length > 0;
    const hasTyp = typeof parsed.typ === 'string' && parsed.typ.length > 0;
    const typIsJwt = hasTyp && parsed.typ.toUpperCase() === 'JWT';
    const typIsIncompatible = hasTyp && parsed.typ.toUpperCase() !== 'JWT';

    // If typ is explicitly NOT JWT, reject
    if (typIsIncompatible) return false;

    // Accept if: has alg, OR has typ: "JWT", OR both
    // This allows credible JWT headers even with only one indicator
    return hasAlg || typIsJwt;
  } catch {
    return false;
  }
}

/**
 * Check if a string looks like a false positive (version, domain, etc.)
 */
function isLikelyFalsePositive(token: string): boolean {
  // Check for semantic version pattern (e.g., 1.2.3, 10.20.30)
  if (/^\d+\.\d+\.\d+$/.test(token)) return true;

  // Check for common domain-like patterns (e.g., example.com, sub.domain.org)
  if (
    /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(token) &&
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  ) {
    return true;
  }

  // Check for file-like patterns with extensions
  if (
    /\.[a-zA-Z]{2,4}$/.test(token) &&
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  ) {
    return true;
  }

  // Check if it's just three short parts (not JWT-like)
  const parts = token.split('.');
  if (parts.length === 3 && parts.every((p) => p.length < 10)) return true;

  return false;
}

/**
 * Create strict JWT detector
 */
function createJwtDetectorImpl(): new () => BaseDetector {
  const detectorName = 'jwt-detector';

  class JwtDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['jwt'] as const;
    public readonly confidence = 0.9 as DetectionConfidence;
    public override readonly priority: number = 90;
    public override readonly aliasPrefix: string = 'JWT';
    public override readonly contextKeywords: ReadonlyArray<string> = [
      'jwt',
      'token',
      'bearer',
      'authorization',
      'eyj',
    ];

    override detect(text: string, options: DetectionOptions = {}): ReadonlyArray<DetectionResult> {
      const results: DetectionResult[] = [];
      const contextWindow = options?.contextWindow ?? 50;

      for (const match of text.matchAll(JWT_PATTERN)) {
        if (match.index === undefined) continue;

        const header = match[1];
        const payload = match[2];
        const signature = match[3];
        const token = match[0];
        const start = match.index;
        const end = start + token.length;

        // Validate all three segments are present and non-empty
        if (!header || !payload || !signature) continue;

        // Validate header, payload, and signature are valid base64url
        if (
          !isValidBase64Url(header) ||
          !isValidBase64Url(payload) ||
          !isValidBase64Url(signature)
        ) {
          continue;
        }

        // Validate header structure (alg and typ fields)
        if (!isValidJwtHeader(header)) {
          continue;
        }

        // Reject common false positives
        if (isLikelyFalsePositive(token)) continue;

        // Check for duplicates (handle overlapping matches)
        if (results.some((r) => r.range.start === start && r.range.end === end)) continue;

        results.push(
          this.createDetection(text, start, end, 'jwt', this.confidence, {
            contextWindow,
            reason: 'Valid JWT with alg and typ in header',
          })
        );
      }

      return results;
    }
  }

  return JwtDetector;
}

/**
 * Create permissive JWT detector for edge cases (not enabled by default)
 */
function createPermissiveJwtDetectorImpl(): new () => BaseDetector {
  const detectorName = 'jwt-permissive-detector';

  class PermissiveJwtDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['jwt'] as const;
    public readonly confidence = 0.6 as DetectionConfidence;
    public override readonly enabled = false; // Disabled by default
    public override readonly priority: number = 60;
    public override readonly aliasPrefix: string = 'JWT';
    public override readonly contextKeywords: ReadonlyArray<string> = [
      'jwt',
      'token',
      'bearer',
      'authorization',
      'eyj',
    ];

    override detect(text: string, options: DetectionOptions = {}): ReadonlyArray<DetectionResult> {
      const results: DetectionResult[] = [];
      const contextWindow = options?.contextWindow ?? 50;

      // More permissive pattern - any three base64url-ish parts
      const permissivePattern =
        /\b([A-Za-z0-9_-]{10,})\.([A-Za-z0-9_-]{10,})\.([A-Za-z0-9_-]{10,})\b/g;

      for (const match of text.matchAll(permissivePattern)) {
        if (match.index === undefined) continue;

        const header = match[1];
        const payload = match[2];
        if (!header || !payload) continue;
        const token = match[0];
        const start = match.index;
        const end = start + token.length;

        // Validate header and payload are base64url-ish
        if (!/^[A-Za-z0-9_-]+$/.test(header) || !/^[A-Za-z0-9_-]+$/.test(payload)) {
          continue;
        }

        // Try to validate header structure if possible
        const headerValid = isValidJwtHeader(header);

        // Look for JWT context nearby if header is not valid
        if (!headerValid) {
          const context = text.slice(Math.max(0, start - 50), end + 50).toLowerCase();
          if (!/(jwt|token|bearer|authorization|eyj)/i.test(context)) {
            continue;
          }
        }

        // Reject common false positives
        if (isLikelyFalsePositive(token)) continue;

        if (results.some((r) => r.range.start === start && r.range.end === end)) continue;

        results.push(
          this.createDetection(text, start, end, 'jwt', this.confidence, {
            contextWindow,
            reason: headerValid ? 'JWT with valid header' : 'JWT-like token with context',
          })
        );
      }

      return results;
    }
  }

  return PermissiveJwtDetector;
}

export function createJwtDetector(): BaseDetector {
  return new (createJwtDetectorImpl())();
}

export function createPermissiveJwtDetector(): BaseDetector {
  return new (createPermissiveJwtDetectorImpl())();
}

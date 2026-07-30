/**
 * JWT (JSON Web Token) Detector
 *
 * Detects standard three-section JWTs with high confidence.
 * Validates basic structure (header.payload.signature) to reduce false positives.
 */

import { BaseDetector } from './baseDetector.js';
import type { DetectionConfidence, DetectionOptions, DetectionResult } from '../../types/core.js';

/**
 * JWT pattern - three base64url-encoded parts separated by dots
 * Header and payload must be valid base64url
 * Signature can be any base64url string
 */
const JWT_PATTERN = /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g;

/**
 * More permissive JWT pattern for edge cases
 */
const JWT_PERMISSIVE_PATTERN = /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

/**
 * Check if a string is valid base64url
 */
function isValidBase64Url(str: string): boolean {
  // Base64url uses A-Z, a-z, 0-9, -, _
  // Padding with = is not used in JWT
  if (!/^[A-Za-z0-9_-]+$/.test(str)) {
    return false;
  }
  // Length should be multiple of 4 when padded
  try {
    // Add padding if needed and decode
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
    // Try to parse as base64 (using standard base64, replacing url chars)
    const standard = padded.replace(/-/g, '+').replace(/_/g, '/');
    atob(standard);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if JWT header looks valid (contains "alg" and "typ")
 */
function isValidJwtHeader(header: string | undefined): boolean {
  if (!header) return false;
  try {
    const padded = header + '='.repeat((4 - (header.length % 4)) % 4);
    const standard = padded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(standard);
    const parsed = JSON.parse(decoded);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.alg === 'string' &&
      typeof parsed.typ === 'string' &&
      parsed.typ.toUpperCase() === 'JWT'
    );
  } catch {
    return false;
  }
}

/**
 * Create JWT detector
 */
function createJwtDetectorImpl(): { new (): BaseDetector } {
  const detectorName = 'jwt-detector';

  class JwtDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['jwt'] as const;
    public readonly confidence = 0.9 as DetectionConfidence;

    override detect(text: string, options: DetectionOptions = {}): ReadonlyArray<DetectionResult> {
      const results: DetectionResult[] = [];

      const contextWindow = options?.contextWindow ?? 50;

      // Use the strict JWT pattern first
      for (const match of text.matchAll(JWT_PATTERN)) {
        if (match.index === undefined) continue;

        const token = match[0];
        const parts = token.split('.');

        if (parts.length !== 3) continue;

        const header = parts[0];
        const payload = parts[1];
        if (header === undefined || payload === undefined) continue;

        // Validate header and payload are valid base64url
        if (!isValidBase64Url(header) || !isValidBase64Url(payload)) {
          continue;
        }

        // Additional validation: check header structure
        if (!isValidJwtHeader(header)) {
          continue;
        }

        // Valid JWT found
        results.push(
          this.createDetection(
            text,
            match.index,
            match.index + token.length,
            'jwt',
            this.confidence,
            { contextWindow }
          )
        );
      }

      return results;
    }
  }

  return JwtDetector;
}

/**
 * Create permissive JWT detector for edge cases
 */
function createPermissiveJwtDetectorImpl(): { new (): BaseDetector } {
  const detectorName = 'jwt-permissive-detector';

  class PermissiveJwtDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['jwt'] as const;
    public readonly confidence = 0.6 as DetectionConfidence;
    override readonly enabled = false; // Disabled by default, enable for comprehensive scans

    override detect(text: string, options: DetectionOptions = {}): ReadonlyArray<DetectionResult> {
      const results: DetectionResult[] = [];

      const contextWindow = options?.contextWindow ?? 50;

      for (const match of text.matchAll(JWT_PERMISSIVE_PATTERN)) {
        if (match.index === undefined) continue;

        const token = match[0];
        const parts = token.split('.');

        if (parts.length !== 3) continue;

        // Basic validation: each part should be reasonable length
        const header = parts[0];
        const payload = parts[1];
        const signature = parts[2];
        if (header === undefined || payload === undefined || signature === undefined) continue;
        if (header.length < 10 || payload.length < 10 || signature.length < 10) {
          continue;
        }

        // Check if parts are base64url-ish
        if (!/^[A-Za-z0-9_-]+$/.test(header) || !/^[A-Za-z0-9_-]+$/.test(payload)) {
          continue;
        }

        // Look for JWT context nearby
        const context = text.slice(Math.max(0, match.index - 50), match.index + token.length + 50);
        if (!/(jwt|token|bearer|authorization|eyJ)/i.test(context)) {
          continue;
        }

        results.push(
          this.createDetection(
            text,
            match.index,
            match.index + token.length,
            'jwt',
            this.confidence,
            { contextWindow }
          )
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

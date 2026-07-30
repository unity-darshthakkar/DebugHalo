/**
 * Email Detector
 *
 * Detects email addresses with high confidence.
 * Avoids matching malformed or clearly fake addresses.
 */

import { BaseDetector } from './baseDetector.js';
import type { DetectionConfidence, DetectionOptions, DetectionResult } from '../../types/core.js';

/**
 * Email regex - RFC 5322 compliant (simplified for practical use)
 * Matches standard email formats while avoiding false positives
 */
const EMAIL_PATTERN =
  /\b[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+\b/g;

/**
 * Exclude common false positives
 * Only exclude if BOTH local-part AND domain look fake/test
 */
const EMAIL_EXCLUSIONS = [
  /^noreply@/i,
  /^no-reply@/i,
  /^donotreply@/i,
  /^do-not-reply@/i,
  /^test@(example\.(com|org|net)|localhost|invalid|fake|dummy)$/i,
  /^example@(example\.(com|org|net)|localhost|invalid|fake|dummy)$/i,
  /^admin@(localhost|invalid|fake|dummy)$/i,
];

function createEmailDetectorImpl(): new () => BaseDetector {
  const detectorName = 'email-detector';

  class EmailDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['email'] as const;
    public readonly confidence = 0.85 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      for (const match of text.matchAll(EMAIL_PATTERN)) {
        if (match.index === undefined) continue;

        const email = match[0].toLowerCase();
        const start = match.index;
        const end = start + email.length;

        // Check exclusions
        if (this.isExcluded(email)) continue;

        // Basic validation
        if (!this.isValidEmail(email)) continue;

        results.push(
          this.createDetection(text, start, end, 'email', this.confidence, {
            contextWindow,
          })
        );
      }

      return results;
    }

    private isExcluded(email: string): boolean {
      return EMAIL_EXCLUSIONS.some((pattern) => pattern.test(email));
    }

    private isValidEmail(email: string): boolean {
      // Must have @ and at least one dot after @
      const atIndex = email.indexOf('@');
      if (atIndex <= 0) return false;

      const domain = email.slice(atIndex + 1);
      if (!domain.includes('.')) return false;

      // Domain parts must be valid
      const parts = domain.split('.');
      if (parts.some((p) => p.length === 0 || p.length > 63)) return false;

      // TLD should be 2+ chars
      const tld = parts[parts.length - 1] ?? '';
      if (tld.length < 2) return false;

      // No consecutive dots
      if (email.includes('..')) return false;

      // Not starting/ending with special chars
      if (/^[.!#$%&'*+/=?^_`{|}~-]/.test(email)) return false;
      if (/[.!#$%&'*+/=?^_`{|}~-]$/.test(email)) return false;

      return true;
    }
  }

  return EmailDetector;
}

export function createEmailDetector(): BaseDetector {
  return new (createEmailDetectorImpl())();
}

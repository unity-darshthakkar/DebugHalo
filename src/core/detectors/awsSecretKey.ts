/**
 * AWS Secret Access Key Detector
 *
 * Detects AWS Secret Access Keys with high confidence.
 * These are 40-character base64-like strings containing + and / characters.
 */

import { BaseDetector } from './baseDetector.js';
import type { DetectionConfidence, DetectionOptions, DetectionResult } from '../../types/core.js';

/**
 * AWS Secret Access Key pattern
 * 40 characters, base64-like with + and /
 */
const AWS_SECRET_KEY_PATTERN = /\b(?=.*[/+])[A-Za-z0-9/+=]{40}\b/g;

/**
 * AWS Secret Key in context patterns
 * Matches secret_access_key, aws_secret_access_key, aws_secret_key assignments
 * Capture group index varies: patterns with quote wrapper have 2 groups, without have 1
 * Note: don't use \b at start because env vars like AWS_SECRET_ACCESS_KEY have underscore before "secret"
 */
const AWS_SECRET_CONTEXT_PATTERNS = [
  // Environment variable assignments - group 2 has secret
  /(?:^|[^a-zA-Z0-9_])secret[_-]?access[_-]?key\s*[=:]\s*(["']?)([A-Za-z0-9/+=]{40})\1/gi,
  /(?:^|[^a-zA-Z0-9_])aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*(["']?)([A-Za-z0-9/+=]{40})\1/gi,
  /(?:^|[^a-zA-Z0-9_])aws[_-]?secret[_-]?key\s*[=:]\s*(["']?)([A-Za-z0-9/+=]{40})\1/gi,
  // JSON/YAML style - group 1 has secret (no quote wrapper group)
  /["']?secret[_-]?access[_-]?key["']?\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
  /["']?aws[_-]?secret[_-]?access[_-]?key["']?\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
];

function createAwsSecretKeyDetectorImpl(): new () => BaseDetector {
  const detectorName = 'aws-secret-key-detector';

  class AwsSecretKeyDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['aws_secret_key'] as const;
    public readonly confidence = 0.95 as DetectionConfidence;
    public override readonly priority: number = 95;
    public override readonly aliasPrefix: string = 'AWS_SECRET';
    public override readonly contextKeywords: ReadonlyArray<string> = [
      'aws',
      'amazon',
      'secret',
      'access',
      'credential',
      'key',
    ];

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];
      const contextWindow = options.contextWindow ?? 50;

      // Check context-aware patterns first (higher confidence)
      for (const pattern of AWS_SECRET_CONTEXT_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          // Handle variable capture group index: env patterns have group 2, JSON/YAML have group 1
          const secretGroup = match[2] !== undefined ? 2 : 1;
          const value = match[secretGroup];
          if (!value) continue;
          // Enforce exactly 40 chars and required +/ chars
          if (value.length !== 40) continue;
          if (!/[+/]/.test(value)) continue;
          if (!this.hasSufficientEntropy(value)) continue;

          const start = match.index + match[0].indexOf(value);
          const end = start + value.length;

          // Avoid duplicates
          if (this.isOverlapping(results, start, end)) continue;

          results.push(
            this.createDetection(text, start, end, 'aws_secret_key', this.confidence, {
              contextWindow,
              reason: 'AWS secret access key in credential context',
            })
          );
        }
      }

      // Check general pattern with entropy and context validation
      for (const match of text.matchAll(AWS_SECRET_KEY_PATTERN)) {
        if (match.index === undefined) continue;

        const value = match[0];

        // Must have both + and / chars (strong indicator of AWS secret)
        if (!/[+/]/.test(value)) continue;

        const start = match.index;
        const end = start + value.length;

        // Avoid duplicates
        if (this.isOverlapping(results, start, end)) continue;

        // Check for AWS context nearby
        if (!this.hasContextKeywords(text, start)) continue;

        // Verify entropy
        if (!this.hasSufficientEntropy(value)) continue;

        results.push(
          this.createDetection(text, start, end, 'aws_secret_key', this.confidence, {
            contextWindow,
            reason: 'AWS secret access key with AWS context and entropy',
          })
        );
      }

      return results;
    }
  }

  return AwsSecretKeyDetector;
}

export function createAwsSecretKeyDetector(): BaseDetector {
  return new (createAwsSecretKeyDetectorImpl())();
}

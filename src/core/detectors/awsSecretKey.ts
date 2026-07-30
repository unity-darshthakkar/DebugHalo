/**
 * AWS Secret Key Detector
 *
 * Detects AWS Secret Access Keys with high confidence.
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
 * Capture group 2 contains the full 40-character secret
 * Note: don't use \b at start because env vars like AWS_SECRET_ACCESS_KEY have underscore before "secret"
 */
const AWS_SECRET_CONTEXT_PATTERNS = [
  /(?:^|[^a-zA-Z0-9_])secret[_-]?access[_-]?key\s*[=:]\s*(["']?)([A-Za-z0-9/+=]{40})\1/gi,
  /(?:^|[^a-zA-Z0-9_])aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*(["']?)([A-Za-z0-9/+=]{40})\1/gi,
  /(?:^|[^a-zA-Z0-9_])aws[_-]?secret[_-]?key\s*[=:]\s*(["']?)([A-Za-z0-9/+=]{40})\1/gi,
];

function createAwsSecretKeyDetectorImpl(): new () => BaseDetector {
  const detectorName = 'aws-secret-key-detector';

  class AwsSecretKeyDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['aws_secret_key'] as const;
    public readonly confidence = 0.95 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      // Check context-aware patterns first (higher confidence)
      for (const pattern of AWS_SECRET_CONTEXT_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const value = match[2];
          if (!value) continue;
          const start = match.index + match[0].indexOf(value);
          const end = start + value.length;

          results.push(
            this.createDetection(text, start, end, 'aws_secret_key', this.confidence, {
              contextWindow,
            })
          );
        }
      }

      // Check general pattern with entropy validation
      for (const match of text.matchAll(AWS_SECRET_KEY_PATTERN)) {
        if (match.index === undefined) continue;

        const value = match[0];

        // Must have both + and / chars (strong indicator of AWS secret)
        if (!/[+/]/.test(value)) continue;

        // Check for AWS context nearby
        const context = text.slice(Math.max(0, match.index - 100), match.index + 100);
        if (!/(aws|amazon|access|secret|credential)/i.test(context)) continue;

        // Verify it's not already detected
        const start = match.index;
        const end = start + value.length;
        if (results.some((r) => r.range.start === start && r.range.end === end)) continue;

        results.push(
          this.createDetection(text, start, end, 'aws_secret_key', this.confidence, {
            contextWindow,
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

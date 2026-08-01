/**
 * AWS Access Key ID Detector
 *
 * Detects AWS Access Key IDs (AKIA*, ASIA*) with high confidence.
 * These are 20-character identifiers starting with AKIA or ASIA.
 */

import { BaseDetector } from './baseDetector.js';
import type { DetectionConfidence, DetectionOptions, DetectionResult } from '../../types/core.js';

/**
 * AWS Access Key ID pattern
 * Format: AKIA[0-9A-Z]{16} or ASIA[0-9A-Z]{16}
 * AKIA = long-term credentials, ASIA = temporary session credentials
 */
const AWS_ACCESS_KEY_PATTERN = /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g;

/**
 * Context patterns for AWS access keys in environment/config files
 * Capture group 2 contains the access key ID
 * Key prefix (AKIA/ASIA) must be uppercase - remove 'i' flag to make case-sensitive
 * Field names matched case-insensitively via explicit character classes
 */
const AWS_ACCESS_KEY_CONTEXT_PATTERNS = [
  // Environment variable assignments - field names case-insensitive, key prefix case-sensitive
  /(?:^|[^a-zA-Z0-9_])[aA][wW][sS][_-]?[aA][cC][cC][eE][sS][sS][_-]?[kK][eE][yY][_-]?[iI][dD]\s*[=:]\s*(["']?)((?:AKIA|ASIA)[0-9A-Z]{16})\1/g,
  /(?:^|[^a-zA-Z0-9_])[aA][wW][sS][_-]?[aA][cC][cC][eE][sS][sS][_-]?[kK][eE][yY]\s*[=:]\s*(["']?)((?:AKIA|ASIA)[0-9A-Z]{16})\1/g,
  /(?:^|[^a-zA-Z0-9_])[aA][wW][sS][_-]?[kK][eE][yY][_-]?[iI][dD]\s*[=:]\s*(["']?)((?:AKIA|ASIA)[0-9A-Z]{16})\1/g,
  /(?:^|[^a-zA-Z0-9_])[aA][cC][cC][eE][sS][sS][_-]?[kK][eE][yY][_-]?[iI][dD]\s*[=:]\s*(["']?)((?:AKIA|ASIA)[0-9A-Z]{16})\1/g,
  // JSON/YAML style
  /["']?[aA][wW][sS][_-]?[aA][cC][cC][eE][sS][sS][_-]?[kK][eE][yY][_-]?[iI][dD]["']?\s*[:=]\s*["']?((?:AKIA|ASIA)[0-9A-Z]{16})["']?/g,
  /["']?[aA][cC][cC][eE][sS][sS][_-]?[kK][eE][yY][_-]?[iI][dD]["']?\s*[:=]\s*["']?((?:AKIA|ASIA)[0-9A-Z]{16})["']?/g,
];

function createAwsAccessKeyDetectorImpl(): new () => BaseDetector {
  const detectorName = 'aws-access-key-detector';

  class AwsAccessKeyDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['aws_access_key'] as const;
    public readonly confidence = 0.98 as DetectionConfidence;
    public override readonly priority: number = 95;
    public override readonly aliasPrefix: string = 'AWS_ACCESS_KEY';
    public override readonly contextKeywords: ReadonlyArray<string> = [
      'aws',
      'amazon',
      'access',
      'key',
      'credential',
      'iam',
    ];

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];
      const contextWindow = options.contextWindow ?? 50;

      // Check context-aware patterns first (highest confidence)
      for (const pattern of AWS_ACCESS_KEY_CONTEXT_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const value = match[2];
          if (!value) continue;
          // Enforce exact 20-char length
          if (value.length !== 20) continue;

          const start = match.index + match[0].indexOf(value);
          const end = start + value.length;

          // Avoid duplicates
          if (this.isOverlapping(results, start, end)) continue;

          results.push(
            this.createDetection(text, start, end, 'aws_access_key', this.confidence, {
              contextWindow,
              reason: 'AWS access key ID in credential context',
            })
          );
        }
      }

      // Check general pattern with context validation
      for (const match of text.matchAll(AWS_ACCESS_KEY_PATTERN)) {
        if (match.index === undefined) continue;

        const value = match[0];
        const start = match.index;
        const end = start + value.length;

        // Avoid duplicates
        if (this.isOverlapping(results, start, end)) continue;

        // Verify context - must have AWS-related keywords nearby
        if (!this.hasContextKeywords(text, start)) continue;

        results.push(
          this.createDetection(text, start, end, 'aws_access_key', this.confidence, {
            contextWindow,
            reason: 'AWS access key ID with AWS context',
          })
        );
      }

      return results;
    }
  }

  return AwsAccessKeyDetector;
}

export function createAwsAccessKeyDetector(): BaseDetector {
  return new (createAwsAccessKeyDetectorImpl())();
}

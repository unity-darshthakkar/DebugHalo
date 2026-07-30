/**
 * Private Key Detector
 *
 * Detects PEM-style private key blocks including RSA, EC, DSA, OpenSSH, and PGP keys.
 */

import { BaseDetector } from './baseDetector.js';
import type {
  DetectionCategory,
  DetectionConfidence,
  DetectionOptions,
  DetectionResult,
} from '../../types/core.js';

const PRIVATE_KEY_PATTERNS: Array<{
  category: DetectionCategory;
  pattern: RegExp;
  confidence: DetectionConfidence;
}> = [
  {
    category: 'private_key',
    pattern: /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'private_key',
    pattern: /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'private_key',
    pattern: /-----BEGIN EC PRIVATE KEY-----[\s\S]*?-----END EC PRIVATE KEY-----/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'private_key',
    pattern: /-----BEGIN DSA PRIVATE KEY-----[\s\S]*?-----END DSA PRIVATE KEY-----/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'ssh_private_key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'pgp_private_key',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'private_key',
    pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----[\s\S]*?-----END ENCRYPTED PRIVATE KEY-----/g,
    confidence: 0.95 as DetectionConfidence,
  },
];

function createPrivateKeyDetectorImpl(): new () => BaseDetector {
  const detectorName = 'private-key-detector';

  class PrivateKeyDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['private_key', 'ssh_private_key', 'pgp_private_key'] as const;
    public readonly confidence = 0.98 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      for (const { category, pattern, confidence } of PRIVATE_KEY_PATTERNS) {
        pattern.lastIndex = 0;

        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          results.push(
            this.createDetection(
              text,
              match.index,
              match.index + match[0].length,
              category,
              confidence,
              { contextWindow }
            )
          );
        }
      }

      return results;
    }
  }

  return PrivateKeyDetector;
}

export function createPrivateKeyDetector(): BaseDetector {
  return new (createPrivateKeyDetectorImpl())();
}

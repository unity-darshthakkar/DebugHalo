/**
 * Private Key Detector
 *
 * Detects complete PEM-style private key blocks.
 * Matches from BEGIN marker through corresponding END marker.
 * Excludes public keys, certificates, certificate requests, and incomplete blocks.
 */

import { BaseDetector } from './baseDetector.js';
import type {
  DetectionCategory,
  DetectionConfidence,
  DetectionOptions,
  DetectionResult,
} from '../../types/core.js';

// Build a pattern that matches complete PEM blocks with proper END markers
function buildPrivateKeyPattern(beginMarker: string, endMarker: string): RegExp {
  // Escape all regex metacharacters in the markers
  function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  const begin = escapeRegExp(beginMarker);
  const end = escapeRegExp(endMarker);
  // Match from BEGIN through END, including all content in between
  // Using [\s\S] to match any character including newlines (cross-platform)
  return new RegExp(`${begin}[\\s\\S]*?${end}`, 'g');
}

const PRIVATE_KEY_PATTERNS: Array<{
  category: DetectionCategory;
  pattern: RegExp;
  confidence: DetectionConfidence;
}> = [
  // PKCS#8 private key (generic)
  {
    category: 'private_key',
    pattern: buildPrivateKeyPattern('-----BEGIN PRIVATE KEY-----', '-----END PRIVATE KEY-----'),
    confidence: 0.99 as DetectionConfidence,
  },
  // PKCS#1 RSA private key
  {
    category: 'private_key',
    pattern: buildPrivateKeyPattern(
      '-----BEGIN RSA PRIVATE KEY-----',
      '-----END RSA PRIVATE KEY-----'
    ),
    confidence: 0.99 as DetectionConfidence,
  },
  // PKCS#1 EC private key
  {
    category: 'private_key',
    pattern: buildPrivateKeyPattern(
      '-----BEGIN EC PRIVATE KEY-----',
      '-----END EC PRIVATE KEY-----'
    ),
    confidence: 0.99 as DetectionConfidence,
  },
  // PKCS#1 DSA private key
  {
    category: 'private_key',
    pattern: buildPrivateKeyPattern(
      '-----BEGIN DSA PRIVATE KEY-----',
      '-----END DSA PRIVATE KEY-----'
    ),
    confidence: 0.99 as DetectionConfidence,
  },
  // OpenSSH private key (v1 format)
  {
    category: 'ssh_private_key',
    pattern: buildPrivateKeyPattern(
      '-----BEGIN OPENSSH PRIVATE KEY-----',
      '-----END OPENSSH PRIVATE KEY-----'
    ),
    confidence: 0.99 as DetectionConfidence,
  },
  // PGP private key block
  {
    category: 'pgp_private_key',
    pattern: buildPrivateKeyPattern(
      '-----BEGIN PGP PRIVATE KEY BLOCK-----',
      '-----END PGP PRIVATE KEY BLOCK-----'
    ),
    confidence: 0.99 as DetectionConfidence,
  },
  // Encrypted private key (PKCS#8)
  {
    category: 'private_key',
    pattern: buildPrivateKeyPattern(
      '-----BEGIN ENCRYPTED PRIVATE KEY-----',
      '-----END ENCRYPTED PRIVATE KEY-----'
    ),
    confidence: 0.95 as DetectionConfidence,
  },
];

function createPrivateKeyDetectorImpl(): new () => BaseDetector {
  const detectorName = 'private-key-detector';

  class PrivateKeyDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['private_key', 'ssh_private_key', 'pgp_private_key'] as const;
    public readonly confidence = 0.98 as DetectionConfidence;
    public override readonly priority: number = 100;
    public override readonly aliasPrefix: string = 'PRIVATE_KEY';
    public override readonly contextKeywords: ReadonlyArray<string> = [
      'private',
      'key',
      'pem',
      'openssh',
      'pgp',
      'rsa',
      'ec',
      'dsa',
    ];

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];
      const contextWindow = options.contextWindow ?? 50;

      for (const { category, pattern, confidence } of PRIVATE_KEY_PATTERNS) {
        pattern.lastIndex = 0;

        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const fullMatch = match[0];
          const start = match.index;
          const end = start + fullMatch.length;

          // Check for duplicates
          if (results.some((r) => r.range.start === start && r.range.end === end)) continue;

          results.push(
            this.createDetection(text, start, end, category, confidence, {
              contextWindow,
              reason: `${category.replace('_', ' ')} PEM block`,
            })
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

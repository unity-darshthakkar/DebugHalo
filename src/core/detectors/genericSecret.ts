/**
 * Generic Secret Detector
 *
 * Detects generic secret-like patterns with lower confidence.
 * Used as a catch-all for unknown secret formats.
 */

import { BaseDetector } from './baseDetector.js';
import type { DetectionConfidence, DetectionOptions, DetectionResult } from '../../types/core.js';

/**
 * Generic secret patterns
 */
const GENERIC_SECRET_PATTERNS: Array<{
  pattern: RegExp;
  minLength: number;
  confidence: DetectionConfidence;
  contextKeywords: string[];
}> = [
  {
    pattern: /\b[a-zA-Z0-9+/=]{32,}\b/g,
    minLength: 32,
    confidence: 0.5 as DetectionConfidence,
    contextKeywords: ['secret', 'key', 'token', 'password', 'credential', 'auth'],
  },
  {
    pattern: /\b[0-9a-f]{32,}\b/gi,
    minLength: 32,
    confidence: 0.4 as DetectionConfidence,
    contextKeywords: ['secret', 'key', 'token', 'hash', 'digest', 'fingerprint'],
  },
];

function createGenericSecretDetectorImpl(): new () => BaseDetector {
  const detectorName = 'generic-secret-detector';

  class GenericSecretDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['generic_secret'] as const;
    public readonly confidence = 0.5 as DetectionConfidence;
    public override readonly enabled = false; // Disabled by default to reduce false positives

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      for (const { pattern, minLength, confidence, contextKeywords } of GENERIC_SECRET_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const value = match[0];
          if (value.length < minLength) continue;

          // Must have key context nearby
          const before = text.slice(Math.max(0, match.index - 100), match.index);
          const after = text.slice(match.index + value.length, match.index + value.length + 100);
          const context = (before + after).toLowerCase();

          if (!contextKeywords.some((kw) => context.includes(kw))) continue;

          // Must have entropy
          if (!this.hasEntropy(value)) continue;

          // Not already detected by higher confidence detectors
          const start = match.index;
          const end = start + value.length;
          if (results.some((r) => r.range.start === start && r.range.end === end)) continue;

          results.push(
            this.createDetection(text, start, end, 'generic_secret', confidence, {
              contextWindow,
            })
          );
        }
      }

      return results;
    }

    private hasEntropy(str: string): boolean {
      // Count character types
      const hasLower = /[a-z]/.test(str);
      const hasUpper = /[A-Z]/.test(str);
      const hasDigit = /[0-9]/.test(str);
      const hasSpecial = /[^a-zA-Z0-9]/.test(str);
      const types = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

      // Must have at least 2 types
      if (types < 2) return false;

      // Shannon entropy check (simplified)
      const freq = new Map<string, number>();
      for (const char of str) {
        freq.set(char, (freq.get(char) || 0) + 1);
      }
      let entropy = 0;
      const len = str.length;
      for (const count of freq.values()) {
        const p = count / len;
        entropy -= p * Math.log2(p);
      }
      // Normalized entropy should be > 0.5
      return entropy / Math.log2(freq.size) > 0.5;
    }
  }

  return GenericSecretDetector;
}

export function createGenericSecretDetector(): BaseDetector {
  return new (createGenericSecretDetectorImpl())();
}

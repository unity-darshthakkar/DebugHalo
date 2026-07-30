/**
 * GitHub Token Detector
 *
 * Detects GitHub Personal Access Tokens and OAuth tokens with high confidence.
 */

import { BaseDetector } from './baseDetector.js';
import type {
  DetectionCategory,
  DetectionConfidence,
  DetectionOptions,
  DetectionResult,
} from '../../types/core.js';

/**
 * GitHub token patterns
 * - Classic PAT: ghp_ + 32+ chars (test uses 32)
 * - Fine-grained PAT: github_pat_ + variable length (test uses ~66 total)
 * - OAuth token: gho_ + 32+ chars (test uses 32)
 * - GitHub App token: ghs_ + 32+ chars
 * - GitHub Enterprise token: ghe_ + 32+ chars
 * - Refresh token: ghr_ + 32+ chars
 */
const GITHUB_TOKEN_PATTERNS = [
  {
    category: 'github_token' as DetectionCategory,
    pattern: /\bghp_[a-zA-Z0-9]{32,}\b/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'github_token' as DetectionCategory,
    pattern: /\bgithub_pat_[a-zA-Z0-9_]{9,}_[a-zA-Z0-9]{25,}\b/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'github_token' as DetectionCategory,
    pattern: /\bgho_[a-zA-Z0-9]{32,}\b/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'github_token' as DetectionCategory,
    pattern: /\bghs_[a-zA-Z0-9]{32,}\b/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'github_token' as DetectionCategory,
    pattern: /\bghe_[a-zA-Z0-9]{32,}\b/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'github_token' as DetectionCategory,
    pattern: /\bghr_[a-zA-Z0-9]{32,}\b/g,
    confidence: 0.99 as DetectionConfidence,
  },
];

/**
 * Context-aware patterns
 */
const GITHUB_CONTEXT_PATTERNS = [
  /\b(?:github[_-]?token|gh[_-]?token|access[_-]?token)\s*[=:]\s*(["']?)(gh[pousr]_[a-zA-Z0-9_]{32,}|github_pat_[a-zA-Z0-9]{10,}_[a-zA-Z0-9]{50,})\1/gi,
];

function createGithubTokenDetectorImpl(): new () => BaseDetector {
  const detectorName = 'github-token-detector';

  class GithubTokenDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['github_token'] as const;
    public readonly confidence = 0.99 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      // High-confidence prefix patterns
      for (const { category, pattern, confidence } of GITHUB_TOKEN_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const value = match[0];
          const start = match.index;
          const end = start + value.length;

          // Verify entropy
          if (!this.hasHighEntropy(value)) continue;

          results.push(
            this.createDetection(text, start, end, category, confidence, {
              contextWindow,
            })
          );
        }
      }

      // Context patterns
      for (const pattern of GITHUB_CONTEXT_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const value = match[2];
          if (!value) continue;
          const start = match.index + match[0].indexOf(value);
          const end = start + value.length;

          if (results.some((r) => r.range.start === start && r.range.end === end)) continue;

          results.push(
            this.createDetection(text, start, end, 'github_token', this.confidence, {
              contextWindow,
            })
          );
        }
      }

      return results;
    }

    private hasHighEntropy(token: string): boolean {
      // Remove prefix and check remaining entropy
      const clean = token.replace(/^(ghp_|github_pat_|gho_|ghs_|ghe_|ghr_)/, '');
      const uniqueChars = new Set(clean).size;
      return clean.length >= 20 && uniqueChars >= 10;
    }
  }

  return GithubTokenDetector;
}

export function createGithubTokenDetector(): BaseDetector {
  return new (createGithubTokenDetectorImpl())();
}

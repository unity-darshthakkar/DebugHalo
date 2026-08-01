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
 * - Fine-grained PAT: github_pat_ + variable length (test uses ~9 + _ + 58)
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
    prefix: 'ghp_',
  },
  {
    category: 'github_token' as DetectionCategory,
    pattern: /\bgithub_pat_[a-zA-Z0-9_]{8,}_[a-zA-Z0-9]{50,}\b/g,
    confidence: 0.99 as DetectionConfidence,
    prefix: 'github_pat_',
  },
  {
    category: 'github_token' as DetectionCategory,
    pattern: /\bgho_[a-zA-Z0-9]{32,}\b/g,
    confidence: 0.99 as DetectionConfidence,
    prefix: 'gho_',
  },
  {
    category: 'github_token' as DetectionCategory,
    pattern: /\bghs_[a-zA-Z0-9]{32,}\b/g,
    confidence: 0.99 as DetectionConfidence,
    prefix: 'ghs_',
  },
  {
    category: 'github_token' as DetectionCategory,
    pattern: /\bghe_[a-zA-Z0-9]{32,}\b/g,
    confidence: 0.99 as DetectionConfidence,
    prefix: 'ghe_',
  },
  {
    category: 'github_token' as DetectionCategory,
    pattern: /\bghr_[a-zA-Z0-9]{32,}\b/g,
    confidence: 0.99 as DetectionConfidence,
    prefix: 'ghr_',
  },
];

/**
 * Context-aware patterns
 */
const GITHUB_CONTEXT_PATTERNS = [
  /\b(?:github[_-]?token|gh[_-]?token|access[_-]?token)\s*[=:]\s*(["']?)(gh[pousr]_[a-zA-Z0-9_]{32,}|github_pat_[a-zA-Z0-9]{10,}_[a-zA-Z0-9]{50,})\1/gi,
  // JSON/YAML style
  /["']?github[_-]?token["']?\s*[:=]\s*["']?(gh[pousr]_[a-zA-Z0-9_]{32,}|github_pat_[a-zA-Z0-9]{10,}_[a-zA-Z0-9]{50,})["']?/gi,
];

function createGithubTokenDetectorImpl(): new () => BaseDetector {
  const detectorName = 'github-token-detector';

  class GithubTokenDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['github_token'] as const;
    public readonly confidence = 0.99 as DetectionConfidence;
    public override readonly priority: number = 85;
    public override readonly aliasPrefix: string = 'GITHUB_TOKEN';
    public override readonly contextKeywords: ReadonlyArray<string> = [
      'github',
      'gh',
      'token',
      'pat',
      'oauth',
      'access',
    ];

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];
      const contextWindow = options.contextWindow ?? 50;

      // High-confidence prefix patterns
      for (const { category, pattern, confidence, prefix } of GITHUB_TOKEN_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const value = match[0];
          const start = match.index;
          const end = start + value.length;

          // Avoid duplicates
          if (this.isOverlapping(results, start, end)) continue;

          // Verify entropy
          if (!this.hasHighEntropy(value)) continue;

          results.push(
            this.createDetection(text, start, end, category, confidence, {
              contextWindow,
              reason: `GitHub token with ${prefix} prefix and high entropy`,
            })
          );
        }
      }

      // Context patterns
      for (const pattern of GITHUB_CONTEXT_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          // Handle variable capture group index
          const tokenGroup = match[2] !== undefined ? 2 : 1;
          const value = match[tokenGroup];
          if (!value) continue;
          const start = match.index + match[0].indexOf(value);
          const end = start + value.length;

          // Avoid duplicates
          if (this.isOverlapping(results, start, end)) continue;

          // Also verify entropy for context patterns
          if (!this.hasHighEntropy(value)) continue;

          results.push(
            this.createDetection(text, start, end, 'github_token', this.confidence, {
              contextWindow,
              reason: 'GitHub token in credential context with high entropy',
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

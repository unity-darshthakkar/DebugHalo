/**
 * Database URL Detector
 *
 * Detects database connection strings with embedded credentials.
 * Supports PostgreSQL, MySQL, MongoDB, Redis, and generic formats.
 */

import { BaseDetector } from './baseDetector.js';
import type {
  DetectionCategory,
  DetectionConfidence,
  DetectionOptions,
  DetectionResult,
} from '../../types/core.js';

/**
 * Check if credentials look like placeholders
 */
function isPlaceholderCredentials(user: string, pass: string): boolean {
  const combined = `${user}:${pass}`.toLowerCase();
  // Only reject truly obvious placeholders - not "user:pass" which could be real (weak) credentials
  const placeholders = [
    'username:password',
    'your_user:your_password',
    '<username>:<password>',
    'example:example',
    'your-username:your-password',
    'replace-me:replace-me',
    'changeme:changeme',
    'test:test',
    'dummy:dummy',
    'placeholder:placeholder',
    'user:pass',
  ];
  return placeholders.some((p) => combined === p || combined.includes(p));
}

/**
 * Check if a URL value ends with trailing punctuation that shouldn't be part of URL
 */
function trimTrailingPunctuation(url: string): string {
  // Remove trailing punctuation that could be closing delimiters
  return url.replace(/[.,;:)\]}>"'`]+$/, '');
}

const DATABASE_URL_PATTERNS: Array<{
  category: DetectionCategory;
  pattern: RegExp;
  confidence: DetectionConfidence;
}> = [
  // PostgreSQL (covers both with and without database name in path, includes query strings and fragments)
  {
    category: 'postgres_url',
    pattern: /postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@[^/]+\/[^\s]*/gi,
    confidence: 0.95 as DetectionConfidence,
  },
  // MySQL (covers both with and without database name in path, includes query strings and fragments)
  {
    category: 'mysql_url',
    pattern: /mysql:\/\/[^\s:]+:[^\s@]+@[^/]+\/[^\s]*/gi,
    confidence: 0.95 as DetectionConfidence,
  },
  // MongoDB (covers both with and without database name in path, includes query strings and fragments)
  {
    category: 'mongodb_url',
    pattern: /mongodb(?:\+srv)?:\/\/[^\s:]+:[^\s@]+@[^/]+\/[^\s]*/gi,
    confidence: 0.95 as DetectionConfidence,
  },
  // Redis (with optional username, always needs password before @, includes query strings and fragments)
  {
    category: 'redis_url',
    pattern: /redis:\/\/(?:[^\s:]+:)?[^\s@]+@[^/]+\/?[^\s]*/gi,
    confidence: 0.9 as DetectionConfidence,
  },
  // Generic database URL with credentials (least specific) - avoid matching http/https
  {
    category: 'database_url',
    pattern:
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:]+:[^\s@]+@[^/]+\/?[^\s]*/gi,
    confidence: 0.7 as DetectionConfidence,
  },
  // DSN formats (Data Source Name)
  {
    category: 'database_url',
    pattern: /host=[^\s;]+ port=\d+ dbname=[^\s;]+ user=[^\s;]+ password=[^\s;]+/gi,
    confidence: 0.9 as DetectionConfidence,
  },
  {
    category: 'database_url',
    pattern: /Server=[^;]+;Database=[^;]+;User Id=[^;]+;Password=[^;]+/gi,
    confidence: 0.9 as DetectionConfidence,
  },
  // Environment variable style - DATABASE_URL=postgresql://...
  {
    category: 'database_url',
    pattern: /DATABASE_URL\s*[=:]\s*['"]?[a-z]+:\/\/[^\s'"<>]+/gi,
    confidence: 0.85 as DetectionConfidence,
  },
];

function createDatabaseUrlDetectorImpl(): new () => BaseDetector {
  const detectorName = 'database-url-detector';

  class DatabaseUrlDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = [
      'postgres_url',
      'mysql_url',
      'mongodb_url',
      'redis_url',
      'database_url',
    ] as const;
    public readonly confidence = 0.9 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      // First pass: specific patterns
      const specificPatterns = DATABASE_URL_PATTERNS.filter((p) => p.category !== 'database_url');

      for (const { category, pattern, confidence } of specificPatterns) {
        pattern.lastIndex = 0;

        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const rawMatch = match[0];

          // Trim trailing punctuation
          const trimmedMatch = trimTrailingPunctuation(rawMatch);
          if (trimmedMatch.length === 0) continue;

          // Extract credentials to check for placeholders
          const credMatch = trimmedMatch.match(/^[^:]+:\/\/([^:]+):([^@]+)@/);
          if (credMatch && credMatch[1] && credMatch[2]) {
            if (isPlaceholderCredentials(credMatch[1], credMatch[2])) continue;
          }

          const start = match.index;
          const end = start + trimmedMatch.length;
          if (results.some((r) => r.range.start === start && r.range.end === end)) {
            continue;
          }

          results.push(
            this.createDetection(text, start, end, category, confidence, {
              contextWindow,
            })
          );
        }
      }

      // Second pass: generic pattern - only for URLs not already matched
      const genericPatterns = DATABASE_URL_PATTERNS.filter((p) => p.category === 'database_url');

      for (const { category, pattern, confidence } of genericPatterns) {
        pattern.lastIndex = 0;

        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const rawMatch = match[0];

          // Trim trailing punctuation
          const trimmedMatch = trimTrailingPunctuation(rawMatch);
          if (trimmedMatch.length === 0) continue;

          // Skip http/https URLs
          if (/^https?:\/\//i.test(trimmedMatch)) continue;

          // Extract credentials to check for placeholders
          const credMatch = trimmedMatch.match(/^[^:]+:\/\/([^:]+):([^@]+)@/);
          if (credMatch && credMatch[1] && credMatch[2]) {
            if (isPlaceholderCredentials(credMatch[1], credMatch[2])) continue;
          }

          const start = match.index;
          const end = start + trimmedMatch.length;

          // Skip if any existing result overlaps this range (specific category wins)
          if (results.some((r) => r.range.start <= start && r.range.end >= end)) {
            continue;
          }

          results.push(
            this.createDetection(text, start, end, category, confidence, {
              contextWindow,
            })
          );
        }
      }

      return results;
    }
  }

  return DatabaseUrlDetector;
}

export function createDatabaseUrlDetector(): BaseDetector {
  return new (createDatabaseUrlDetectorImpl())();
}

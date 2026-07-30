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

const DATABASE_URL_PATTERNS: Array<{
  category: DetectionCategory;
  pattern: RegExp;
  confidence: DetectionConfidence;
}> = [
  // PostgreSQL (covers both with and without database name in path)
  {
    category: 'postgres_url',
    pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^/]+(?:\/[^\s?]+)?/gi,
    confidence: 0.95 as DetectionConfidence,
  },
  // MySQL (covers both with and without database name in path)
  {
    category: 'mysql_url',
    pattern: /mysql:\/\/[^:]+:[^@]+@[^/]+(?:\/[^\s?]+)?/gi,
    confidence: 0.95 as DetectionConfidence,
  },
  // MongoDB (covers both with and without database name in path)
  {
    category: 'mongodb_url',
    pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^/]+(?:\/[^\s?]+)?/gi,
    confidence: 0.95 as DetectionConfidence,
  },
  // Redis (no database name in URL path typically)
  {
    category: 'redis_url',
    pattern: /redis:\/\/(?:[^:]+:)?[^@]+@[^/]+\/?/gi,
    confidence: 0.9 as DetectionConfidence,
  },
  // Generic database URL with credentials (least specific)
  {
    category: 'database_url',
    pattern: /[a-z]+:\/\/[^:]+:[^@]+@[^/]+\/?[^\s]*/gi,
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
  // Environment variable style
  {
    category: 'database_url',
    pattern: /DATABASE_URL\s*[=:]\s*['"]?[a-z]+:\/\/[^'"\s]+/gi,
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

          const start = match.index;
          const end = start + match[0].length;
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

          const start = match.index;
          const end = start + match[0].length;
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

      return results;
    }
  }

  return DatabaseUrlDetector;
}

export function createDatabaseUrlDetector(): BaseDetector {
  return new (createDatabaseUrlDetectorImpl())();
}

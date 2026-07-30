/**
 * Password Detector
 *
 * Detects passwords in various formats including environment variables,
 * configuration files, and assignment patterns.
 */

import { BaseDetector } from './baseDetector.js';
import type {
  DetectionCategory,
  DetectionConfidence,
  DetectionOptions,
  DetectionResult,
} from '../../types/core.js';

const PASSWORD_PATTERNS: Array<{
  category: DetectionCategory;
  pattern: RegExp;
  confidence: DetectionConfidence;
  valueExtractor: (match: RegExpMatchArray) => string;
}> = [
  // Environment variable style: PASSWORD=value or PASSWORD="value"
  {
    category: 'password_env',
    pattern:
      /\b(?:PASSWORD|PASSWD|PWD|DB_PASSWORD|DATABASE_PASSWORD|SECRET)\s*[=:]\s*(["']?)([^"'\s\n\r]+)\1/g,
    confidence: 0.9 as DetectionConfidence,
    valueExtractor: (m) => m[2] ?? '',
  },
  // Config file style: password: value or password = value
  {
    category: 'password_config',
    pattern: /\bpassword\s*[:=]\s*(["']?)([^"'\s\n\r]+)\1/gi,
    confidence: 0.85 as DetectionConfidence,
    valueExtractor: (m) => m[2] ?? '',
  },
  // JSON style: "password": "value"
  {
    category: 'password_config',
    pattern: /"password"\s*:\s*"([^"]{4,})"/gi,
    confidence: 0.9 as DetectionConfidence,
    valueExtractor: (m) => m[1] ?? '',
  },
  // YAML style: password: "value" or password: value
  {
    category: 'password_config',
    pattern: /password:\s*(["']?)([^"'\n\r]+)\1/gi,
    confidence: 0.8 as DetectionConfidence,
    valueExtractor: (m) => m[2] ?? '',
  },
  // Connection string password
  {
    category: 'password_config',
    pattern: /[?&]password=([^&"\s]+)/gi,
    confidence: 0.85 as DetectionConfidence,
    valueExtractor: (m) => m[1] ?? '',
  },
  // API key in env
  {
    category: 'api_key_env',
    pattern:
      /\b(?:API_KEY|APIKEY|SECRET_KEY|SECRETKEY|ACCESS_TOKEN|ACCESSTOKEN)\s*[=:]\s*(["']?)([^"'\s\n\r]+)\1/g,
    confidence: 0.9 as DetectionConfidence,
    valueExtractor: (m) => m[2] ?? '',
  },
  // Generic secret env vars
  {
    category: 'secret_env',
    pattern: /\b(?:SECRET|CLIENT_SECRET|APP_SECRET)\s*[=:]\s*(["']?)([^"'\s\n\r]{8,})\1/g,
    confidence: 0.85 as DetectionConfidence,
    valueExtractor: (m) => m[2] ?? '',
  },
];

function createPasswordDetectorImpl(): new () => BaseDetector {
  const detectorName = 'password-detector';

  class PasswordDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = [
      'password_env',
      'password_config',
      'api_key_env',
      'secret_env',
    ] as const;
    public readonly confidence = 0.85 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      for (const { category, pattern, confidence, valueExtractor } of PASSWORD_PATTERNS) {
        pattern.lastIndex = 0;

        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const value = valueExtractor(match);
          if (!value || value.length < 4) continue;

          // Check if value looks like a placeholder or template
          if (this.isPlaceholder(value)) continue;

          // Check if it's in a comment (basic check)
          if (this.isInComment(text, match.index)) continue;

          // Calculate the start/end positions of just the value
          const valueStart = match[0].indexOf(value);
          const start = match.index + valueStart;
          const end = start + value.length;

          // Check for exact duplicate
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

    /**
     * Check if value looks like a placeholder/template
     */
    private isPlaceholder(value: string): boolean {
      const placeholders = [
        /^\${.*}$/,
        /^%.*%$/,
        /^#\{.*\}$/,
        /^<.*>$/,
        /^\[.*\]$/,
        /^your-.*/i,
        /^my-.*/i,
        /^change-?me$/i,
        /^replace-?me$/i,
        /^changeme$/i,
        /^replace$/i,
        /^xxx+$/i,
        /^\*+$/,
        /^password$/i,
        /^secret$/i,
        /^hidden$/i,
        /^redacted$/i,
        /^\[.*\]$/,
      ];
      return placeholders.some((p) => p.test(value.trim()));
    }

    /**
     * Basic check if position is in a comment
     */
    private isInComment(text: string, index: number): boolean {
      // Check for // comment before position on same line
      const lineStart = text.lastIndexOf('\n', index) + 1;
      const beforeMatch = text.slice(lineStart, index);
      if (beforeMatch.includes('//')) return true;
      if (beforeMatch.includes('/*')) {
        const afterComment = text.slice(index, text.indexOf('*/', index) + 2);
        if (afterComment.includes('*/')) return true;
      }
      // Check for # comment
      if (beforeMatch.includes('#')) return true;
      // Check for ; comment (config files)
      if (beforeMatch.includes(';')) return true;
      // Check for <!-- comment
      if (text.slice(Math.max(0, index - 4), index) === '<!--') return true;

      return false;
    }
  }

  return PasswordDetector;
}

export function createPasswordDetector(): BaseDetector {
  return new (createPasswordDetectorImpl())();
}

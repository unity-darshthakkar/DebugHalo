/**
 * Slack Token Detector
 *
 * Detects Slack API tokens (Bot, User, App-level) with high confidence.
 */

import { BaseDetector } from './baseDetector.js';
import type {
  DetectionCategory,
  DetectionConfidence,
  DetectionOptions,
  DetectionResult,
} from '../../types/core.js';

/**
 * Slack token patterns
 * - Bot token: xoxb- + variable length (test uses ~45 chars)
 * - User token: xoxp- + variable length (test uses ~63 chars)
 * - App-level token: xapp- + variable length (test uses ~53 chars)
 * - Config token: xoxe- + variable length
 */
const SLACK_TOKEN_PATTERNS = [
  {
    category: 'slack_token' as DetectionCategory,
    pattern: /\bxoxb-[a-zA-Z0-9-]{40,}\b/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'slack_token' as DetectionCategory,
    pattern: /\bxoxp-[a-zA-Z0-9-]{50,}\b/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'slack_token' as DetectionCategory,
    pattern: /\bxapp-[a-zA-Z0-9-]{40,}\b/g,
    confidence: 0.99 as DetectionConfidence,
  },
  {
    category: 'slack_token' as DetectionCategory,
    pattern: /\bxoxe-[a-zA-Z0-9-]{40,}\b/g,
    confidence: 0.99 as DetectionConfidence,
  },
];

function createSlackTokenDetectorImpl(): new () => BaseDetector {
  const detectorName = 'slack-token-detector';

  class SlackTokenDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['slack_token'] as const;
    public readonly confidence = 0.99 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      for (const { category, pattern, confidence } of SLACK_TOKEN_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;

          const value = match[0];
          const start = match.index;
          const end = start + value.length;

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

  return SlackTokenDetector;
}

export function createSlackTokenDetector(): BaseDetector {
  return new (createSlackTokenDetectorImpl())();
}

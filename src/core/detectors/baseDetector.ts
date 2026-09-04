/**
 * Base Detector Class
 *
 * This is the abstract base class that all detectors must extend.
 * Extracted to a separate file to avoid circular dependencies.
 */

import type {
  DetectionResult,
  DetectionCategory,
  DetectionConfidence,
  DetectionOptions,
  DetectionValidator,
} from '../../types/core.js';
import { enrichDetection } from '../detectionPolicy.js';

/**
 * Detection pattern definition
 */
export interface DetectionPattern {
  readonly pattern: RegExp;
  readonly category?: DetectionCategory;
  readonly confidence?: DetectionConfidence;
  readonly reason?: string;
}

/**
 * Base detector class that all detectors should extend
 */
export abstract class BaseDetector {
  // Subclasses must provide these abstract properties
  public abstract readonly name: string;
  public abstract readonly categories: ReadonlyArray<DetectionCategory>;
  public abstract readonly confidence: DetectionConfidence;

  // Optional fields with defaults - subclasses can override
  public readonly priority: number = 0;
  public readonly enabled: boolean = true;
  public readonly aliasPrefix: string = 'SECRET';
  public readonly patterns: ReadonlyArray<DetectionPattern> = [];
  public readonly validator?: DetectionValidator;
  public readonly contextKeywords: ReadonlyArray<string> = [];

  abstract detect(input: string, options?: DetectionOptions): ReadonlyArray<DetectionResult>;

  /**
   * Create a detection result with context and reason
   */
  protected createDetection(
    input: string,
    start: number,
    end: number,
    category: DetectionCategory,
    confidence: DetectionConfidence,
    options?: {
      contextBefore?: string;
      contextAfter?: string;
      detectorName?: string;
      contextWindow?: number;
      reason?: string;
    }
  ): DetectionResult {
    const value = input.slice(start, end);
    const contextWindow = options?.contextWindow ?? 50;
    const { before, after } = this.extractContext(input, start, end, contextWindow);
    return enrichDetection(input, {
      id: `${this.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      category,
      value,
      confidence,
      range: { start, end, startLine: 1, endLine: 1, startColumn: start + 1, endColumn: end + 1 },
      detectorName: options?.detectorName ?? this.name,
      context:
        options?.contextBefore && options?.contextAfter
          ? `${options.contextBefore}...${value}...${options.contextAfter}`
          : options?.contextBefore || options?.contextAfter || `${before}...${value}...${after}`,
      reason: options?.reason,
    });
  }

  /**
   * Extract context around a match
   */
  protected extractContext(
    input: string,
    start: number,
    end: number,
    window: number
  ): { before: string; after: string } {
    const beforeStart = Math.max(0, start - window);
    const afterEnd = Math.min(input.length, end + window);
    return {
      before: input.slice(beforeStart, start),
      after: input.slice(end, afterEnd),
    };
  }

  /**
   * Check if string has sufficient entropy to be a secret
   */
  protected hasSufficientEntropy(str: string, minLength = 20): boolean {
    // Must have at least 2 character types
    const hasLower = /[a-z]/.test(str);
    const hasUpper = /[A-Z]/.test(str);
    const hasDigit = /[0-9]/.test(str);
    const hasSpecial = /[^a-zA-Z0-9]/.test(str);
    const types = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
    return types >= 2 && str.length >= minLength;
  }

  /**
   * Check if a match has context keywords nearby
   */
  protected hasContextKeywords(text: string, matchIndex: number, window = 100): boolean {
    if (this.contextKeywords.length === 0) return true;
    const context = text.slice(Math.max(0, matchIndex - window), matchIndex + window).toLowerCase();
    return this.contextKeywords.some((keyword) => context.includes(keyword.toLowerCase()));
  }

  /**
   * Validate a match using the detector's validator if provided
   */
  protected validateMatch(match: string, context: string): boolean {
    if (this.validator) {
      return this.validator(match, context);
    }
    return true;
  }

  /**
   * Find all matches for a pattern, handling repeated matches safely
   */
  protected *findMatches(text: string, pattern: RegExp): Generator<RegExpExecArray> {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      yield match;
    }
  }

  /**
   * Check if a detection range overlaps with any existing detection
   */
  protected isOverlapping(
    results: ReadonlyArray<DetectionResult>,
    start: number,
    end: number
  ): boolean {
    return results.some((r) => r.range.start < end && r.range.end > start);
  }
}

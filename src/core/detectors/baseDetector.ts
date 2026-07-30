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
} from '../../types/core.js';

/**
 * Base detector class that all detectors should extend
 */
export abstract class BaseDetector {
  public abstract readonly name: string;
  public abstract readonly categories: ReadonlyArray<DetectionCategory>;
  public abstract readonly confidence: DetectionConfidence;
  public readonly priority = 0;
  public readonly enabled: boolean = true;

  abstract detect(input: string, options?: DetectionOptions): ReadonlyArray<DetectionResult>;

  /**
   * Create a detection result with context
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
    }
  ): DetectionResult {
    const value = input.slice(start, end);
    const contextWindow = options?.contextWindow ?? 50;
    const { before, after } = this.extractContext(input, start, end, contextWindow);
    return {
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
    };
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
}

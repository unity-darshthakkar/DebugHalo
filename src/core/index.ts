/**
 * Core module - placeholder for future implementation
 *
 * This module will contain the core PII/secret detection logic
 * in future phases.
 */

export const CORE_VERSION = '0.1.0';

export interface CoreConfig {
  // Placeholder for future configuration
  allowedPatterns?: string[];
  deniedPatterns?: string[];
}

export interface DetectionResult {
  type: string;
  start: number;
  end: number;
  value: string;
  confidence: number;
}

export function createCore(_config: CoreConfig = {}) {
  // Placeholder for future configuration usage
  void _config;
  return {
    version: CORE_VERSION,
    detect: async (_input: string): Promise<DetectionResult[]> => {
      // Placeholder - will be implemented in Phase 2
      void _input;
      return [];
    },
  };
}

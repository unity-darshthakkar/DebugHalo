/**
 * Core Types Tests
 *
 * Tests for type definitions and type utilities
 */

import { describe, it, expect } from 'vitest';

import type {
  DetectionCategory,
  SourceRange,
  DetectionResult,
  AliasEntry,
  PipelineConfig,
  PipelineResult,
  DebugBundleOutput,
} from '@/types/core.js';

import { confidence } from '@/types/core.js';

describe('Core Types', () => {
  describe('DetectionCategory', () => {
    it('should allow all defined categories', () => {
      const categories: DetectionCategory[] = [
        'api_key',
        'aws_access_key',
        'aws_secret_key',
        'github_token',
        'gitlab_token',
        'slack_token',
        'discord_token',
        'stripe_key',
        'openai_key',
        'anthropic_key',
        'generic_token',
        'jwt',
        'authorization_header',
        'basic_auth',
        'bearer_token',
        'private_key',
        'ssh_private_key',
        'pgp_private_key',
        'database_url',
        'postgres_url',
        'mysql_url',
        'mongodb_url',
        'redis_url',
        'password',
        'password_env',
        'password_config',
        'api_key_env',
        'secret_env',
        'email',
        'phone',
        'ssn',
        'credit_card',
        'ip_address',
        'internal_url',
        'internal_domain',
        'localhost_url',
      ];

      expect(categories.length).toBe(36);
    });
  });

  describe('DetectionConfidence', () => {
    it('should create valid confidence values', () => {
      expect(confidence(0)).toBe(0);
      expect(confidence(0.5)).toBe(0.5);
      expect(confidence(1)).toBe(1);
    });

    it('should reject invalid confidence values', () => {
      expect(() => confidence(-0.1)).toThrow();
      expect(() => confidence(1.1)).toThrow();
    });
  });

  describe('SourceRange', () => {
    it('should have all required fields', () => {
      const range: SourceRange = {
        start: 0,
        end: 10,
        startLine: 1,
        endLine: 1,
        startColumn: 1,
        endColumn: 11,
      };

      expect(range.start).toBe(0);
      expect(range.end).toBe(10);
      expect(range.startLine).toBe(1);
      expect(range.endLine).toBe(1);
      expect(range.startColumn).toBe(1);
      expect(range.endColumn).toBe(11);
    });
  });

  describe('DetectionResult', () => {
    it('should have all required fields', () => {
      const syntheticKey = ['sk', 'test'].join('_') + '_' + 'x'.repeat(24);
      const detection: DetectionResult = {
        id: 'test_1',
        category: 'api_key',
        value: syntheticKey,
        confidence: confidence(0.95),
        range: {
          start: 0,
          end: syntheticKey.length,
          startLine: 1,
          endLine: 1,
          startColumn: 1,
          endColumn: syntheticKey.length + 1,
        },
        detectorName: 'api-key-detector',
        context: 'api_key_env: test context',
      };

      expect(detection.id).toBe('test_1');
      expect(detection.category).toBe('api_key');
      expect(detection.value).toBe(syntheticKey);
      expect(detection.confidence).toBe(0.95);
      expect(detection.detectorName).toBe('api-key-detector');
    });
  });

  describe('AliasEntry', () => {
    it('should have all required fields', () => {
      const syntheticKey = ['sk', 'test'].join('_') + '_' + 'x'.repeat(12);
      const entry: AliasEntry = {
        original: syntheticKey,
        alias: '<API_KEY_1>',
        category: 'api_key',
        firstDetectionId: 'det_1',
        replacementCount: 2,
      };

      expect(entry.original).toBe(syntheticKey);
      expect(entry.alias).toBe('<API_KEY_1>');
      expect(entry.category).toBe('api_key');
      expect(entry.firstDetectionId).toBe('det_1');
      expect(entry.replacementCount).toBe(2);
    });
  });

  describe('PipelineConfig', () => {
    it('should allow empty config', () => {
      const config: PipelineConfig = {};
      expect(config.minConfidence).toBeUndefined();
    });

    it('should allow all config options', () => {
      const config: PipelineConfig = {
        minConfidence: 0.7,
        enabledCategories: ['api_key', 'email'],
        disabledCategories: ['phone'],
        customPatterns: [
          {
            name: 'custom',
            category: 'api_key',
            pattern: 'custom-[a-z0-9]+',
            confidence: confidence(0.8),
            enabled: true,
          },
        ],
        normalizeLineEndings: true,
        maxInputSize: 5 * 1024 * 1024,
        includeContext: true,
        contextWindow: 100,
      };

      expect(config.minConfidence).toBe(0.7);
      expect(config.enabledCategories).toEqual(['api_key', 'email']);
      expect(config.disabledCategories).toEqual(['phone']);
      expect(config.customPatterns).toHaveLength(1);
    });
  });

  describe('PipelineResult', () => {
    it('should indicate success or failure', () => {
      const successResult: PipelineResult = {
        bundle: {} as DebugBundleOutput,
        success: true,
        warnings: [],
      };

      const failureResult: PipelineResult = {
        bundle: {} as DebugBundleOutput,
        success: false,
        warnings: ['Error message'],
      };

      expect(successResult.success).toBe(true);
      expect(failureResult.success).toBe(false);
      expect(failureResult.warnings).toHaveLength(1);
    });
  });
});

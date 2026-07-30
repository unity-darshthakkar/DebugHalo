import { describe, it, expect, beforeEach } from 'vitest';
import { sanitize, sanitizeLayered } from '@/core/sanitizer.js';
import { createAliasVault } from '@/core/aliasVault.js';
import type { DetectionResult, AliasVault } from '@/types/core.js';
import { confidence } from '@/types/core.js';

describe('Sanitizer Tests', () => {
  let vault: AliasVault;

  beforeEach(() => {
    vault = createAliasVault();
  });

  describe('sanitize', () => {
    it('should sanitize empty text', () => {
      const result = sanitize('', [], vault);
      expect(result.sanitizedText).toBe('');
      expect(result.detections).toHaveLength(0);
    });

    it('should return original text if no detections', () => {
      const text = 'Just normal text';
      const result = sanitize(text, [], vault);
      expect(result.sanitizedText).toBe(text);
    });

    it('should replace single detection with alias', () => {
      const text = 'API_KEY=sk_test_12345';
      const detections: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'api_key',
          value: 'sk_test_12345',
          confidence: confidence(0.95),
          range: { start: 8, end: 21, startLine: 1, endLine: 1, startColumn: 9, endColumn: 22 },
          detectorName: 'api-key-detector',
        },
      ];

      const result = sanitize(text, detections, vault);

      expect(result.sanitizedText).toBe('API_KEY=<API_KEY_1>');
      expect(result.detections).toHaveLength(1);
      expect(result.stats.totalDetections).toBe(1);
      expect(result.stats.uniqueValues).toBe(1);
    });

    it('should replace multiple detections', () => {
      const text = 'KEY=sk_test EMAIL=user@example.com';
      const detections: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'api_key',
          value: 'sk_test',
          confidence: confidence(0.95),
          range: { start: 4, end: 11, startLine: 1, endLine: 1, startColumn: 5, endColumn: 12 },
          detectorName: 'api-key-detector',
        },
        {
          id: 'det_2',
          category: 'email',
          value: 'user@example.com',
          confidence: confidence(0.9),
          range: { start: 18, end: 34, startLine: 1, endLine: 1, startColumn: 19, endColumn: 35 },
          detectorName: 'email-detector',
        },
      ];

      const result = sanitize(text, detections, vault);

      expect(result.sanitizedText).toBe('KEY=<API_KEY_1> EMAIL=<EMAIL_1>');
      expect(result.detections).toHaveLength(2);
      expect(result.stats.totalDetections).toBe(2);
      expect(result.stats.uniqueValues).toBe(2);
    });

    it('should use same alias for repeated values', () => {
      const text = 'KEY1=sk_test KEY2=sk_test KEY3=sk_test';
      const detections: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'api_key',
          value: 'sk_test',
          confidence: confidence(0.95),
          range: { start: 5, end: 12, startLine: 1, endLine: 1, startColumn: 6, endColumn: 13 },
          detectorName: 'api-key-detector',
        },
        {
          id: 'det_2',
          category: 'api_key',
          value: 'sk_test',
          confidence: confidence(0.95),
          range: { start: 18, end: 25, startLine: 1, endLine: 1, startColumn: 19, endColumn: 26 },
          detectorName: 'api-key-detector',
        },
        {
          id: 'det_3',
          category: 'api_key',
          value: 'sk_test',
          confidence: confidence(0.95),
          range: { start: 31, end: 38, startLine: 1, endLine: 1, startColumn: 32, endColumn: 39 },
          detectorName: 'api-key-detector',
        },
      ];

      const result = sanitize(text, detections, vault);

      expect(result.sanitizedText).toBe('KEY1=<API_KEY_1> KEY2=<API_KEY_1> KEY3=<API_KEY_1>');
      expect(result.stats.totalDetections).toBe(3);
      expect(result.stats.uniqueValues).toBe(1);
    });

    it('should handle adjacent detections', () => {
      const text = 'sk_test1sk_test2';
      const detections: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'api_key',
          value: 'sk_test1',
          confidence: confidence(0.95),
          range: { start: 0, end: 8, startLine: 1, endLine: 1, startColumn: 1, endColumn: 9 },
          detectorName: 'api-key-detector',
        },
        {
          id: 'det_2',
          category: 'api_key',
          value: 'sk_test2',
          confidence: confidence(0.95),
          range: { start: 8, end: 16, startLine: 1, endLine: 1, startColumn: 9, endColumn: 17 },
          detectorName: 'api-key-detector',
        },
      ];

      const result = sanitize(text, detections, vault);

      // First occurrence gets first alias number
      expect(result.sanitizedText).toBe('<API_KEY_1><API_KEY_2>');
    });

    it('should handle multiline values', () => {
      const multilineValue = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD
-----END PRIVATE KEY-----`;
      const text = `Private key: ${multilineValue}`;
      const detections: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'private_key',
          value: multilineValue,
          confidence: confidence(0.99),
          range: {
            start: 13,
            end: 13 + multilineValue.length,
            startLine: 1,
            endLine: 4,
            startColumn: 14,
            endColumn: 1,
          },
          detectorName: 'private-key-detector',
        },
      ];

      const result = sanitize(text, detections, vault);

      expect(result.sanitizedText).toBe('Private key: <PRIVATE_KEY_1>');
      expect(result.detections[0]!.value).toBe(multilineValue);
    });

    it('should handle Unicode text', () => {
      const text = 'Token: 密鑰_token_テスト';
      const detections: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'api_key',
          value: '密鑰_token_テスト',
          confidence: confidence(0.9),
          range: { start: 7, end: 19, startLine: 1, endLine: 1, startColumn: 8, endColumn: 20 },
          detectorName: 'api-key-detector',
        },
      ];

      const result = sanitize(text, detections, vault);

      expect(result.sanitizedText).toBe('Token: <API_KEY_1>');
    });

    it('should preserve line endings (Windows CRLF)', () => {
      const text = 'KEY=sk_test\r\nEMAIL=user@example.com\r\n';
      const detections: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'api_key',
          value: 'sk_test',
          confidence: confidence(0.95),
          range: { start: 4, end: 11, startLine: 1, endLine: 1, startColumn: 5, endColumn: 12 },
          detectorName: 'api-key-detector',
        },
        {
          id: 'det_2',
          category: 'email',
          value: 'user@example.com',
          confidence: confidence(0.9),
          range: { start: 19, end: 35, startLine: 2, endLine: 2, startColumn: 7, endColumn: 23 },
          detectorName: 'email-detector',
        },
      ];

      const result = sanitize(text, detections, vault);

      expect(result.sanitizedText).toBe('KEY=<API_KEY_1>\r\nEMAIL=<EMAIL_1>\r\n');
    });

    it('should preserve line endings (Unix LF)', () => {
      const text = 'KEY=sk_test\nEMAIL=user@example.com\n';
      const detections: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'api_key',
          value: 'sk_test',
          confidence: confidence(0.95),
          range: { start: 4, end: 11, startLine: 1, endLine: 1, startColumn: 5, endColumn: 12 },
          detectorName: 'api-key-detector',
        },
        {
          id: 'det_2',
          category: 'email',
          value: 'user@example.com',
          confidence: confidence(0.9),
          range: { start: 18, end: 34, startLine: 2, endLine: 2, startColumn: 7, endColumn: 23 },
          detectorName: 'email-detector',
        },
      ];

      const result = sanitize(text, detections, vault);

      expect(result.sanitizedText).toBe('KEY=<API_KEY_1>\nEMAIL=<EMAIL_1>\n');
    });

    it('should correctly calculate stats', () => {
      const text = 'KEY1=sk_test1 KEY2=sk_test1 KEY3=sk_test2';
      const detections: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'api_key',
          value: 'sk_test1',
          confidence: confidence(0.95),
          range: { start: 5, end: 13, startLine: 1, endLine: 1, startColumn: 6, endColumn: 14 },
          detectorName: 'api-key-detector',
        },
        {
          id: 'det_2',
          category: 'api_key',
          value: 'sk_test1',
          confidence: confidence(0.95),
          range: { start: 19, end: 27, startLine: 1, endLine: 1, startColumn: 20, endColumn: 28 },
          detectorName: 'api-key-detector',
        },
        {
          id: 'det_3',
          category: 'api_key',
          value: 'sk_test2',
          confidence: confidence(0.95),
          range: { start: 33, end: 41, startLine: 1, endLine: 1, startColumn: 34, endColumn: 42 },
          detectorName: 'api-key-detector',
        },
      ];

      const result = sanitize(text, detections, vault);

      expect(result.stats.totalDetections).toBe(3);
      expect(result.stats.uniqueValues).toBe(2);
      expect(result.stats.byCategory.get('api_key')).toBe(3);
    });
  });

  describe('sanitizeLayered', () => {
    it('should apply multiple detection layers', () => {
      const text = 'KEY=sk_test EMAIL=user@example.com JWT=eyJhbGci';

      const layer1: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'api_key',
          value: 'sk_test',
          confidence: confidence(0.95),
          range: { start: 4, end: 11, startLine: 1, endLine: 1, startColumn: 5, endColumn: 12 },
          detectorName: 'api-key-detector',
        },
      ];

      // After layer 1 sanitizes, text becomes: 'KEY=<API_KEY_1> EMAIL=user@example.com JWT=eyJhbGci'
      // The email starts at position 22 (4 + 11 + 1 + 6 = 22 where "<API_KEY_1>" is 11 chars + space)
      const layer2: DetectionResult[] = [
        {
          id: 'det_2',
          category: 'email',
          value: 'user@example.com',
          confidence: confidence(0.9),
          range: { start: 22, end: 38, startLine: 1, endLine: 1, startColumn: 23, endColumn: 39 },
          detectorName: 'email-detector',
        },
      ];

      const result = sanitizeLayered(text, [layer1, layer2], vault);

      expect(result.sanitizedText).toContain('<API_KEY_1>');
      expect(result.sanitizedText).toContain('<EMAIL_1>');
      expect(result.detections).toHaveLength(2);
    });
  });

  describe('determinism', () => {
    it('should produce identical results for identical inputs', () => {
      // Runtime-constructed Stripe test key to avoid GitHub push-protection triggers
      const STRIPE_TEST_KEY = 'sk_test_' + '1'.repeat(28);
      const text = 'API_KEY=' + STRIPE_TEST_KEY;
      const detections: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'api_key',
          value: STRIPE_TEST_KEY,
          confidence: confidence(0.95),
          range: { start: 8, end: 36, startLine: 1, endLine: 1, startColumn: 9, endColumn: 37 },
          detectorName: 'api-key-detector',
        },
      ];

      const vault1 = createAliasVault();
      const vault2 = createAliasVault();

      const result1 = sanitize(text, detections, vault1);
      const result2 = sanitize(text, detections, vault2);

      expect(result1.sanitizedText).toBe(result2.sanitizedText);
      expect(result1.vault.entries.size).toBe(result2.vault.entries.size);
    });

    it('should produce identical results when run twice', () => {
      const text = 'KEY1=val1 KEY2=val2';
      const detections: DetectionResult[] = [
        {
          id: 'det_1',
          category: 'api_key',
          value: 'val1',
          confidence: confidence(0.9),
          range: { start: 5, end: 9, startLine: 1, endLine: 1, startColumn: 6, endColumn: 10 },
          detectorName: 'detector',
        },
        {
          id: 'det_2',
          category: 'api_key',
          value: 'val2',
          confidence: confidence(0.9),
          range: { start: 15, end: 19, startLine: 1, endLine: 1, startColumn: 16, endColumn: 20 },
          detectorName: 'detector',
        },
      ];

      const vault1 = createAliasVault();
      const result1 = sanitize(text, detections, vault1);

      const vault2 = createAliasVault();
      const result2 = sanitize(text, detections, vault2);

      expect(result1.sanitizedText).toBe(result2.sanitizedText);
    });
  });
});

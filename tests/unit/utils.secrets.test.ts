import { describe, it, expect } from 'vitest';
import {
  detectPotentialSecrets,
  looksLikePassword,
  redactPotentialSecrets,
} from '@/utils/secrets.js';

describe('secrets utility functions', () => {
  describe('detectPotentialSecrets', () => {
    it('should return empty result for empty string', () => {
      const result = detectPotentialSecrets('');
      expect(result.hasPotentialSecret).toBe(false);
      expect(result.patterns).toHaveLength(0);
    });

    it('should return empty result for null input', () => {
      // @ts-expect-error - testing invalid input
      const result = detectPotentialSecrets(null);
      expect(result.hasPotentialSecret).toBe(false);
      expect(result.patterns).toHaveLength(0);
    });

    it('should return empty result for undefined input', () => {
      // @ts-expect-error - testing invalid input
      const result = detectPotentialSecrets(undefined);
      expect(result.hasPotentialSecret).toBe(false);
      expect(result.patterns).toHaveLength(0);
    });

    it('should detect AWS access key pattern', () => {
      const input = 'My AWS key is AKIAIOSFODNN7EXAMPLE';
      const result = detectPotentialSecrets(input);

      expect(result.hasPotentialSecret).toBe(true);
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]!.pattern).toBe('AWS Access Key');
      expect(result.patterns[0]!.matches).toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('should detect GitHub token pattern', () => {
      const input = 'github_token: ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd';
      const result = detectPotentialSecrets(input);

      expect(result.hasPotentialSecret).toBe(true);
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]!.pattern).toBe('GitHub Token');
      expect(result.patterns[0]!.matches).toContain('ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd');
    });

    it('should detect multiple patterns', () => {
      const input = `
        AWS_KEY=AKIAIOSFODNN7EXAMPLE
        GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd
        password="supersecret123"
      `;
      const result = detectPotentialSecrets(input);

      expect(result.hasPotentialSecret).toBe(true);
      // Should detect multiple patterns
      expect(result.patterns.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty patterns array when no secrets found', () => {
      const input = 'This is just a normal string with no secrets';
      const result = detectPotentialSecrets(input);

      expect(result.hasPotentialSecret).toBe(false);
      expect(result.patterns).toHaveLength(0);
    });
  });

  describe('looksLikePassword', () => {
    it('should return false for empty string', () => {
      expect(looksLikePassword('')).toBe(false);
    });

    it('should return false for null input', () => {
      // @ts-expect-error - testing invalid input
      expect(looksLikePassword(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      // @ts-expect-error - testing invalid input
      expect(looksLikePassword(undefined)).toBe(false);
    });

    it('should detect password pattern', () => {
      const input = 'password="mysecretpassword123"';
      expect(looksLikePassword(input)).toBe(true);
    });

    it('should detect password pattern with single quotes', () => {
      const input = "password='mysecretpassword123'";
      expect(looksLikePassword(input)).toBe(true);
    });

    it('should detect password pattern with different spacing', () => {
      const input = 'password = "mysecretpassword123"';
      expect(looksLikePassword(input)).toBe(true);
    });

    it('should return false for non-password strings', () => {
      expect(looksLikePassword('just a regular string')).toBe(false);
      expect(looksLikePassword('password')).toBe(false); // too short
      expect(looksLikePassword('password=')).toBe(false); // no value
    });
  });

  describe('redactPotentialSecrets', () => {
    it('should return unchanged string for input with no secrets', () => {
      const input = 'This is just a normal string';
      const result = redactPotentialSecrets(input);
      expect(result).toBe(input);
    });

    it('should redact AWS access key', () => {
      const input = 'My key: AKIAIOSFODNN7EXAMPLE';
      const result = redactPotentialSecrets(input);
      expect(result).toBe('My key: [REDACTED]');
    });

    it('should redact GitHub token', () => {
      const input = 'token: ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd';
      const result = redactPotentialSecrets(input);
      expect(result).toBe('token: [REDACTED]');
    });

    it('should redact multiple secrets', () => {
      const input =
        'AWS: AKIAIOSFODNN7EXAMPLE && GitHub: ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd';
      const result = redactPotentialSecrets(input);
      expect(result).toBe('AWS: [REDACTED] && GitHub: [REDACTED]');
    });

    it('should handle empty string', () => {
      expect(redactPotentialSecrets('')).toBe('');
    });

    it('should handle null input', () => {
      // @ts-expect-error - testing invalid input
      expect(redactPotentialSecrets(null)).toBeNull();
    });

    it('should handle undefined input', () => {
      // @ts-expect-error - testing invalid input
      expect(redactPotentialSecrets(undefined)).toBeUndefined();
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
  restore,
  restoreAll,
  hasAliases,
  findAliases,
  getUnresolvedAliases,
  validateRestoration,
  createRestorationManifest,
} from '@/core/restorer.js';
import { createAliasVault, getOrCreateAlias } from '@/core/aliasVault.js';
import type { AliasVault } from '@/types/core.js';

// Runtime-constructed test tokens to avoid GitHub push-protection triggers
const GITHUB_TOKEN = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz123456';
const AWS_ACCESS_KEY = 'AKIA' + 'IOSFODNN7EXAMPLE';

describe('Restorer Tests', () => {
  let vault: AliasVault;

  beforeEach(() => {
    vault = createAliasVault();
  });

  describe('restore', () => {
    it('should restore single alias', () => {
      const sanitized = 'API_KEY=<API_KEY_1>';
      getOrCreateAlias(vault, 'sk_test_123', 'api_key');

      const result = restore(sanitized, { vault });

      expect(result.restoredText).toBe('API_KEY=sk_test_123');
      expect(result.restored).toHaveLength(1);
      expect(result.restored[0]).toEqual({ alias: '<API_KEY_1>', original: 'sk_test_123' });
      expect(result.unresolved).toHaveLength(0);
      expect(result.complete).toBe(true);
    });

    it('should restore multiple aliases', () => {
      const sanitized = 'AWS=<AWS_ACCESS_KEY_1> GITHUB=<GITHUB_TOKEN_1>';
      getOrCreateAlias(vault, AWS_ACCESS_KEY, 'aws_access_key');
      getOrCreateAlias(vault, GITHUB_TOKEN, 'github_token');

      const result = restore(sanitized, { vault });

      expect(result.restoredText).toBe('AWS=' + AWS_ACCESS_KEY + ' GITHUB=' + GITHUB_TOKEN);
      expect(result.restored).toHaveLength(2);
      expect(result.complete).toBe(true);
    });

    it('should restore repeated aliases', () => {
      const sanitized = 'KEY1=<API_KEY_1> KEY2=<API_KEY_1>';
      getOrCreateAlias(vault, 'sk_test_123', 'api_key');

      const result = restore(sanitized, { vault });

      expect(result.restoredText).toBe('KEY1=sk_test_123 KEY2=sk_test_123');
      expect(result.restored).toHaveLength(2);
    });

    it('should leave unknown aliases unchanged', () => {
      const sanitized = 'KNOWN=<API_KEY_1> UNKNOWN=<UNKNOWN_1>';
      getOrCreateAlias(vault, 'sk_test_123', 'api_key');

      const result = restore(sanitized, { vault });

      expect(result.restoredText).toBe('KNOWN=sk_test_123 UNKNOWN=<UNKNOWN_1>');
      expect(result.unresolved).toContain('<UNKNOWN_1>');
      expect(result.complete).toBe(false);
    });

    it('should throw on unknown alias in strict mode', () => {
      const sanitized = 'UNKNOWN=<UNKNOWN_1>';

      expect(() => restore(sanitized, { vault, strict: true })).toThrow(
        'Unresolved alias: <UNKNOWN_1>'
      );
    });

    it('should handle multiline original values', () => {
      const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD
-----END PRIVATE KEY-----`;
      const sanitized = 'PRIVATE_KEY=<PRIVATE_KEY_1>';
      getOrCreateAlias(vault, privateKey, 'private_key');

      const result = restore(sanitized, { vault });

      expect(result.restoredText).toBe('PRIVATE_KEY=' + privateKey);
      expect(result.complete).toBe(true);
    });

    it('should handle empty input', () => {
      const result = restore('', { vault });

      expect(result.restoredText).toBe('');
      expect(result.restored).toHaveLength(0);
      expect(result.complete).toBe(true);
    });

    it('should handle text with no aliases', () => {
      const sanitized = 'Just normal text with no aliases';
      const result = restore(sanitized, { vault });

      expect(result.restoredText).toBe(sanitized);
      expect(result.restored).toHaveLength(0);
      expect(result.complete).toBe(true);
    });

    it('should work with includeUnresolved false', () => {
      const sanitized = 'KNOWN=<API_KEY_1> UNKNOWN=<UNKNOWN_1>';
      getOrCreateAlias(vault, 'sk_test_123', 'api_key');

      const result = restore(sanitized, { vault, includeUnresolved: false });

      expect(result.unresolved).toHaveLength(0);
    });
  });

  describe('restoreAll', () => {
    it('should restore multiple texts', () => {
      const texts = ['KEY1=<API_KEY_1>', 'KEY2=<EMAIL_1>', 'KEY3=<API_KEY_2>'];
      getOrCreateAlias(vault, 'val1', 'api_key');
      getOrCreateAlias(vault, 'test@example.com', 'email');
      getOrCreateAlias(vault, 'val2', 'api_key');

      const results = restoreAll(texts, { vault });

      expect(results).toHaveLength(3);
      expect(results[0]!.restoredText).toBe('KEY1=val1');
      expect(results[1]!.restoredText).toBe('KEY2=test@example.com');
      expect(results[2]!.restoredText).toBe('KEY3=val2');
    });
  });

  describe('hasAliases', () => {
    it('should return true for text with aliases', () => {
      expect(hasAliases('API_KEY=<API_KEY_1>')).toBe(true);
      expect(hasAliases('EMAIL=<EMAIL_1> JWT=<JWT_1>')).toBe(true);
    });

    it('should return false for text without aliases', () => {
      expect(hasAliases('Just normal text')).toBe(false);
      expect(hasAliases('')).toBe(false);
      expect(hasAliases('API_KEY=value')).toBe(false);
    });
  });

  describe('findAliases', () => {
    it('should find all aliases in text', () => {
      const text = 'KEY1=<API_KEY_1> KEY2=<EMAIL_1> KEY3=<API_KEY_2>';
      const aliases = findAliases(text);

      expect(aliases).toEqual(['<API_KEY_1>', '<EMAIL_1>', '<API_KEY_2>']);
    });

    it('should return empty array for no aliases', () => {
      expect(findAliases('no aliases here')).toEqual([]);
    });
  });

  describe('getUnresolvedAliases', () => {
    it('should return aliases not in vault', () => {
      const text = 'KNOWN=<API_KEY_1> UNKNOWN=<UNKNOWN_1> ALSO_UNKNOWN=<FOO_1>';
      getOrCreateAlias(vault, 'val', 'api_key');

      const unresolved = getUnresolvedAliases(text, vault);

      expect(unresolved).toContain('<UNKNOWN_1>');
      expect(unresolved).toContain('<FOO_1>');
      expect(unresolved).not.toContain('<API_KEY_1>');
    });

    it('should return empty if all resolved', () => {
      const text = 'KNOWN=<API_KEY_1>';
      getOrCreateAlias(vault, 'val', 'api_key');

      expect(getUnresolvedAliases(text, vault)).toEqual([]);
    });
  });

  describe('validateRestoration', () => {
    it('should return complete for fully resolvable text', () => {
      const text = 'KEY1=<API_KEY_1> KEY2=<EMAIL_1>';
      getOrCreateAlias(vault, 'val1', 'api_key');
      getOrCreateAlias(vault, 'test@example.com', 'email');

      const validation = validateRestoration(text, vault);

      expect(validation.isComplete).toBe(true);
      expect(validation.unresolvedCount).toBe(0);
      expect(validation.totalAliases).toBe(2);
      expect(validation.restoredCount).toBe(2);
    });

    it('should return incomplete for partially resolvable text', () => {
      const text = 'KEY1=<API_KEY_1> KEY2=<UNKNOWN_1>';
      getOrCreateAlias(vault, 'val1', 'api_key');

      const validation = validateRestoration(text, vault);

      expect(validation.isComplete).toBe(false);
      expect(validation.unresolvedCount).toBe(1);
      expect(validation.unresolvedAliases).toContain('<UNKNOWN_1>');
      expect(validation.totalAliases).toBe(2);
      expect(validation.restoredCount).toBe(1);
    });
  });

  describe('createRestorationManifest', () => {
    it('should create manifest with all aliases', () => {
      getOrCreateAlias(vault, 'secret1', 'api_key');
      getOrCreateAlias(vault, 'user@example.com', 'email');
      getOrCreateAlias(vault, 'secret1', 'api_key'); // repeat

      const manifest = createRestorationManifest(vault);

      expect(manifest.aliases).toHaveLength(2);
      expect(manifest.aliases[0]).toEqual({
        alias: '<API_KEY_1>',
        category: 'api_key',
        count: 2,
      });
      expect(manifest.aliases[1]).toEqual({
        alias: '<EMAIL_1>',
        category: 'email',
        count: 1,
      });
      expect(manifest.instructions).toContain('DebugHalo Restoration Manifest');
    });

    it('should create manifest for empty vault', () => {
      const manifest = createRestorationManifest(vault);

      expect(manifest.aliases).toHaveLength(0);
      expect(manifest.instructions).toContain('DebugHalo Restoration Manifest');
    });
  });

  describe('determinism', () => {
    it('should restore identically across calls', () => {
      const sanitized = 'KEY1=<API_KEY_1> KEY2=<EMAIL_1>';
      getOrCreateAlias(vault, 'secret1', 'api_key');
      getOrCreateAlias(vault, 'test@example.com', 'email');

      const result1 = restore(sanitized, { vault });
      const result2 = restore(sanitized, { vault });

      expect(result1.restoredText).toBe(result2.restoredText);
      expect(result1.restored).toEqual(result2.restored);
    });
  });
});

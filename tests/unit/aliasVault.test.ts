import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAliasVault,
  getOrCreateAlias,
  getAlias,
  getOriginal,
  getAllEntries,
  getVaultStats,
  cloneVault,
  mergeVaults,
  serializeVaultForExport,
  AliasVault,
} from '@/core/aliasVault.js';
import type { AliasVault as AliasVaultType } from '@/types/core.js';

describe('AliasVault Tests', () => {
  let vault: AliasVaultType;

  beforeEach(() => {
    vault = createAliasVault();
  });

  describe('createAliasVault', () => {
    it('should create empty vault', () => {
      expect(vault.entries.size).toBe(0);
      expect(vault.reverseMap.size).toBe(0);
      expect(vault.counters.size).toBe(0);
    });
  });

  describe('getOrCreateAlias', () => {
    it('should create new alias for new value', () => {
      const alias = getOrCreateAlias(vault, 'sk_test_123', 'api_key');
      expect(alias).toBe('<API_KEY_1>');
      expect(vault.entries.size).toBe(1);
      expect(vault.reverseMap.size).toBe(1);
    });

    it('should return same alias for same value', () => {
      const alias1 = getOrCreateAlias(vault, 'sk_test_123', 'api_key');
      const alias2 = getOrCreateAlias(vault, 'sk_test_123', 'api_key');
      expect(alias1).toBe(alias2);
      expect(alias1).toBe('<API_KEY_1>');
    });

    it('should create different aliases for different values', () => {
      const alias1 = getOrCreateAlias(vault, 'value1', 'api_key');
      const alias2 = getOrCreateAlias(vault, 'value2', 'api_key');
      expect(alias1).toBe('<API_KEY_1>');
      expect(alias2).toBe('<API_KEY_2>');
    });

    it('should increment replacement count for repeated values', () => {
      getOrCreateAlias(vault, 'value1', 'api_key');
      getOrCreateAlias(vault, 'value1', 'api_key');
      getOrCreateAlias(vault, 'value1', 'api_key');

      const entry = vault.entries.get('value1');
      expect(entry?.replacementCount).toBe(3);
    });

    it('should use category-specific prefixes', () => {
      const apiAlias = getOrCreateAlias(vault, 'sk_test', 'api_key');
      const emailAlias = getOrCreateAlias(vault, 'test@example.com', 'email');
      const jwtAlias = getOrCreateAlias(vault, 'eyJhbGci', 'jwt');
      const ipAlias = getOrCreateAlias(vault, '192.168.1.1', 'ip_address');

      expect(apiAlias).toContain('API_KEY');
      expect(emailAlias).toContain('EMAIL');
      expect(jwtAlias).toContain('JWT');
      expect(ipAlias).toContain('IP');
    });

    it('should maintain separate counters per category', () => {
      getOrCreateAlias(vault, 'val1', 'api_key');
      getOrCreateAlias(vault, 'val2', 'api_key');
      getOrCreateAlias(vault, 'val3', 'email');
      getOrCreateAlias(vault, 'val4', 'email');
      getOrCreateAlias(vault, 'val5', 'email');

      const apiEntry1 = vault.entries.get('val1');
      const apiEntry2 = vault.entries.get('val2');
      const emailEntry1 = vault.entries.get('val3');
      const emailEntry3 = vault.entries.get('val5');

      expect(apiEntry1?.alias).toBe('<API_KEY_1>');
      expect(apiEntry2?.alias).toBe('<API_KEY_2>');
      expect(emailEntry1?.alias).toBe('<EMAIL_1>');
      expect(emailEntry3?.alias).toBe('<EMAIL_3>');
    });
  });

  describe('getAlias', () => {
    it('should return alias for existing value', () => {
      getOrCreateAlias(vault, 'test', 'api_key');
      expect(getAlias(vault, 'test')).toBe('<API_KEY_1>');
    });

    it('should return undefined for non-existent value', () => {
      expect(getAlias(vault, 'nonexistent')).toBeUndefined();
    });
  });

  describe('getOriginal', () => {
    it('should return original value for alias', () => {
      getOrCreateAlias(vault, 'original_value', 'api_key');
      const alias = getAlias(vault, 'original_value')!;
      expect(getOriginal(vault, alias)).toBe('original_value');
    });

    it('should return undefined for non-existent alias', () => {
      expect(getOriginal(vault, '<UNKNOWN_1>')).toBeUndefined();
    });
  });

  describe('getAllEntries', () => {
    it('should return all entries', () => {
      getOrCreateAlias(vault, 'val1', 'api_key');
      getOrCreateAlias(vault, 'val2', 'email');
      getOrCreateAlias(vault, 'val3', 'jwt');

      const entries = getAllEntries(vault);
      expect(entries).toHaveLength(3);
    });

    it('should return empty array for empty vault', () => {
      expect(getAllEntries(vault)).toHaveLength(0);
    });
  });

  describe('getVaultStats', () => {
    it('should return correct stats', () => {
      getOrCreateAlias(vault, 'val1', 'api_key');
      getOrCreateAlias(vault, 'val2', 'api_key');
      getOrCreateAlias(vault, 'val3', 'email');
      getOrCreateAlias(vault, 'val1', 'api_key'); // repeat
      getOrCreateAlias(vault, 'val1', 'api_key'); // repeat

      const stats = getVaultStats(vault);
      expect(stats.totalEntries).toBe(3);
      expect(stats.byCategory.api_key).toBe(2);
      expect(stats.byCategory.email).toBe(1);
      expect(stats.totalReplacements).toBe(5); // 3+1+1
    });
  });

  describe('cloneVault', () => {
    it('should create independent copy', () => {
      getOrCreateAlias(vault, 'val1', 'api_key');
      const cloned = cloneVault(vault);

      expect(cloned.entries.size).toBe(1);
      expect(cloned.reverseMap.size).toBe(1);

      // Modify original
      getOrCreateAlias(vault, 'val2', 'email');
      expect(vault.entries.size).toBe(2);
      expect(cloned.entries.size).toBe(1); // unchanged
    });
  });

  describe('mergeVaults', () => {
    it('should merge separate vaults', () => {
      const vault1 = createAliasVault();
      const vault2 = createAliasVault();

      getOrCreateAlias(vault1, 'val1', 'api_key');
      getOrCreateAlias(vault2, 'val2', 'email');

      mergeVaults(vault1, vault2);

      expect(vault1.entries.size).toBe(2);
      expect(vault2.entries.size).toBe(1);
    });

    it('should handle overlapping values', () => {
      const vault1 = createAliasVault();
      const vault2 = createAliasVault();

      getOrCreateAlias(vault1, 'shared', 'api_key');
      getOrCreateAlias(vault2, 'shared', 'api_key'); // same value, different alias

      mergeVaults(vault1, vault2);

      // Should keep first alias and sum replacement counts
      expect(vault1.entries.size).toBe(1);
      const entry = vault1.entries.get('shared');
      expect(entry?.replacementCount).toBe(2);
    });
  });

  describe('serializeVaultForExport', () => {
    it('should export without original values', () => {
      getOrCreateAlias(vault, 'secret123', 'api_key');
      getOrCreateAlias(vault, 'user@example.com', 'email');

      const exported = serializeVaultForExport(vault);
      expect(exported).toHaveProperty('aliases');
      expect(exported).toHaveProperty('totalUniqueValues', 2);

      // Ensure no original values in export
      const json = JSON.stringify(exported);
      expect(json).not.toContain('secret123');
      expect(json).not.toContain('user@example.com');
    });
  });

  describe('AliasVault Class', () => {
    it('should provide OOP interface', () => {
      const vault = new AliasVault();
      const alias = vault.getOrCreateAlias('test', 'api_key');
      expect(alias).toBe('<API_KEY_1>');
      expect(vault.getSize()).toBe(1);
      expect(vault.getAlias('test')).toBe('<API_KEY_1>');
      expect(vault.getOriginal('<API_KEY_1>')).toBe('test');
      expect(vault.hasAlias('test')).toBe(true);
      expect(vault.hasOriginal('<API_KEY_1>')).toBe(true);
    });

    it('should support clone', () => {
      const vault = new AliasVault();
      vault.getOrCreateAlias('test', 'api_key');
      const cloned = vault.clone();
      expect(cloned.getSize()).toBe(1);
    });
  });
});

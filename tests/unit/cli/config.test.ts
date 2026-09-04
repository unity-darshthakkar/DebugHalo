import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  mergeConfig,
  DEFAULT_CONFIG,
  createDefaultConfigFile,
  VALID_OUTPUT_FORMATS,
} from '../../../src/cli/config.js';

describe('CLI Config Module', () => {
  describe('validateConfig', () => {
    it('validates detection quality controls', () => {
      expect(validateConfig({ minConfidence: 0.9, disabledCategories: ['email'] })).toEqual({
        minConfidence: 0.9,
        disabledCategories: ['email'],
      });
      expect(() => validateConfig({ minConfidence: 2 })).toThrow('between 0 and 1');
      expect(() => validateConfig({ disabledCategories: ['not_real'] })).toThrow(
        'Unknown detection category'
      );
    });

    it('accepts empty object', () => {
      const result = validateConfig({});
      expect(result).toEqual({});
    });

    it('validates extensions array of strings', () => {
      const result = validateConfig({ extensions: ['ts', 'js', 'json'] });
      expect(result.extensions).toEqual(['ts', 'js', 'json']);
    });

    it('rejects non-array extensions', () => {
      expect(() => validateConfig({ extensions: 'ts' })).toThrow(
        'Config "extensions" must be an array'
      );
    });

    it('rejects extensions with non-string elements', () => {
      expect(() => validateConfig({ extensions: ['ts', 123] })).toThrow(
        'Config "extensions" must be an array of strings'
      );
    });

    it('validates ignorePatterns array of strings', () => {
      const result = validateConfig({ ignorePatterns: ['node_modules/**', 'dist/**'] });
      expect(result.ignorePatterns).toEqual(['node_modules/**', 'dist/**']);
    });

    it('rejects non-array ignorePatterns', () => {
      expect(() => validateConfig({ ignorePatterns: 'node_modules/**' })).toThrow(
        'Config "ignorePatterns" must be an array'
      );
    });

    it('validates outputFormat: text', () => {
      const result = validateConfig({ outputFormat: 'text' });
      expect(result.outputFormat).toBe('text');
    });

    it('validates outputFormat: json', () => {
      const result = validateConfig({ outputFormat: 'json' });
      expect(result.outputFormat).toBe('json');
    });

    it('rejects invalid outputFormat', () => {
      expect(() => validateConfig({ outputFormat: 'sarif' })).toThrow(
        'Config "outputFormat" must be one of: text, json'
      );
    });

    it('rejects non-string outputFormat', () => {
      expect(() => validateConfig({ outputFormat: 123 })).toThrow(
        'Config "outputFormat" must be a string'
      );
    });

    it('validates failOnFindings boolean', () => {
      const result = validateConfig({ failOnFindings: true });
      expect(result.failOnFindings).toBe(true);
    });

    it('rejects non-boolean failOnFindings', () => {
      expect(() => validateConfig({ failOnFindings: 'true' })).toThrow(
        'Config "failOnFindings" must be a boolean'
      );
    });

    it('validates dryRun boolean', () => {
      const result = validateConfig({ dryRun: true });
      expect(result.dryRun).toBe(true);
    });

    it('rejects non-boolean dryRun', () => {
      expect(() => validateConfig({ dryRun: 'true' })).toThrow('Config "dryRun" must be a boolean');
    });

    it('rejects unknown properties', () => {
      expect(() => validateConfig({ unknownProperty: 'value' })).toThrow(
        'Unknown config property: "unknownProperty"'
      );
    });

    it('rejects null', () => {
      expect(() => validateConfig(null)).toThrow('Config must be an object');
    });

    it('rejects array', () => {
      expect(() => validateConfig([])).toThrow('Config must be an object');
    });

    it('rejects primitive', () => {
      expect(() => validateConfig('string')).toThrow('Config must be an object');
    });
  });

  describe('mergeConfig', () => {
    it('merges config with defaults', () => {
      const config = { extensions: ['ts', 'js'] };
      const merged = mergeConfig(config);
      expect(merged.extensions).toEqual(['ts', 'js']);
      expect(merged.ignorePatterns).toEqual(DEFAULT_CONFIG.ignorePatterns);
      expect(merged.outputFormat).toBe(DEFAULT_CONFIG.outputFormat);
      expect(merged.failOnFindings).toBe(DEFAULT_CONFIG.failOnFindings);
      expect(merged.dryRun).toBe(DEFAULT_CONFIG.dryRun);
    });

    it('uses config values over defaults', () => {
      const config = {
        extensions: ['ts'],
        ignorePatterns: ['custom/**'],
        outputFormat: 'json' as const,
        failOnFindings: true,
        dryRun: true,
      };
      const merged = mergeConfig(config);
      expect(merged.extensions).toEqual(['ts']);
      expect(merged.ignorePatterns).toEqual(['custom/**']);
      expect(merged.outputFormat).toBe('json');
      expect(merged.failOnFindings).toBe(true);
      expect(merged.dryRun).toBe(true);
    });

    it('handles partial config', () => {
      const config = { outputFormat: 'json' as const };
      const merged = mergeConfig(config);
      expect(merged.outputFormat).toBe('json');
      expect(merged.extensions).toEqual(DEFAULT_CONFIG.extensions);
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('has expected default values', () => {
      expect(DEFAULT_CONFIG.extensions).toEqual([
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'yaml',
        'yml',
        'env',
      ]);
      expect(DEFAULT_CONFIG.ignorePatterns).toEqual(['node_modules/**', 'dist/**', '.git/**']);
      expect(DEFAULT_CONFIG.outputFormat).toBe('text');
      expect(DEFAULT_CONFIG.failOnFindings).toBe(false);
      expect(DEFAULT_CONFIG.dryRun).toBe(false);
    });
  });

  describe('createDefaultConfigFile', () => {
    it('produces valid JSON with expected structure', () => {
      const json = createDefaultConfigFile();
      const parsed = JSON.parse(json);
      expect(parsed.extensions).toEqual(DEFAULT_CONFIG.extensions);
      expect(parsed.ignorePatterns).toEqual(DEFAULT_CONFIG.ignorePatterns);
      expect(parsed.outputFormat).toBe(DEFAULT_CONFIG.outputFormat);
      expect(parsed.failOnFindings).toBe(DEFAULT_CONFIG.failOnFindings);
      // dryRun should not be in the default file (sanitize-specific)
      expect(parsed.dryRun).toBeUndefined();
    });

    it('is formatted with 2-space indentation', () => {
      const json = createDefaultConfigFile();
      expect(json).toContain('  "extensions"');
      expect(json).not.toContain('\t');
    });
  });

  describe('VALID_OUTPUT_FORMATS', () => {
    it('contains text and json', () => {
      expect(VALID_OUTPUT_FORMATS).toEqual(['text', 'json']);
    });
  });
});

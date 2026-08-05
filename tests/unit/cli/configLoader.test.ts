import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { loadConfig, ConfigLoadError } from '../../../src/cli/configLoader.js';

function createTempDir(): string {
  const dir = join(tmpdir(), `debug-halo-config-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

describe('CLI Config Loader', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    testDir = createTempDir();
    originalCwd = process.cwd();
    // Change to temp dir for testing
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupDir(testDir);
  });

  describe('loadConfig', () => {
    it('returns defaults when no config file exists', () => {
      const result = loadConfig(undefined, testDir);
      expect(result.config.extensions).toEqual([
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'yaml',
        'yml',
        'env',
      ]);
      expect(result.config.ignorePatterns).toEqual(['node_modules/**', 'dist/**', '.git/**']);
      expect(result.config.outputFormat).toBe('text');
      expect(result.config.failOnFindings).toBe(false);
      expect(result.config.dryRun).toBe(false);
      expect(result.configPath).toBeNull();
      expect(result.explicitConfig).toBe(false);
    });

    it('loads explicit config path', () => {
      const configPath = join(testDir, 'custom-config.json');
      writeFileSync(
        configPath,
        JSON.stringify({
          extensions: ['ts', 'js'],
          outputFormat: 'json',
          failOnFindings: true,
        })
      );

      const result = loadConfig(configPath, testDir);
      expect(result.config.extensions).toEqual(['ts', 'js']);
      expect(result.config.outputFormat).toBe('json');
      expect(result.config.failOnFindings).toBe(true);
      expect(result.configPath).toBe(configPath);
      expect(result.explicitConfig).toBe(true);
    });

    it('loads explicit config with relative path', () => {
      const configPath = join(testDir, 'custom-config.json');
      writeFileSync(
        configPath,
        JSON.stringify({
          extensions: ['ts', 'js'],
        })
      );

      // Use relative path
      const result = loadConfig('custom-config.json', testDir);
      expect(result.config.extensions).toEqual(['ts', 'js']);
      expect(result.configPath).toBe(resolve(testDir, 'custom-config.json'));
    });

    it('throws ConfigLoadError for missing explicit config', () => {
      expect(() => loadConfig('nonexistent.json', testDir)).toThrow(ConfigLoadError);
      expect(() => loadConfig('nonexistent.json', testDir)).toThrow('Config file not found');
    });

    it('throws ConfigLoadError for invalid JSON', () => {
      const configPath = join(testDir, 'bad.json');
      writeFileSync(configPath, '{ invalid json }');

      expect(() => loadConfig(configPath, testDir)).toThrow(ConfigLoadError);
      expect(() => loadConfig(configPath, testDir)).toThrow('Invalid JSON in config file');
    });

    it('throws ConfigLoadError for non-object JSON', () => {
      const configPath = join(testDir, 'bad.json');
      writeFileSync(configPath, '"not an object"');

      expect(() => loadConfig(configPath, testDir)).toThrow(ConfigLoadError);
      expect(() => loadConfig(configPath, testDir)).toThrow('Config must be a JSON object');
    });

    it('auto-discovers .debughalo.json in current directory', () => {
      const configPath = join(testDir, '.debughalo.json');
      writeFileSync(
        configPath,
        JSON.stringify({
          extensions: ['ts', 'js'],
          outputFormat: 'json',
        })
      );

      const result = loadConfig(undefined, testDir);
      expect(result.config.extensions).toEqual(['ts', 'js']);
      expect(result.config.outputFormat).toBe('json');
      expect(result.configPath).toBe(configPath);
      expect(result.explicitConfig).toBe(false);
    });

    it('does NOT auto-discover .debughalo.json in parent directory (cwd only)', () => {
      const parentDir = join(testDir, 'parent');
      mkdirSync(parentDir, { recursive: true });
      const configPath = join(parentDir, '.debughalo.json');
      writeFileSync(
        configPath,
        JSON.stringify({
          outputFormat: 'json',
        })
      );

      const childDir = join(testDir, 'parent', 'child');
      mkdirSync(childDir, { recursive: true });
      process.chdir(childDir);

      const result = loadConfig(undefined, childDir);
      // Should NOT find parent config - only checks current working directory
      expect(result.config.outputFormat).toBe('text'); // default
      expect(result.configPath).toBeNull();
    });

    it('does not traverse above filesystem root', () => {
      // Create config in a completely different location
      const otherDir = join(tmpdir(), 'other-debughalo-test');
      mkdirSync(otherDir, { recursive: true });
      const configPath = join(otherDir, '.debughalo.json');
      writeFileSync(configPath, JSON.stringify({ outputFormat: 'json' }));

      // Should not find it from testDir
      const result = loadConfig(undefined, testDir);
      expect(result.configPath).toBeNull();
    });

    it('explicit config takes precedence over auto-discovered', () => {
      // Auto-discovered config
      writeFileSync(join(testDir, '.debughalo.json'), JSON.stringify({ outputFormat: 'text' }));

      // Explicit config
      const explicitPath = join(testDir, 'explicit.json');
      writeFileSync(explicitPath, JSON.stringify({ outputFormat: 'json' }));

      const result = loadConfig(explicitPath, testDir);
      expect(result.config.outputFormat).toBe('json');
      expect(result.configPath).toBe(explicitPath);
      expect(result.explicitConfig).toBe(true);
    });

    it('validates config from file', () => {
      writeFileSync(join(testDir, '.debughalo.json'), JSON.stringify({ outputFormat: 'invalid' }));

      expect(() => loadConfig(undefined, testDir)).toThrow(ConfigLoadError);
      expect(() => loadConfig(undefined, testDir)).toThrow('outputFormat');
    });

    it('validates extensions from file', () => {
      writeFileSync(
        join(testDir, '.debughalo.json'),
        JSON.stringify({ extensions: 'not-an-array' })
      );

      expect(() => loadConfig(undefined, testDir)).toThrow(ConfigLoadError);
      expect(() => loadConfig(undefined, testDir)).toThrow('extensions');
    });
  });
});

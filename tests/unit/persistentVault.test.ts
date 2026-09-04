import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createAliasVault, getOrCreateAlias } from '@/core/aliasVault.js';
import {
  assertSafeVaultPath,
  loadPersistentVault,
  savePersistentVault,
} from '@/core/persistentVault.js';

const directories: string[] = [];
function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'debughalo-vault-'));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('persistent vault', () => {
  it('creates, reloads, and reuses mappings across instances', () => {
    const path = join(temporaryDirectory(), 'state', 'vault.json');
    const first = createAliasVault();
    const alias = getOrCreateAlias(first, 'secret-value-one', 'api_key');
    savePersistentVault(path, first);
    const second = loadPersistentVault(path);
    expect(second.reverseMap.get(alias)).toBe('secret-value-one');
    expect(getOrCreateAlias(second, 'secret-value-one', 'api_key')).toBe(alias);
  });

  it('returns an empty vault when the file is missing', () => {
    expect(loadPersistentVault(join(temporaryDirectory(), 'missing.json')).entries.size).toBe(0);
  });

  it('rejects malformed and conflicting data without exposing stored values', () => {
    const directory = temporaryDirectory();
    const malformed = join(directory, 'malformed.json');
    writeFileSync(malformed, '{nope');
    expect(() => loadPersistentVault(malformed)).toThrow('malformed JSON');

    const duplicate = join(directory, 'duplicate.json');
    writeFileSync(
      duplicate,
      JSON.stringify({
        version: 1,
        entries: [
          {
            original: 'first-private-value',
            alias: '<API_KEY_1>',
            category: 'api_key',
            firstDetectionId: 'a',
            replacementCount: 1,
          },
          {
            original: 'second-private-value',
            alias: '<API_KEY_1>',
            category: 'api_key',
            firstDetectionId: 'b',
            replacementCount: 1,
          },
        ],
      })
    );
    expect(() => loadPersistentVault(duplicate)).toThrow('duplicate or conflicting mappings');
    try {
      loadPersistentVault(duplicate);
    } catch (error) {
      expect(String(error)).not.toContain('private-value');
    }
  });

  it('persists only mapping metadata and original values, not unrelated content', () => {
    const path = join(temporaryDirectory(), 'vault.json');
    const vault = createAliasVault();
    getOrCreateAlias(vault, 'secret-value', 'api_key');
    savePersistentVault(path, vault);
    const document = JSON.parse(readFileSync(path, 'utf8'));
    expect(document).toMatchObject({ version: 1 });
    expect(Object.keys(document)).toEqual(['version', 'entries']);
  });

  it('rejects ordinary project paths and permits the excluded .debughalo directory', () => {
    const cwd = temporaryDirectory();
    expect(() => assertSafeVaultPath(join(cwd, 'vault.json'), cwd)).toThrow('plaintext vault');
    expect(() => assertSafeVaultPath(join(cwd, '.debughalo', 'vault.json'), cwd)).not.toThrow();
  });

  it('avoids aliases colliding when categories share a prefix', () => {
    const vault = createAliasVault();
    expect(getOrCreateAlias(vault, 'postgres-one', 'database_url')).toBe('<DB_URL_1>');
    expect(getOrCreateAlias(vault, 'postgres-two', 'postgres_url')).toBe('<DB_URL_2>');
  });
});

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import { dirname, isAbsolute, relative, resolve } from 'path';
import {
  ALL_CATEGORIES,
  type AliasEntry,
  type AliasVault,
  type DetectionCategory,
} from '../types/core.js';
import { createVaultFromEntries } from './aliasVault.js';

export const DEFAULT_VAULT_PATH = resolve(homedir(), '.debughalo', 'vault.json');

export class PersistentVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistentVaultError';
  }
}

export function resolveVaultPath(path: string | undefined, cwd = process.cwd()): string {
  return path ? (isAbsolute(path) ? resolve(path) : resolve(cwd, path)) : DEFAULT_VAULT_PATH;
}

export function assertSafeVaultPath(path: string, cwd = process.cwd()): void {
  const rel = relative(resolve(cwd), resolve(path)).replaceAll('\\', '/');
  if (rel === '' || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) return;
  if (rel.startsWith('.debughalo/')) return;
  throw new PersistentVaultError(
    'Refusing to store a plaintext vault in the project. Use the default vault or a path under .debughalo/.'
  );
}

function parseEntry(value: unknown): AliasEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PersistentVaultError('Vault contains an invalid entry');
  }
  const entry = value as Record<string, unknown>;
  if (
    typeof entry['original'] !== 'string' ||
    typeof entry['alias'] !== 'string' ||
    typeof entry['category'] !== 'string' ||
    !ALL_CATEGORIES.includes(entry['category'] as DetectionCategory) ||
    typeof entry['firstDetectionId'] !== 'string' ||
    !Number.isInteger(entry['replacementCount']) ||
    (entry['replacementCount'] as number) < 1
  ) {
    throw new PersistentVaultError('Vault contains an invalid entry');
  }
  return entry as unknown as AliasEntry;
}

export function loadPersistentVault(path: string): AliasVault {
  if (!existsSync(path)) return createVaultFromEntries([]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new PersistentVaultError('Vault is unreadable or contains malformed JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PersistentVaultError('Vault must be a JSON object');
  }
  const document = parsed as Record<string, unknown>;
  if (document['version'] !== 1 || !Array.isArray(document['entries'])) {
    throw new PersistentVaultError('Vault has an unsupported or invalid format');
  }
  const entries = document['entries'].map(parseEntry);
  const originals = new Set<string>();
  const aliases = new Set<string>();
  for (const entry of entries) {
    if (originals.has(entry.original) || aliases.has(entry.alias)) {
      throw new PersistentVaultError('Vault contains duplicate or conflicting mappings');
    }
    originals.add(entry.original);
    aliases.add(entry.alias);
  }
  return createVaultFromEntries(entries);
}

export function savePersistentVault(path: string, vault: AliasVault): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}-${randomUUID()}.tmp`;
  try {
    writeFileSync(
      temporary,
      `${JSON.stringify({ version: 1, entries: [...vault.entries.values()] }, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o600, flag: 'wx' }
    );
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw new PersistentVaultError(
      `Failed to save vault: ${error instanceof Error ? error.message : 'unknown filesystem error'}`
    );
  }
}

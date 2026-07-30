/**
 * Alias Vault
 *
 * Manages deterministic alias generation and reversible mapping for sensitive values.
 * Ensures the same value always gets the same alias within a pipeline execution.
 */

import type {
  AliasEntry,
  AliasVault,
  DetectionCategory,
  ReadonlyAliasVault,
} from '../types/core.js';

/**
 * Type alias for the mutable alias vault type
 */
type AliasVaultType = AliasVault;

/**
 * Category prefix mapping for human-readable aliases
 */
const CATEGORY_PREFIX: Record<DetectionCategory, string> = {
  api_key: 'API_KEY',
  aws_access_key: 'AWS_ACCESS_KEY',
  aws_secret_key: 'AWS_SECRET',
  aws_session_token: 'AWS_SESSION_TOKEN',
  github_token: 'GITHUB_TOKEN',
  gitlab_token: 'GITLAB_TOKEN',
  slack_token: 'SLACK_TOKEN',
  discord_token: 'DISCORD_TOKEN',
  stripe_key: 'STRIPE_KEY',
  stripe_webhook_secret: 'STRIPE_WEBHOOK',
  sendgrid_api_key: 'SENDGRID_KEY',
  openai_key: 'OPENAI_KEY',
  anthropic_key: 'ANTHROPIC_KEY',
  generic_token: 'TOKEN',
  generic_secret: 'GENERIC_SECRET',
  jwt: 'JWT',
  authorization_header: 'AUTH_HEADER',
  basic_auth: 'BASIC_AUTH',
  bearer_token: 'BEARER_TOKEN',
  private_key: 'PRIVATE_KEY',
  ssh_private_key: 'SSH_KEY',
  pgp_private_key: 'PGP_KEY',
  database_url: 'DB_URL',
  postgres_url: 'DB_URL',
  mysql_url: 'MYSQL_URL',
  mongodb_url: 'MONGODB_URL',
  redis_url: 'REDIS_URL',
  password: 'PASSWORD',
  password_env: 'PASSWORD_ENV',
  password_config: 'PASSWORD_CONFIG',
  api_key_env: 'API_KEY_ENV',
  secret_env: 'SECRET_ENV',
  email: 'EMAIL',
  phone: 'PHONE',
  ssn: 'SSN',
  credit_card: 'CREDIT_CARD',
  ip_address: 'IP',
  internal_url: 'INTERNAL_URL',
  internal_domain: 'INTERNAL_DOMAIN',
  localhost_url: 'LOCALHOST_URL',
};

/**
 * Create a new empty alias vault
 */
export function createAliasVault(): AliasVault {
  return {
    entries: new Map<string, AliasEntry>(),
    reverseMap: new Map<string, string>(),
    counters: new Map<DetectionCategory, number>(),
  };
}

/**
 * Get or create an alias for a value
 */
export function getOrCreateAlias(
  vault: AliasVault,
  value: string,
  category: DetectionCategory
): string {
  // Check if already exists
  const existing = vault.entries.get(value);
  if (existing) {
    // Increment replacement count
    const updatedEntry: AliasEntry = {
      ...existing,
      replacementCount: existing.replacementCount + 1,
    };
    vault.entries.set(value, updatedEntry);
    return existing.alias;
  }

  // Create new alias
  const counter = (vault.counters.get(category) ?? 0) + 1;
  vault.counters.set(category, counter);

  const prefix = CATEGORY_PREFIX[category] ?? 'SECRET';
  const alias = `<${prefix}_${counter}>`;

  // Generate a deterministic ID based on first occurrence
  // We use the current vault size as a unique identifier
  const detectionId = `det_${vault.entries.size}_${category}_${counter}`;

  const entry: AliasEntry = {
    original: value,
    alias,
    category,
    firstDetectionId: detectionId,
    replacementCount: 1,
  };

  vault.entries.set(value, entry);
  vault.reverseMap.set(alias, value);

  return alias;
}

/**
 * Get alias for a value (returns undefined if not found)
 */
export function getAlias(vault: ReadonlyAliasVault, value: string): string | undefined {
  return vault.entries.get(value)?.alias;
}

/**
 * Get original value for an alias (for restoration)
 */
export function getOriginal(vault: ReadonlyAliasVault, alias: string): string | undefined {
  return vault.reverseMap.get(alias);
}

/**
 * Check if a value has an alias
 */
export function hasAlias(vault: ReadonlyAliasVault, value: string): boolean {
  return vault.entries.has(value);
}

/**
 * Check if an alias exists
 */
export function hasOriginal(vault: ReadonlyAliasVault, alias: string): boolean {
  return vault.reverseMap.has(alias);
}

/**
 * Get all entries
 */
export function getAllEntries(vault: ReadonlyAliasVault): ReadonlyArray<AliasEntry> {
  return Array.from(vault.entries.values());
}

/**
 * Get vault size (number of unique values)
 */
export function getVaultSize(vault: ReadonlyAliasVault): number {
  return vault.entries.size;
}

/**
 * Get detailed vault statistics
 */
export function getVaultStats(vault: ReadonlyAliasVault): {
  totalEntries: number;
  byCategory: Record<DetectionCategory, number>;
  totalReplacements: number;
} {
  const byCategory: Partial<Record<DetectionCategory, number>> = {};
  let totalReplacements = 0;

  for (const entry of vault.entries.values()) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    totalReplacements += entry.replacementCount;
  }

  return {
    totalEntries: vault.entries.size,
    byCategory: byCategory as Record<DetectionCategory, number>,
    totalReplacements,
  };
}

/**
 * Get replacement stats by category
 */
export function getCategoryStats(vault: ReadonlyAliasVault): Map<DetectionCategory, number> {
  const stats = new Map<DetectionCategory, number>();
  for (const entry of vault.entries.values()) {
    stats.set(entry.category, (stats.get(entry.category) ?? 0) + entry.replacementCount);
  }
  return stats;
}

/**
 * Get entries by category
 */
export function getEntriesByCategory(
  vault: ReadonlyAliasVault,
  category: DetectionCategory
): ReadonlyArray<AliasEntry> {
  return Array.from(vault.entries.values()).filter((e) => e.category === category);
}

/**
 * Get all aliases in the vault
 */
export function getAllAliases(vault: ReadonlyAliasVault): ReadonlyArray<string> {
  return Array.from(vault.reverseMap.keys());
}

/**
 * Check if an alias exists in the vault
 */
export function hasAliasKey(vault: ReadonlyAliasVault, alias: string): boolean {
  return vault.reverseMap.has(alias);
}

/**
 * Get replacement count for a value
 */
export function getReplacementCount(vault: ReadonlyAliasVault, value: string): number {
  return vault.entries.get(value)?.replacementCount ?? 0;
}

/**
 * Create a shallow copy of the vault (for snapshots)
 */
export function cloneVault(vault: ReadonlyAliasVault): AliasVaultType {
  return {
    entries: new Map(vault.entries),
    reverseMap: new Map(vault.reverseMap),
    counters: new Map(vault.counters),
  };
}

/**
 * Merge another vault into this one (for combining results)
 * Note: This assumes no conflicts - use with caution
 */
export function mergeVaults(target: AliasVaultType, source: ReadonlyAliasVault): void {
  for (const [value, entry] of source.entries) {
    const existingEntry = target.entries.get(value);
    if (!existingEntry) {
      target.entries.set(value, entry);
      target.reverseMap.set(entry.alias, value);
      // Update counter
      const currentCounter = target.counters.get(entry.category) ?? 0;
      // Extract number from alias if possible
      const match = entry.alias.match(/_(\d+)>$/);
      const num = match?.[1] ? parseInt(match[1], 10) : 0;
      if (num > 0) {
        target.counters.set(entry.category, Math.max(currentCounter, num));
      }
    } else {
      // Same value in both vaults - sum the replacement counts
      const updatedEntry: AliasEntry = {
        ...existingEntry,
        replacementCount: existingEntry.replacementCount + entry.replacementCount,
      };
      target.entries.set(value, updatedEntry);
    }
  }
}

/**
 * Create a vault from existing entries (for testing/restoration)
 */
export function createVaultFromEntries(entries: ReadonlyArray<AliasEntry>): AliasVaultType {
  const vault = createAliasVault();
  for (const entry of entries) {
    vault.entries.set(entry.original, entry);
    vault.reverseMap.set(entry.alias, entry.original);
    const current = vault.counters.get(entry.category) ?? 0;
    // Extract counter from alias
    const match = entry.alias.match(/_(\d+)>$/);
    const num = match?.[1] ? parseInt(match[1], 10) : 0;
    if (num > 0) {
      vault.counters.set(entry.category, Math.max(current, num));
    }
  }
  return vault;
}

/**
 * Create a minimal vault for restoration (no original values in serialized form)
 */
export function createRestorationVault(vault: ReadonlyAliasVault): {
  aliases: ReadonlyArray<{ alias: string; category: DetectionCategory; count: number }>;
} {
  const aliases = Array.from(vault.entries.values()).map((entry) => ({
    alias: entry.alias,
    category: entry.category,
    count: entry.replacementCount,
  }));

  return { aliases };
}

/**
 * Rebuild vault from restoration manifest
 * Note: Original values cannot be recovered from manifest alone
 * This is for forward reference only
 */
export function createVaultFromManifest(manifest: {
  aliases: ReadonlyArray<{ alias: string; category: DetectionCategory }>;
}): AliasVaultType {
  const vault = createAliasVault();
  for (const { alias, category } of manifest.aliases) {
    vault.reverseMap.set(alias, `[REDACTED:${category}]`);
  }
  return vault;
}

/**
 * Serialize vault to JSON-safe format (EXCLUDES original values for safety)
 */
export function serializeVaultForExport(vault: AliasVaultType): object {
  return {
    aliases: Array.from(vault.entries.values()).map((entry) => ({
      alias: entry.alias,
      category: entry.category,
      replacementCount: entry.replacementCount,
    })),
    totalUniqueValues: vault.entries.size,
  };
}

/**
 * Alias vault class for more object-oriented usage
 */
export class AliasVaultClass {
  private vault: AliasVaultType;

  constructor() {
    this.vault = createAliasVault();
  }

  getOrCreateAlias(value: string, category: DetectionCategory): string {
    return getOrCreateAlias(this.vault, value, category);
  }

  getAlias(value: string): string | undefined {
    return getAlias(this.vault, value);
  }

  getOriginal(alias: string): string | undefined {
    return getOriginal(this.vault, alias);
  }

  hasAlias(value: string): boolean {
    return hasAlias(this.vault, value);
  }

  hasOriginal(alias: string): boolean {
    return hasOriginal(this.vault, alias);
  }

  getAllEntries(): ReadonlyArray<AliasEntry> {
    return getAllEntries(this.vault);
  }

  getSize(): number {
    return getVaultSize(this.vault);
  }

  getCategoryStats(): Map<DetectionCategory, number> {
    return getCategoryStats(this.vault);
  }

  clone(): AliasVaultClass {
    const cloned = new AliasVaultClass();
    cloned.vault = cloneVault(this.vault);
    return cloned;
  }

  getRawVault(): AliasVaultType {
    return this.vault;
  }
}

export { AliasVaultClass as AliasVault };

/**
 * Restoration Engine
 *
 * Restores original values from sanitized text using an alias vault.
 * Only restores known aliases; unknown aliases are left unchanged.
 */

import type { AliasVault, RestorationResult } from '../types/core.js';

/**
 * Restoration options
 */
export interface RestoreOptions {
  /** Alias vault to use for restoration */
  vault: AliasVault;
  /** Whether to throw on unresolved aliases */
  strict?: boolean;
  /** Whether to include unresolved aliases in output metadata */
  includeUnresolved?: boolean;
}

/**
 * Restore original values from sanitized text
 */
export function restore(sanitizedText: string, options: RestoreOptions): RestorationResult {
  const { vault, strict = false, includeUnresolved = true } = options;

  if (!sanitizedText || sanitizedText.length === 0) {
    return createEmptyRestorationResult();
  }

  // Find all aliases in the text: <CATEGORY_NUMBER>
  const aliasPattern = /<[A-Z_]+_\d+>/g;
  const matches = [...sanitizedText.matchAll(aliasPattern)];

  if (matches.length === 0) {
    return {
      restoredText: sanitizedText,
      restored: [],
      unresolved: [],
      complete: true,
    };
  }

  // Process from end to start to preserve indices
  let restoredText = sanitizedText;
  const restored: Array<{ alias: string; original: string }> = [];
  const unresolved: string[] = [];

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i]!;
    const alias = match[0];
    const start = match.index ?? 0;
    const end = start + alias.length;

    const original = vault.reverseMap.get(alias);

    if (original !== undefined) {
      restoredText = restoredText.slice(0, start) + original + restoredText.slice(end);
      restored.push({ alias, original });
    } else if (includeUnresolved) {
      unresolved.push(alias);
      if (strict) {
        throw new Error(`Unresolved alias: ${alias}`);
      }
    }
  }

  // Sort restored by position for consistent output
  restored.sort((a, b) => {
    // Find first occurrence in original sanitized text
    const idxA = sanitizedText.indexOf(a.alias);
    const idxB = sanitizedText.indexOf(b.alias);
    return idxA - idxB;
  });

  return {
    restoredText,
    restored,
    unresolved: includeUnresolved ? unresolved : [],
    complete: unresolved.length === 0,
  };
}

/**
 * Restore multiple texts using the same vault
 */
export function restoreAll(
  texts: ReadonlyArray<string>,
  options: RestoreOptions
): RestorationResult[] {
  return texts.map((text) => restore(text, options));
}

/**
 * Check if text contains any aliases
 */
export function hasAliases(text: string): boolean {
  return /<[A-Z_]+_\d+>/.test(text);
}

/**
 * Find all aliases in text without restoring
 */
export function findAliases(text: string): string[] {
  const pattern = /<[A-Z_]+_\d+>/g;
  return [...text.matchAll(pattern)].map((m) => m[0]);
}

/**
 * Get unresolved aliases in text
 */
export function getUnresolvedAliases(text: string, vault: AliasVault): string[] {
  const aliases = findAliases(text);
  return aliases.filter((alias) => !vault.reverseMap.has(alias));
}

/**
 * Create empty restoration result
 */
function createEmptyRestorationResult(): RestorationResult {
  return {
    restoredText: '',
    restored: [],
    unresolved: [],
    complete: true,
  };
}

/**
 * Validation result for restoration
 */
export interface RestorationValidation {
  /** Whether all aliases were resolved */
  isComplete: boolean;
  /** Number of unresolvable aliases */
  unresolvedCount: number;
  /** Aliases that couldn't be resolved */
  unresolvedAliases: string[];
  /** Total aliases found */
  totalAliases: number;
  /** Successfully restored aliases */
  restoredCount: number;
}

/**
 * Validation result for restoration
 */
export function validateRestoration(text: string, vault: AliasVault): RestorationValidation {
  const aliases = findAliases(text);
  const unresolved = aliases.filter((alias) => !vault.reverseMap.has(alias));

  return {
    isComplete: unresolved.length === 0,
    unresolvedCount: unresolved.length,
    unresolvedAliases: unresolved,
    totalAliases: aliases.length,
    restoredCount: aliases.length - unresolved.length,
  };
}

/**
 * Create a restoration manifest from an alias vault
 * This can be used to share restoration information without exposing original values
 */
export function createRestorationManifest(vault: AliasVault): {
  aliases: ReadonlyArray<{ alias: string; category: string; count: number }>;
  instructions: string;
} {
  const aliases = Array.from(vault.entries.values()).map((entry) => ({
    alias: entry.alias,
    category: entry.category,
    count: entry.replacementCount,
  }));

  return {
    aliases,
    instructions:
      'DebugHalo Restoration Manifest: To restore original values, use the DebugHalo restoration API with the vault and this manifest. Aliases in the sanitized text above can be replaced with their original values using the reverse mapping in the vault. Never share the vault with untrusted parties.',
  };
}

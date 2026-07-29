/**
 * Utility functions for detecting potential secrets in strings
 * This is a simplified example for Phase 1 - actual implementation will come in Phase 2
 */

/**
 * Checks if a string contains patterns that might indicate an API key or token
 * @param input - String to check
 * @returns Object with detection results
 */
export function detectPotentialSecrets(input: string): {
  hasPotentialSecret: boolean;
  patterns: Array<{ pattern: string; matches: string[] }>;
} {
  if (!input || typeof input !== 'string') {
    return { hasPotentialSecret: false, patterns: [] };
  }

  // Common patterns for API keys/tokens (simplified for example)
  const patterns = [
    { pattern: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
    { pattern: 'AWS Secret Key', regex: /(?=.*[+/-])[0-9a-zA-Z+/-]{40}/g },
    { pattern: 'GitHub Token', regex: /ghp_[0-9a-zA-Z]{40}/g },
    { pattern: 'Bearer Token', regex: /Bearer\s+[a-zA-Z0-9\-_.=]+/g },
    {
      pattern: 'Password-like',
      regex: /(?:password|passwd|pwd)["']?\s*[:=]\s*["']([^"']{8,})["']/gi,
    },
  ];

  const results: Array<{ pattern: string; matches: string[] }> = [];

  for (const { pattern, regex } of patterns) {
    const matches = [...input.matchAll(regex)].map((match) => match[0]);
    if (matches.length > 0) {
      results.push({ pattern, matches });
    }
  }

  return {
    hasPotentialSecret: results.length > 0,
    patterns: results,
  };
}

/**
 * Checks if a string looks like it might contain a password
 * @param input - String to check
 * @returns True if password-like pattern is detected
 */
export function looksLikePassword(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  // Simple password pattern detection
  const passwordPattern = /(?:password|passwd|pwd)["']?\s*[:=]\s*["']([^"']{8,})["']/gi;
  return passwordPattern.test(input);
}

/**
 * Redacts potential secrets in a string (placeholder implementation)
 * @param input - String to process
 * @returns String with potential secrets replaced with [REDACTED]
 */
export function redactPotentialSecrets(input: string): string {
  if (!input || typeof input !== 'string') return input;

  // This is a simplified placeholder - real implementation will be more sophisticated
  const { patterns } = detectPotentialSecrets(input);

  if (patterns.length === 0) return input;

  let result = input;
  // Process in reverse order to maintain indices
  for (const { matches } of patterns.slice().reverse()) {
    for (const match of matches) {
      result = result.replace(match, '[REDACTED]');
    }
  }

  return result;
}

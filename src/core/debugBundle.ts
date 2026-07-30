/**
 * Debug Bundle Generator
 *
 * Creates formatted Markdown debug bundles with sanitized content
 * and privacy summary. No secrets are ever included in the bundle.
 */

import type {
  DebugBundleInput,
  DebugBundleOutput,
  DebugBundleMetadata,
  FindingsSummary,
  RestorationManifest,
  SanitizationResult,
} from '../types/core.js';

/**
 * Default bundle template
 */
const DEFAULT_TEMPLATE = `# DebugHalo Bundle

## Sanitized Debug Context

{{SANITIZED_TEXT}}

## Privacy Summary

{{PRIVACY_SUMMARY}}

## Restoration Manifest

{{RESTORATION_MANIFEST}}
`;

/**
 * Generate debug bundle from sanitization result
 */
export function generateDebugBundle(
  input: DebugBundleInput,
  sanitization: SanitizationResult
): DebugBundleOutput {
  const metadata = createBundleMetadata(input, sanitization);
  const bundle = renderBundle(sanitization, metadata);

  return {
    bundle,
    sanitization,
    metadata,
  };
}

/**
 * Create bundle metadata
 */
function createBundleMetadata(
  input: DebugBundleInput,
  sanitization: SanitizationResult
): DebugBundleMetadata {
  const { stats, detections, vault } = sanitization;

  // Create findings summary
  const byCategory: Record<string, number> = {};
  for (const [cat, count] of stats.byCategory) {
    byCategory[cat] = count;
  }

  // Count by confidence
  const highConfidence = detections.filter((d) => d.confidence >= 0.8).length;
  const mediumConfidence = detections.filter(
    (d) => d.confidence >= 0.5 && d.confidence < 0.8
  ).length;
  const lowConfidence = detections.filter((d) => d.confidence < 0.5).length;

  const summary: FindingsSummary = {
    total: stats.totalDetections,
    uniqueValues: stats.uniqueValues,
    byCategory: byCategory as any,
    highConfidence,
    mediumConfidence,
    lowConfidence,
  };

  // Create restoration manifest
  const restorationManifest: RestorationManifest = {
    aliases: Array.from(vault.entries.values()).map((entry) => ({
      alias: entry.alias,
      category: entry.category,
      count: entry.replacementCount,
    })),
    instructions:
      'DebugHalo Restoration Manifest: To restore original values, use the DebugHalo restoration API with the vault and this manifest. ' +
      'Aliases in the sanitized text above can be replaced with their original values ' +
      'using the reverse mapping in the vault. Never share the vault with untrusted parties.',
  };

  return {
    formatVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    source: input.metadata,
    summary,
    restorationManifest,
  };
}

/**
 * Render bundle to Markdown
 */
function renderBundle(sanitization: SanitizationResult, metadata: DebugBundleMetadata): string {
  const { sanitizedText, stats } = sanitization;

  let output = DEFAULT_TEMPLATE;

  // Sanitized text (with reasonable length limit for display)
  const displayText =
    sanitizedText.length > 50000
      ? sanitizedText.slice(0, 50000) + '\n\n... [truncated] ...'
      : sanitizedText;

  // Privacy summary
  const privacyLines = ['| Category | Count |', '|---|---|'];
  if (stats.byCategory.size === 0) {
    privacyLines.push('No sensitive data detected');
  } else {
    for (const [cat, count] of stats.byCategory) {
      privacyLines.push(`| ${cat} | ${count} |`);
    }
    privacyLines.push(
      `| **Total** | **${stats.totalDetections}** |`,
      `| **Unique Values** | **${stats.uniqueValues}** |`
    );
  }

  // Restoration manifest
  const manifestLines = ['| Alias | Category | Replacements |', '|---|---|---|'];
  for (const entry of metadata.restorationManifest.aliases) {
    manifestLines.push(`| \`${entry.alias}\` | ${entry.category} | ${entry.count} |`);
  }

  // Replace template placeholders
  output = output
    .replace('{{SANITIZED_TEXT}}', displayText)
    .replace('{{PRIVACY_SUMMARY}}', privacyLines.join('\n'))
    .replace('{{RESTORATION_MANIFEST}}', manifestLines.join('\n'));

  return output;
}

/**
 * Generate compact bundle (for limited contexts)
 */
export function generateCompactBundle(
  _input: DebugBundleInput,
  sanitization: SanitizationResult
): string {
  const { sanitizedText, stats, vault } = sanitization;

  let output = '# DebugHalo Bundle (Compact)\n\n';
  output += '## Sanitized Context\n\n';
  output +=
    sanitizedText.length > 10000
      ? sanitizedText.slice(0, 10000) + '\n\n... [truncated] ...\n'
      : sanitizedText;
  output += '\n';

  output += '\n## Privacy Summary\n\n';
  for (const [cat, count] of stats.byCategory) {
    output += `- ${cat}: ${count}\n`;
  }
  output += `\nUnique values replaced: ${stats.uniqueValues}\n`;

  output += '\n## Restoration Aliases\n\n';
  for (const entry of vault.entries.values()) {
    output += `- \`${entry.alias}\` (${entry.category}) × ${entry.replacementCount}\n`;
  }

  return output;
}

/**
 * Generate JSON bundle (for programmatic consumption)
 */
export function generateJsonBundle(
  input: DebugBundleInput,
  sanitization: SanitizationResult
): string {
  const metadata = createBundleMetadata(input, sanitization);

  const bundle = {
    format: 'debug-halo-bundle',
    version: '1.0.0',
    metadata,
    sanitizedText: sanitization.sanitizedText,
    // Explicitly no vault or original values
  };

  return JSON.stringify(bundle, null, 2);
}

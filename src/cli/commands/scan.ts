/**
 * Scan Command Implementation
 *
 * Scans files for secrets and PII using DebugHalo core detection API.
 */

import { detectOnly } from '../../core/pipeline.js';
import { discoverFiles, FileDiscoveryError } from '../utils/fileDiscovery.js';
import { readFileSafe } from '../utils/fileReading.js';
import { relative } from 'path';
import chalk from 'chalk';
import type { DetectionCategory, DetectionSeverity } from '../../types/core.js';

export interface ScanFinding {
  file: string;
  category: string;
  confidence: number;
  start: number;
  end: number;
  line?: number;
  column?: number;
  preview?: string;
  detector: string;
  severity: DetectionSeverity;
  reason?: string;
  likelyTestValue: boolean;
}

export interface ScanSummary {
  filesDiscovered: number;
  filesScanned: number;
  filesSkipped: number;
  filesFailed: number;
  findings: number;
}

export interface ScanResult {
  summary: ScanSummary;
  findings: ScanFinding[];
  errors: Array<{ file: string; message: string }>;
}

export interface ScanOptions {
  paths: string[];
  extensions: string[];
  ignorePatterns: string[];
  outputFormat: 'text' | 'json' | 'jsonl' | 'sarif';
  failOnFindings: boolean;
  verbose: boolean;
  cwd?: string;
  minConfidence?: number;
  disabledCategories?: string[];
}

/**
 * Normalize extensions from CLI input (handles "ts", ".ts", "ts,js", ".ts,.js", etc.)
 */
export function normalizeExtensions(input: string[]): string[] {
  const extensions = new Set<string>();
  for (const ext of input) {
    // Split by comma and trim
    const parts = ext.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (part) {
        extensions.add(part.replace(/^\./, '').toLowerCase());
      }
    }
  }
  return Array.from(extensions);
}

/**
 * Normalize ignore patterns from CLI input
 */
export function normalizeIgnorePatterns(input: string[]): string[] {
  const patterns: string[] = [];
  for (const pattern of input) {
    const parts = pattern.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (part) {
        patterns.push(part);
      }
    }
  }
  return patterns;
}

/**
 * Create a redacted preview of a detection that doesn't expose the secret
 */
function createPreview(detection: {
  value: string;
  range: { start: number; end: number };
}): string {
  const val = detection.value;
  if (val.length <= 8) {
    return '[REDACTED]';
  }
  // Show first 2 and last 2 characters, redact the middle
  return `${val.slice(0, 2)}***${val.slice(-2)}`;
}

/**
 * Convert core DetectionResult to CLI ScanFinding
 */
function toScanFinding(
  file: string,
  detection: {
    id: string;
    category: string;
    confidence: number;
    range: { start: number; end: number; startLine: number; startColumn: number };
    value: string;
    detectorName: string;
    severity?: DetectionSeverity;
    reason?: string;
    likelyTestValue?: boolean;
  }
): ScanFinding {
  return {
    file,
    category: detection.category,
    confidence: detection.confidence,
    start: detection.range.start,
    end: detection.range.end,
    line: detection.range.startLine,
    column: detection.range.startColumn,
    preview: createPreview(detection),
    detector: detection.detectorName,
    severity: detection.severity ?? 'medium',
    reason: detection.reason,
    likelyTestValue: detection.likelyTestValue ?? false,
  };
}

/**
 * Run the scan with the given options
 * Throws Error for discovery failures and file read errors that prevent meaningful scan
 */
export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const { paths, extensions, ignorePatterns, cwd } = options;
  const workingDir = cwd ?? process.cwd();

  // Validate output format
  if (!['text', 'json', 'jsonl', 'sarif'].includes(options.outputFormat)) {
    throw new Error(
      `Invalid output format: ${options.outputFormat}. Allowed: text, json, jsonl, sarif`
    );
  }

  const normalizedExtensions = normalizeExtensions(extensions);
  const normalizedIgnore = normalizeIgnorePatterns(ignorePatterns);

  // Discover files
  let discoveredFiles: string[];
  try {
    discoveredFiles = await discoverFiles(paths, {
      cwd: workingDir,
      extensions: normalizedExtensions.length > 0 ? normalizedExtensions : undefined,
      ignorePatterns: normalizedIgnore,
      respectGitignore: true,
    });
  } catch (err) {
    if (err instanceof FileDiscoveryError) {
      // Discovery failed - throw controlled error
      throw new Error(err.message);
    }
    throw err;
  }

  const filesDiscovered = discoveredFiles.length;
  const errors: Array<{ file: string; message: string }> = [];
  const findings: ScanFinding[] = [];
  let filesScanned = 0;
  let filesSkipped = 0;
  let filesFailed = 0;

  for (const filePath of discoveredFiles) {
    // Read file (handles missing/binary/unreadable files)
    const { content, error } = readFileSafe(filePath);
    if (error) {
      errors.push({ file: relative(workingDir, filePath), message: error });
      if (error === 'Binary file skipped') {
        filesSkipped++;
      } else {
        filesFailed++;
      }
      continue;
    }

    // Detect secrets
    try {
      const detections = await detectOnly(content, {
        minConfidence: options.minConfidence ?? 0.5,
        disabledCategories: options.disabledCategories as DetectionCategory[] | undefined,
      });
      filesScanned++;

      for (const detection of detections) {
        const relativePath = relative(workingDir, filePath);
        findings.push(toScanFinding(relativePath, detection));
      }
    } catch (err) {
      errors.push({
        file: relative(workingDir, filePath),
        message: err instanceof Error ? err.message : String(err),
      });
      filesFailed++;
    }
  }

  // Sort findings deterministically: by file, then line, then column
  findings.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    const aLine = a.line ?? 0;
    const bLine = b.line ?? 0;
    if (aLine !== bLine) return aLine - bLine;
    const aCol = a.column ?? 0;
    const bCol = b.column ?? 0;
    return aCol - bCol;
  });

  return {
    summary: {
      filesDiscovered,
      filesScanned,
      filesSkipped,
      filesFailed,
      findings: findings.length,
    },
    findings,
    errors,
  };
}

/**
 * Output scan results in text format
 */
export function outputText(result: ScanResult, verbose: boolean): void {
  const { summary, findings } = result;
  void verbose;

  console.log(chalk.blue('DebugHalo Scan Results'));
  console.log('');

  console.log(chalk.dim(`Scanned ${summary.filesScanned} files`));
  if (summary.filesSkipped > 0) {
    console.log(chalk.yellow(`Skipped ${summary.filesSkipped} binary/unreadable files`));
  }
  if (summary.filesFailed > 0) {
    console.log(chalk.red(`Failed to scan ${summary.filesFailed} files`));
  }
  console.log('');

  if (findings.length === 0) {
    console.log(chalk.green('✓ No potential secrets or PII found'));
    return;
  }

  console.log(chalk.red(`Found ${findings.length} potential secret(s):`));
  console.log('');

  for (const finding of findings) {
    const location =
      finding.line !== undefined && finding.column !== undefined
        ? `${finding.file}:${finding.line}:${finding.column}`
        : finding.file;
    const category = chalk.cyan(finding.category.toUpperCase());
    const confidence = finding.confidence.toFixed(2);
    console.log(
      `  ${chalk.dim(location)}  ${category}  severity=${finding.severity}  confidence=${confidence}`
    );
    if (verbose && finding.reason) console.log(chalk.dim(`    ${finding.reason}`));
  }

  console.log('');
}

/**
 * Output scan results in JSON format
 */
export function outputJson(result: ScanResult): void {
  // JSON output to stdout only
  console.log(JSON.stringify(result, null, 2));
}

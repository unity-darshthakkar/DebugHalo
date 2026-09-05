/**
 * Scan Command Implementation
 *
 * Scans files for secrets and PII using DebugHalo core detection API.
 */

import { detectOnly } from '../../core/pipeline.js';
import {
  discoverFiles,
  FileDiscoveryError,
  isDiscoveryPathIgnored,
} from '../utils/fileDiscovery.js';
import { readBufferSafe, readFileSafeAsync, type FileReadResult } from '../utils/fileReading.js';
import { listStagedFiles } from '../utils/git.js';
import { extname, relative } from 'path';
import { statSync } from 'fs';
import { availableParallelism } from 'os';
import chalk from 'chalk';
import type { DetectionCategory, DetectionSeverity } from '../../types/core.js';
import { mapConcurrent } from '../utils/concurrency.js';
import {
  contentHash,
  loadScanCache,
  scanCachePath,
  scanConfigFingerprint,
  writeScanCache,
  type ScanCacheEntry,
} from '../utils/scanCache.js';

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
  performance?: {
    concurrency: number;
    cacheEnabled: boolean;
    cacheHits: number;
    cacheMisses: number;
  };
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
  staged?: boolean;
  cache?: boolean;
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
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

  let scanInputs: Array<{
    file: string;
    absolutePath?: string;
    read: () => FileReadResult | Promise<FileReadResult>;
  }>;
  if (options.staged) {
    const staged = listStagedFiles(workingDir);
    scanInputs = staged.files
      .filter((file) => {
        const extension = extname(file.path).slice(1).toLowerCase();
        return (
          (normalizedExtensions.length === 0 || normalizedExtensions.includes(extension)) &&
          !isDiscoveryPathIgnored(file.path, staged.root, normalizedIgnore, true)
        );
      })
      .map((file) => ({ file: file.path, read: () => readBufferSafe(file.content) }));
  } else {
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
        throw new Error(err.message);
      }
      throw err;
    }
    scanInputs = discoveredFiles.map((file) => ({
      file: relative(workingDir, file),
      absolutePath: file,
      read: () => readFileSafeAsync(file),
    }));
  }

  const filesDiscovered = scanInputs.length;
  const concurrency = options.concurrency ?? Math.min(availableParallelism(), 4);
  const useCache = options.cache === true && !options.staged;
  const fingerprint = scanConfigFingerprint({
    minConfidence: options.minConfidence ?? 0.5,
    disabledCategories: options.disabledCategories,
  });
  const cachePath = scanCachePath(workingDir);
  const cache = useCache ? loadScanCache(cachePath, fingerprint) : undefined;
  const nextEntries: Record<string, ScanCacheEntry> = {};
  let cacheHits = 0;
  let cacheMisses = 0;

  type Outcome = {
    file: string;
    findings: ScanFinding[];
    error?: string;
    skipped?: boolean;
  };
  const outcomes = await mapConcurrent(
    scanInputs,
    concurrency,
    async (scanInput): Promise<Outcome> => {
      try {
        const { content, error } = await scanInput.read();
        if (error)
          return {
            file: scanInput.file,
            findings: [],
            error,
            skipped: error === 'Binary file skipped',
          };
        let metadata: { size: number; mtimeMs: number; hash: string } | undefined;
        if (useCache && scanInput.absolutePath) {
          const stat = statSync(scanInput.absolutePath);
          metadata = { size: stat.size, mtimeMs: stat.mtimeMs, hash: contentHash(content) };
          const cached = cache!.entries[scanInput.file.replaceAll('\\', '/')];
          if (
            cached &&
            cached.size === metadata.size &&
            cached.mtimeMs === metadata.mtimeMs &&
            cached.hash === metadata.hash
          ) {
            cacheHits++;
            nextEntries[scanInput.file.replaceAll('\\', '/')] = cached;
            return {
              file: scanInput.file,
              findings: cached.findings.map((finding) => ({ ...finding, start: 0, end: 0 })),
            };
          }
          cacheMisses++;
        }
        const detections = await detectOnly(content, {
          minConfidence: options.minConfidence ?? 0.5,
          disabledCategories: options.disabledCategories as DetectionCategory[] | undefined,
        });
        const fileFindings = detections.map((detection) =>
          toScanFinding(scanInput.file, detection)
        );
        if (metadata) {
          nextEntries[scanInput.file.replaceAll('\\', '/')] = {
            ...metadata,
            findings: fileFindings.map((finding) => {
              const { preview, start, end, ...safeFinding } = finding;
              void preview;
              void start;
              void end;
              return safeFinding;
            }),
          };
        }
        return { file: scanInput.file, findings: fileFindings };
      } catch (err) {
        return {
          file: scanInput.file,
          findings: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    options.onProgress
  );

  if (useCache) {
    writeScanCache(cachePath, {
      schemaVersion: cache!.schemaVersion,
      configFingerprint: fingerprint,
      entries: nextEntries,
    });
  }

  const errors = outcomes
    .filter((outcome) => outcome.error)
    .map((outcome) => ({ file: outcome.file, message: outcome.error! }));
  const findings = outcomes.flatMap((outcome) => outcome.findings);
  const filesSkipped = outcomes.filter((outcome) => outcome.skipped).length;
  const filesFailed = outcomes.filter((outcome) => outcome.error && !outcome.skipped).length;
  const filesScanned = outcomes.length - filesSkipped - filesFailed;

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
    performance: { concurrency, cacheEnabled: useCache, cacheHits, cacheMisses },
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

  console.log(chalk.dim(`Discovered: ${summary.filesDiscovered} files`));
  console.log(chalk.dim(`Scanned:    ${summary.filesScanned} files`));
  console.log(chalk.dim(`Skipped:    ${summary.filesSkipped} files`));
  console.log(chalk.dim(`Failed:     ${summary.filesFailed} files`));
  console.log(chalk.dim(`Findings:   ${summary.findings}`));
  if (result.performance?.cacheEnabled) {
    console.log(
      chalk.dim(
        `Cache:      ${result.performance.cacheHits} hits, ${result.performance.cacheMisses} misses`
      )
    );
  }
  console.log('');

  if (findings.length === 0) {
    console.log(chalk.green('✓ No potential secrets or PII found'));
    return;
  }

  console.log(chalk.red(`Found ${findings.length} potential secret(s):`));
  console.log('');

  const severityOrder: DetectionSeverity[] = ['critical', 'high', 'medium', 'low'];
  for (const severity of severityOrder) {
    console.log(
      `${severity[0]!.toUpperCase()}${severity.slice(1)}: ${findings.filter((f) => f.severity === severity).length}`
    );
  }
  const categories = new Map<string, number>();
  for (const finding of findings)
    categories.set(finding.category, (categories.get(finding.category) ?? 0) + 1);
  console.log(
    `Categories: ${[...categories]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, count]) => `${category}=${count}`)
      .join(', ')}`
  );
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

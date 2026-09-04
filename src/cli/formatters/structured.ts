import type { DetectionSeverity } from '../../types/core.js';
import type { ScanFinding, ScanResult } from '../commands/scan.js';

export const STRUCTURED_SCHEMA_VERSION = '1.0';

export interface StructuredFinding {
  file: string;
  category: string;
  detector: string;
  severity: DetectionSeverity;
  confidence: number;
  line?: number;
  column?: number;
  reason?: string;
  likelyTestValue: boolean;
}

export interface StructuredScanResult {
  schemaVersion: typeof STRUCTURED_SCHEMA_VERSION;
  summary: ScanResult['summary'];
  findings: StructuredFinding[];
  errors: ScanResult['errors'];
}

export function toStructuredFinding(finding: ScanFinding): StructuredFinding {
  return {
    file: finding.file.replaceAll('\\', '/'),
    category: finding.category,
    detector: finding.detector,
    severity: finding.severity,
    confidence: finding.confidence,
    ...(finding.line === undefined ? {} : { line: finding.line }),
    ...(finding.column === undefined ? {} : { column: finding.column }),
    ...(finding.reason === undefined ? {} : { reason: finding.reason }),
    likelyTestValue: finding.likelyTestValue,
  };
}

export function toStructuredResult(result: ScanResult): StructuredScanResult {
  return {
    schemaVersion: STRUCTURED_SCHEMA_VERSION,
    summary: result.summary,
    findings: result.findings.map(toStructuredFinding),
    errors: result.errors.map((error) => ({ ...error, file: error.file.replaceAll('\\', '/') })),
  };
}

export function formatJson(result: ScanResult): string {
  return `${JSON.stringify(toStructuredResult(result), null, 2)}\n`;
}

export function formatJsonl(result: ScanResult): string {
  const structured = toStructuredResult(result);
  const records: object[] = [
    ...structured.findings.map((finding) => ({ type: 'finding', ...finding })),
    ...structured.errors.map((error) => ({ type: 'error', ...error })),
    { type: 'summary', schemaVersion: STRUCTURED_SCHEMA_VERSION, ...structured.summary },
  ];
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}

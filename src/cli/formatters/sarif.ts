import type { DetectionSeverity } from '../../types/core.js';
import type { ScanResult } from '../commands/scan.js';
import { toStructuredFinding } from './structured.js';

function levelForSeverity(severity: DetectionSeverity): 'error' | 'warning' | 'note' {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  return 'note';
}

export function formatSarif(result: ScanResult, toolVersion: string): string {
  const findings = result.findings.map(toStructuredFinding);
  const categories = [...new Set(findings.map((finding) => finding.category))].sort();
  const rules = categories.map((category) => {
    const representative = findings.find((finding) => finding.category === category)!;
    return {
      id: `debughalo/${category}`,
      name: category,
      shortDescription: { text: `DebugHalo ${category} detection` },
      defaultConfiguration: { level: levelForSeverity(representative.severity) },
      properties: { category },
    };
  });
  const results = findings.map((finding) => ({
    ruleId: `debughalo/${finding.category}`,
    level: levelForSeverity(finding.severity),
    message: { text: finding.reason ?? `Potential ${finding.category} detected` },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: finding.file },
          region: {
            ...(finding.line === undefined ? {} : { startLine: finding.line }),
            ...(finding.column === undefined ? {} : { startColumn: finding.column }),
          },
        },
      },
    ],
    properties: {
      detector: finding.detector,
      severity: finding.severity,
      confidence: finding.confidence,
      likelyTestValue: finding.likelyTestValue,
    },
  }));
  return `${JSON.stringify(
    {
      version: '2.1.0',
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      runs: [
        {
          tool: { driver: { name: 'DebugHalo', version: toolVersion, rules } },
          results,
          invocations: [
            {
              executionSuccessful: result.summary.filesFailed === 0,
              properties: { summary: result.summary, errors: result.errors },
            },
          ],
        },
      ],
    },
    null,
    2
  )}\n`;
}

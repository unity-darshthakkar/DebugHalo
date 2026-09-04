import { describe, expect, it } from 'vitest';
import type { ScanResult } from '@/cli/commands/scan.js';
import { formatJson, formatJsonl } from '@/cli/formatters/structured.js';
import { formatSarif } from '@/cli/formatters/sarif.js';

const secret = 'AIzaSensitiveValueThatMustNeverAppear';
const result: ScanResult = {
  summary: { filesDiscovered: 2, filesScanned: 1, filesSkipped: 0, filesFailed: 1, findings: 1 },
  findings: [
    {
      file: 'src\\config.ts',
      category: 'google_api_key',
      detector: 'service-credentials',
      severity: 'high',
      confidence: 0.98,
      start: 10,
      end: 48,
      line: 3,
      column: 7,
      reason: 'Matched Google API key prefix and exact length',
      likelyTestValue: false,
      preview: secret,
    },
  ],
  errors: [{ file: 'src\\broken.ts', message: 'Permission denied' }],
};

describe('structured scan formatters', () => {
  it('produces stable secret-free JSON with partial errors', () => {
    const text = formatJson(result);
    const parsed = JSON.parse(text);
    expect(parsed).toMatchObject({
      schemaVersion: '1.0',
      summary: result.summary,
      findings: [{ file: 'src/config.ts', category: 'google_api_key', line: 3, column: 7 }],
      errors: [{ file: 'src/broken.ts', message: 'Permission denied' }],
    });
    expect(parsed.findings[0]).not.toHaveProperty('preview');
    expect(parsed.findings[0]).not.toHaveProperty('start');
    expect(text).not.toContain(secret);
    expect(text).not.toContain('\u001b[');
  });

  it('produces independently parseable JSONL finding, error, and summary records', () => {
    const text = formatJsonl(result);
    const records = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(records.map((record) => record.type)).toEqual(['finding', 'error', 'summary']);
    expect(records[0]).toMatchObject({
      category: 'google_api_key',
      detector: 'service-credentials',
    });
    expect(records[2]).toMatchObject({ schemaVersion: '1.0', findings: 1, filesFailed: 1 });
    expect(text).not.toContain(secret);
    expect(text).not.toContain('\u001b[');
  });

  it('produces deterministic SARIF 2.1.0 rules, locations, levels, and safe messages', () => {
    const text = formatSarif(result, '0.1.0');
    const sarif = JSON.parse(text);
    const run = sarif.runs[0];
    expect(sarif.version).toBe('2.1.0');
    expect(run.tool.driver).toMatchObject({ name: 'DebugHalo', version: '0.1.0' });
    expect(run.tool.driver.rules[0].id).toBe('debughalo/google_api_key');
    expect(run.results).toHaveLength(1);
    expect(run.results[0]).toMatchObject({
      ruleId: 'debughalo/google_api_key',
      level: 'error',
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: 'src/config.ts' },
            region: { startLine: 3, startColumn: 7 },
          },
        },
      ],
    });
    expect(text).not.toContain(secret);
    expect(text).not.toContain('snippet');
  });

  it('produces valid empty JSON, JSONL, and SARIF output', () => {
    const empty: ScanResult = {
      summary: {
        filesDiscovered: 1,
        filesScanned: 1,
        filesSkipped: 0,
        filesFailed: 0,
        findings: 0,
      },
      findings: [],
      errors: [],
    };
    expect(JSON.parse(formatJson(empty)).findings).toEqual([]);
    expect(
      formatJsonl(empty)
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    ).toEqual([{ type: 'summary', schemaVersion: '1.0', ...empty.summary }]);
    const sarif = JSON.parse(formatSarif(empty, '0.1.0'));
    expect(sarif.runs[0].tool.driver.rules).toEqual([]);
    expect(sarif.runs[0].results).toEqual([]);
  });

  it.each([
    ['critical', 'error'],
    ['high', 'error'],
    ['medium', 'warning'],
    ['low', 'note'],
  ] as const)('maps %s severity to SARIF %s', (severity, level) => {
    const variant = { ...result, findings: [{ ...result.findings[0]!, severity }] };
    expect(JSON.parse(formatSarif(variant, '0.1.0')).runs[0].results[0].level).toBe(level);
  });
});

import { describe, it, expect } from 'vitest';
import { generateDebugBundle, generateCompactBundle } from '@/core/debugBundle.js';
import { sanitize } from '@/core/sanitizer.js';
import { createAliasVault } from '@/core/aliasVault.js';
import { detect, createDetectionConfig } from '@/core/detectors.js';
import { resolveOverlaps } from '@/core/detectors.js';
import type { DebugBundleInput, PipelineConfig } from '@/types/core.js';

describe('DebugBundle Tests', () => {
  // Runtime-constructed secret fixtures to avoid GitHub push-protection triggers
  const AWS_ACCESS_KEY = 'AKIA' + 'IOSFODNN7EXAMPLE';
  const AWS_SECRET_KEY = 'wJalrXUtnFEM' + 'I/K7MDENG/bPxRfiCYEXAMPLEKEY';
  const DB_URL = 'postgresql://user:pass@localhost:5432/mydb';
  const STRIPE_LIVE_KEY = 'sk_live_' + 'abcdefghijklmnopqrstuvwx';
  const STRIPE_TEST_KEY = 'sk_test_' + 'abcdefghijklmnopqrstuvwxyz12';
  const GITHUB_TOKEN = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz123456';
  const JWT_TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
    '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const EMAIL = 'user@example.com';

  const sampleInput: DebugBundleInput = {
    rawText: `
=== Debug Log ===
Timestamp: 2024-01-15T10:30:45Z

Environment Variables:
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_KEY}
DATABASE_URL=${DB_URL}
API_KEY=${STRIPE_LIVE_KEY}
GITHUB_TOKEN=${GITHUB_TOKEN}
STRIPE_KEY=${STRIPE_TEST_KEY}

Logs:
2024-01-15 10:30:45 INFO Starting application
2024-01-15 10:30:46 DEBUG Connecting to database at ${DB_URL}
2024-01-15 10:30:47 ERROR Failed to connect: password authentication failed for user "user"
2024-01-15 10:30:48 INFO Sending notification to ${EMAIL}
2024-01-15 10:30:49 DEBUG Making API call to https://api.stripe.com/v1/charges
2024-01-15 10:30:50 WARN Rate limit approached (45/50 requests)

Stack Trace:
Error: Connection failed
    at Database.connect (/app/database.js:45:12)
    at async Application.start (/app/index.js:12:5)
    at async Module._compile (internal/modules/cjs/loader:1158:14)

Config:
{
  "database": {
    "url": "${DB_URL}",
    "poolSize": 10
  },
  "api": {
    "key": "${STRIPE_LIVE_KEY}",
    "timeout": 5000
  },
  "jwtSecret": "${JWT_TOKEN}"
}
`,
    metadata: {
      source: 'debug-log.txt',
      timestamp: '2024-01-15T10:30:45.000Z',
      context: { app: 'myapp', env: 'production' },
    },
    options: {
      minConfidence: 0.5,
      normalizeLineEndings: true,
    },
  };

  it('should generate bundle with sanitized content', () => {
    // First sanitize the input
    const detectionConfig = createDetectionConfig(sampleInput.options as PipelineConfig);
    const detections = resolveOverlaps(detect(sampleInput.rawText, detectionConfig));
    const vault = createAliasVault();
    const sanitization = sanitize(sampleInput.rawText, detections, vault);

    // Generate bundle
    const bundle = generateDebugBundle(sampleInput, sanitization);

    expect(bundle.bundle).toContain('# DebugHalo Bundle');
    expect(bundle.bundle).toContain('Sanitized Debug Context');
    expect(bundle.bundle).toContain('<AWS_ACCESS_KEY_1>');
    expect(bundle.bundle).toContain('<AWS_SECRET_1>');
    expect(bundle.bundle).toContain('<DB_URL_1>');
    expect(bundle.bundle).toContain('<STRIPE_KEY_1>');
    expect(bundle.bundle).toContain('<STRIPE_KEY_2>');
    expect(bundle.bundle).toContain('<GITHUB_TOKEN_1>');
    expect(bundle.bundle).toContain('<JWT_1>');
    expect(bundle.bundle).toContain('<EMAIL_1>');

    // Verify original secrets are NOT in bundle (use runtime vars to avoid push-protection triggers)
    expect(bundle.bundle).not.toContain(AWS_ACCESS_KEY);
    expect(bundle.bundle).not.toContain(AWS_SECRET_KEY);
    expect(bundle.bundle).not.toContain(STRIPE_LIVE_KEY);
    expect(bundle.bundle).not.toContain(GITHUB_TOKEN);
    expect(bundle.bundle).not.toContain(DB_URL);
    expect(bundle.bundle).not.toContain(EMAIL);
  });

  it('should include privacy summary with correct counts', () => {
    const detectionConfig = createDetectionConfig(sampleInput.options as PipelineConfig);
    const detections = resolveOverlaps(detect(sampleInput.rawText, detectionConfig));
    const vault = createAliasVault();
    const sanitization = sanitize(sampleInput.rawText, detections, vault);

    const bundle = generateDebugBundle(sampleInput, sanitization);

    expect(bundle.bundle).toContain('Privacy Summary');
    expect(bundle.metadata.summary.total).toBeGreaterThan(0);
    expect(bundle.metadata.summary.uniqueValues).toBeGreaterThan(0);
    expect(bundle.metadata.summary.byCategory.postgres_url).toBeGreaterThanOrEqual(1);
    expect(bundle.metadata.summary.byCategory.stripe_key).toBeGreaterThanOrEqual(1);
  });

  it('should include restoration manifest', () => {
    const detectionConfig = createDetectionConfig(sampleInput.options as PipelineConfig);
    const detections = resolveOverlaps(detect(sampleInput.rawText, detectionConfig));
    const vault = createAliasVault();
    const sanitization = sanitize(sampleInput.rawText, detections, vault);

    const bundle = generateDebugBundle(sampleInput, sanitization);

    expect(bundle.metadata.restorationManifest.aliases).toHaveLength(vault.entries.size);
    expect(bundle.metadata.restorationManifest.instructions).toContain(
      'DebugHalo Restoration Manifest'
    );
  });

  it('should preserve useful debug context', () => {
    const detectionConfig = createDetectionConfig(sampleInput.options as PipelineConfig);
    const detections = resolveOverlaps(detect(sampleInput.rawText, detectionConfig));
    const vault = createAliasVault();
    const sanitization = sanitize(sampleInput.rawText, detections, vault);

    const bundle = generateDebugBundle(sampleInput, sanitization);

    // Stack trace should be preserved (with JWT replaced)
    expect(bundle.sanitization.sanitizedText).toContain('Database.connect');
    expect(bundle.sanitization.sanitizedText).toContain('Application.start');
    expect(bundle.sanitization.sanitizedText).toContain('Error: Connection failed');

    // Logs should be preserved
    expect(bundle.sanitization.sanitizedText).toContain('Starting application');
    expect(bundle.sanitization.sanitizedText).toContain('Rate limit approached');
  });

  it('should handle metadata correctly', () => {
    const detectionConfig = createDetectionConfig(sampleInput.options as PipelineConfig);
    const detections = resolveOverlaps(detect(sampleInput.rawText, detectionConfig));
    const vault = createAliasVault();
    const sanitization = sanitize(sampleInput.rawText, detections, vault);

    const bundle = generateDebugBundle(sampleInput, sanitization);

    expect(bundle.metadata.source).toEqual(sampleInput.metadata);
    expect(bundle.metadata.formatVersion).toBe('1.0.0');
    expect(new Date(bundle.metadata.generatedAt)).toBeInstanceOf(Date);
  });

  it('should generate compact bundle', () => {
    const detectionConfig = createDetectionConfig(sampleInput.options as PipelineConfig);
    const detections = resolveOverlaps(detect(sampleInput.rawText, detectionConfig));
    const vault = createAliasVault();
    const sanitization = sanitize(sampleInput.rawText, detections, vault);

    const compact = generateCompactBundle(sampleInput, sanitization);

    expect(compact).toContain('DebugHalo Bundle (Compact)');
    expect(compact).toContain('Sanitized Context');
    expect(compact).toContain('Privacy Summary');
    expect(compact).toContain('Restoration Aliases');
    expect(compact.length).toBeLessThan(10000); // compact should be smaller than full bundle
  });
});

describe('Minimal Input Test', () => {
  it('should handle minimal input with no secrets', () => {
    const input: DebugBundleInput = {
      rawText: 'Just a simple log message\nNo secrets here\nTimestamp: 2024-01-15',
      options: { minConfidence: 0.5 },
    };

    const detectionConfig = createDetectionConfig(input.options ?? {});
    const detections = resolveOverlaps(detect(input.rawText, detectionConfig));
    const vault = createAliasVault();
    const sanitization = sanitize(input.rawText, detections, vault);

    const bundle = generateDebugBundle(input, sanitization);

    expect(bundle.bundle).toContain('Just a simple log message');
    expect(bundle.bundle).toContain('No sensitive data detected');
    expect(bundle.metadata.summary.total).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  runPipeline,
  sanitizeText,
  detectOnly,
  quickScan,
  getDetectionStats,
} from '@/core/pipeline.js';

/**
 * Synthetic test value constructors - built at runtime from fragments to avoid
 * triggering secret scanners while preserving detector coverage.
 */
function mkAwsAccessKey(): string {
  return 'AKIA' + 'X'.repeat(16);
}
function mkAwsSecretKey(): string {
  // AWS secret keys require + and / for the entropy check
  return 'x'.repeat(38) + '+/';
}
function mkAwsSessionToken(): string {
  return 'FQoGZXIvYXdzEJr...';
}
function mkDbUrl(): string {
  return (
    'postgresql://admin:' +
    'Pass'.repeat(3) +
    '@db.prod.internal:5432/production_db?sslmode=require'
  );
}
function mkRedisUrl(): string {
  return 'redis://:' + 'Pass'.repeat(3) + '@cache.prod.internal:6379/0';
}
function mkMongoUrl(): string {
  return (
    'mongodb://admin:' +
    'Pass'.repeat(3) +
    '@mongo01.prod.internal:27017,mongo02.prod.internal:27017/mydb?replicaSet=rs0'
  );
}
function mkOpenAIKey(): string {
  return ['sk', 'x'.repeat(48)].join('-');
}
function mkStripeLive(): string {
  return ['sk', 'live'].join('_') + '_' + 'x'.repeat(24);
}
function mkStripeWebhook(): string {
  return ['whsec', 'x'.repeat(32)].join('_');
}
function mkGithubToken(): string {
  // High entropy synthetic token: ghp_ + 36 chars with mixed alnum
  return 'ghp_' + 'aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vWxYz1'.substring(0, 36);
}
function mkSlackBotToken(): string {
  return ['xoxb', '1234567890123', 'x'.repeat(30)].join('-');
}
function mkSlackUserToken(): string {
  return ['xoxp', '1234567890123', '1234567890123', 'x'.repeat(28)].join('-');
}
function mkSendGridKey(): string {
  return 'SG.' + 'x'.repeat(24);
}
function mkTwilioSid(): string {
  return 'AC' + 'x'.repeat(32);
}
function mkTwilioToken(): string {
  return 'x'.repeat(34);
}
function mkJwt(): string {
  return (
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.' +
    'x'.repeat(43)
  );
}
function mkStripeTest(): string {
  return ['sk', 'test'].join('_') + '_' + 'x'.repeat(24);
}
function mkEmail(): string {
  return 'user@example.com';
}
function mkAdminEmail(): string {
  return 'admin@company.internal';
}

describe('Core Pipeline Integration Tests', () => {
  const awsKey = mkAwsAccessKey();
  const awsSecret = mkAwsSecretKey();
  const awsSession = mkAwsSessionToken();
  const dbUrl = mkDbUrl();
  const redisUrl = mkRedisUrl();
  const mongoUrl = mkMongoUrl();
  const openaiKey = mkOpenAIKey();
  const stripeLive = mkStripeLive();
  const stripeWebhook = mkStripeWebhook();
  const githubTok = mkGithubToken();
  const slackBot = mkSlackBotToken();
  const slackUser = mkSlackUserToken();
  const sendgrid = mkSendGridKey();
  const twilioSid = mkTwilioSid();
  const twilioToken = mkTwilioToken();
  const jwt = mkJwt();
  const stripeTest = mkStripeTest();
  const email = mkEmail();
  const adminEmail = mkAdminEmail();

  const realisticDebugLog = `
=== Application Debug Log ===
Date: 2024-01-15T14:32:10.123Z
Environment: production
Node Version: v20.10.0

--- Environment Variables ---
AWS_ACCESS_KEY_ID=${awsKey}
AWS_SECRET_ACCESS_KEY=${awsSecret}
AWS_SESSION_TOKEN=${awsSession}
DATABASE_URL=${dbUrl}
REDIS_URL=${redisUrl}
MONGODB_URI=${mongoUrl}
OPENAI_API_KEY=${openaiKey}
STRIPE_SECRET_KEY=${stripeLive}
STRIPE_WEBHOOK_SECRET=${stripeWebhook}
GITHUB_TOKEN=${githubTok}
SLACK_BOT_TOKEN=${slackBot}
SLACK_USER_TOKEN=${slackUser}
SENDGRID_API_KEY=${sendgrid}
TWILIO_ACCOUNT_SID=${twilioSid}
TWILIO_AUTH_TOKEN=${twilioToken}
JWT_SECRET=${jwt}
API_KEY=${stripeTest}

--- Application Logs ---
2024-01-15 14:32:10 INFO [main] Application starting...
2024-01-15 14:32:11 DEBUG [database] Connecting to ${dbUrl}
2024-01-15 14:32:12 INFO [database] Connection established
2024-01-15 14:32:13 DEBUG [redis] Connecting to ${redisUrl}
2024-01-15 14:32:14 INFO [redis] Connected
2024-01-15 14:32:15 DEBUG [auth] Generating JWT for ${email}
2024-01-15 14:32:16 INFO [api] Calling Stripe API: https://api.stripe.com/v1/customers
2024-01-15 14:32:17 WARN [api] Rate limit: 45/50 requests
2024-01-15 14:32:18 DEBUG [aws] Using credentials: ${awsKey}
2024-01-15 14:32:19 INFO [email] Sending notification to ${adminEmail}
2024-01-15 14:32:20 DEBUG [http] Health check: http://localhost:8080/health
2024-01-15 14:32:21 DEBUG [http] POST https://api.openai.com/v1/chat/completions Authorization: Bearer ${openaiKey}

--- Stack Trace ---
Error: Failed to charge customer
    at StripeService.charge (/app/services/stripe.js:127:15)
    at async PaymentController.process (/app/controllers/payment.js:45:22)
    at async RequestHandler.handle (/app/middleware/request-handler.js:89:5)
    at async Server.<anonymous> (/app/server.js:15:3)
    at Module._compile (internal/modules/cjs/loader:1158:14)

--- HTTP Request ---
POST /api/v1/payments HTTP/1.1
Host: api.example.com
Authorization: Bearer ${jwt}
Content-Type: application/json
X-API-Key: ${stripeTest}

{
  "amount": 1999,
  "currency": "usd",
  "customer": "cus_abcdefghijklmnop",
  "payment_method": "pm_card_visa"
}

--- HTTP Response ---
HTTP/1.1 402 Payment Required
Content-Type: application/json
{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "message": "Your card was declined.",
    "param": "payment_method"
  }
}

--- Configuration ---
database:
  host: db.prod.internal
  port: 5432
  username: admin
  password: ${'Pass'.repeat(3)}
  ssl: true
redis:
  host: cache.prod.internal
  port: 6379
  password: ${'Pass'.repeat(3)}
api:
  stripe:
    secret_key: ${stripeLive}
    webhook_secret: ${stripeWebhook}
  openai:
    api_key: ${openaiKey}
  github:
    token: ${githubTok}
`;

  describe('runPipeline', () => {
    it('should process realistic debug log successfully', async () => {
      const result = await runPipeline(realisticDebugLog, { minConfidence: 0.5 });

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.bundle).toBeDefined();
      expect(result.bundle.bundle).toContain('# DebugHalo Bundle');
      expect(result.bundle.bundle).toContain('<AWS_ACCESS_KEY_1>');
      expect(result.bundle.bundle).toContain('<AWS_SECRET_1>');
      expect(result.bundle.bundle).toContain('<DB_URL_1>');
      expect(result.bundle.bundle).toContain('<REDIS_URL_1>');
      expect(result.bundle.bundle).toContain('<MONGODB_URL_1>');
      expect(result.bundle.bundle).toContain('<OPENAI_KEY_1>');
      expect(result.bundle.bundle).toContain('<STRIPE_KEY_1>');
      expect(result.bundle.bundle).toContain('<GITHUB_TOKEN_1>');
      expect(result.bundle.bundle).toContain('<SLACK_TOKEN_1>');
      expect(result.bundle.bundle).toContain('<JWT_1>');
      expect(result.bundle.bundle).toContain('<EMAIL_1>');
      expect(result.bundle.bundle).toContain('<INTERNAL_URL_1>');

      // Original secrets should NOT be in bundle
      expect(result.bundle.bundle).not.toContain(awsKey);
      expect(result.bundle.bundle).not.toContain(awsSecret);
      expect(result.bundle.bundle).not.toContain('Pass'.repeat(3));
      expect(result.bundle.bundle).not.toContain(stripeLive);
      expect(result.bundle.bundle).not.toContain(stripeTest);
      expect(result.bundle.bundle).not.toContain(githubTok);
      expect(result.bundle.bundle).not.toContain(slackBot);
      expect(result.bundle.bundle).not.toContain(email);
      expect(result.bundle.bundle).not.toContain(adminEmail);
      expect(result.bundle.bundle).not.toContain(dbUrl);
    });

    it('should generate correct privacy summary', async () => {
      const result = await runPipeline(realisticDebugLog, { minConfidence: 0.5 });

      expect(result.bundle.metadata.summary.total).toBeGreaterThan(20);
      expect(result.bundle.metadata.summary.uniqueValues).toBeGreaterThan(15);
      expect(result.bundle.metadata.summary.byCategory.api_key).toBeGreaterThan(0);
      // Database URLs are categorized specifically (postgres_url, redis_url, mongodb_url)
      expect(result.bundle.metadata.summary.byCategory.postgres_url).toBeGreaterThan(0);
      expect(result.bundle.metadata.summary.byCategory.email).toBeGreaterThan(0);
      expect(result.bundle.metadata.summary.byCategory.jwt).toBeGreaterThan(0);
    });

    it('should include restoration manifest', async () => {
      const result = await runPipeline(realisticDebugLog, { minConfidence: 0.5 });

      expect(result.bundle.metadata.restorationManifest.aliases.length).toBe(
        result.bundle.sanitization.vault.entries.size
      );
      expect(result.bundle.metadata.restorationManifest.instructions).toContain(
        'DebugHalo Restoration Manifest'
      );
    });

    it('should be deterministic', async () => {
      const result1 = await runPipeline(realisticDebugLog, { minConfidence: 0.5 });
      const result2 = await runPipeline(realisticDebugLog, { minConfidence: 0.5 });

      expect(result1.bundle.bundle).toBe(result2.bundle.bundle);
      expect(result1.bundle.sanitization.sanitizedText).toBe(
        result2.bundle.sanitization.sanitizedText
      );
    });

    it('should handle empty input gracefully', async () => {
      const result = await runPipeline('', { minConfidence: 0.5 });

      expect(result.success).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should respect minConfidence threshold', async () => {
      const resultHigh = await runPipeline(realisticDebugLog, { minConfidence: 0.9 });
      const resultLow = await runPipeline(realisticDebugLog, { minConfidence: 0.3 });

      expect(resultHigh.bundle.metadata.summary.total).toBeLessThanOrEqual(
        resultLow.bundle.metadata.summary.total
      );
    });
  });

  describe('sanitizeText', () => {
    it('should return sanitization result without bundle', async () => {
      const result = await sanitizeText(realisticDebugLog, { minConfidence: 0.5 });

      expect(result).toHaveProperty('sanitizedText');
      expect(result).toHaveProperty('detections');
      expect(result).toHaveProperty('vault');
      expect(result).toHaveProperty('stats');
      expect(result.sanitizedText).not.toContain(awsKey);
      expect(result.detections.length).toBeGreaterThan(0);
    });

    it('should detect and sanitize AWS access key through sanitizeText pipeline', async () => {
      // Synthetic valid AWS access key (AKIA + 16 chars)
      const awsAccessKey = 'AKIA' + 'X'.repeat(16);
      const input = `AWS_ACCESS_KEY_ID=${awsAccessKey}`;

      const result = await sanitizeText(input, { minConfidence: 0.5 });

      // Should detect exactly one AWS access key
      const awsDetections = result.detections.filter((d) => d.category === 'aws_access_key');
      expect(awsDetections).toHaveLength(1);
      expect(awsDetections[0]!.value).toBe(awsAccessKey);
      expect(awsDetections[0]!.confidence).toBeGreaterThan(0.9);

      // Should be sanitized
      expect(result.sanitizedText).not.toContain(awsAccessKey);
      expect(result.sanitizedText).toContain('<AWS_ACCESS_KEY_1>');
    });

    it('should detect and sanitize mixed-case Auth_Token', async () => {
      const token = 'auth_' + 'x'.repeat(32);
      const input = `Auth_Token="${token}"`;

      const result = await sanitizeText(input, { minConfidence: 0.5 });

      // Should detect exactly one api_key_env
      const authDetections = result.detections.filter((d) => d.category === 'api_key_env');
      expect(authDetections).toHaveLength(1);
      expect(authDetections[0]!.value).toBe(token);

      // Original token should be absent from sanitized output
      expect(result.sanitizedText).not.toContain(token);

      // Surrounding syntax should be preserved
      expect(result.sanitizedText).toContain('Auth_Token="');

      // Replacement alias should be present
      expect(result.sanitizedText).toContain('<API_KEY_ENV_1>');
    });
  });

  describe('detectOnly', () => {
    it('should return detections without sanitizing', async () => {
      const detections = await detectOnly(realisticDebugLog, { minConfidence: 0.5 });

      expect(Array.isArray(detections)).toBe(true);
      expect(detections.length).toBeGreaterThan(0);
      expect(detections[0]).toHaveProperty('category');
      expect(detections[0]).toHaveProperty('value');
      expect(detections[0]).toHaveProperty('confidence');
      expect(detections[0]).toHaveProperty('range');
    });
  });

  describe('getDetectionStats', () => {
    it('should compute correct statistics', async () => {
      const detections = await detectOnly(realisticDebugLog, { minConfidence: 0.5 });
      const stats = getDetectionStats(detections);

      expect(stats.total).toBe(detections.length);
      expect(stats.byCategory.size).toBeGreaterThan(0);
      expect(stats.byConfidence.get('high') ?? 0).toBeGreaterThan(0);
      expect(stats.byConfidence.get('medium') ?? 0).toBeGreaterThan(0);
    });
  });

  describe('quickScan', () => {
    it('should detect secrets in realistic log', () => {
      expect(quickScan(realisticDebugLog)).toBe(true);
    });

    it('should return false for clean text', () => {
      expect(quickScan('Just a normal log message\nNo secrets here')).toBe(false);
    });
  });
});

describe('Full Round-trip Test', () => {
  const rtApiKey = ['sk', 'test'].join('_') + '_1234567890';
  const rtEmail = 'user@example.com';
  const rtJwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.' +
    'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const rtInput = `API_KEY=${rtApiKey}
EMAIL=${rtEmail}
INTERNAL=http://internal.service.local
JWT=${rtJwt}
`;

  it('should restore sanitized text perfectly with correct vault', async () => {
    const result = await runPipeline(rtInput, { minConfidence: 0.5 });

    // Restore using the bundle's vault
    const restored = await import('@/core/restorer.js').then((m) =>
      m.restore(result.bundle.sanitization.sanitizedText, {
        vault: result.bundle.sanitization.vault,
      })
    );

    expect(restored.restoredText).toBe(rtInput);
    expect(restored.complete).toBe(true);
    expect(restored.unresolved).toHaveLength(0);
  });

  it('should fail to restore with wrong vault', async () => {
    const wrongInput = `API_KEY=${['sk', 'test'].join('_')}_123`;
    const result = await runPipeline(wrongInput, { minConfidence: 0.5 });

    // Create different vault
    const { createAliasVault } = await import('@/core/aliasVault.js');
    const wrongVault = createAliasVault();

    const restored = await import('@/core/restorer.js').then((m) =>
      m.restore(result.bundle.sanitization.sanitizedText, {
        vault: wrongVault,
        strict: false,
      })
    );

    expect(restored.complete).toBe(false);
    expect(restored.unresolved.length).toBeGreaterThan(0);
  });
});

describe('Edge Cases', () => {
  it('should handle very long input', async () => {
    const longInput = `API_KEY=${['sk', 'test'].join('_')}_123\n`.repeat(1000);
    const result = await runPipeline(longInput, { minConfidence: 0.5, maxInputSize: 1000000 });

    expect(result.success).toBe(true);
    expect(result.bundle.metadata.summary.total).toBeGreaterThan(0);
  });

  it('should handle Unicode text', async () => {
    const unicodeInput = `
Message: こんにちは World 🌍
API_KEY=${['sk', 'test'].join('_')}_テスト_密鑰
EMAIL=用户@例子.测试
`;

    const result = await runPipeline(unicodeInput, { minConfidence: 0.5 });

    expect(result.success).toBe(true);
    expect(result.bundle.sanitization.sanitizedText).toContain('こんにちは');
    expect(result.bundle.sanitization.sanitizedText).toContain('🌍');
  });

  it('should handle mixed line endings', async () => {
    const mixedInput = 'KEY1=value1\r\nKEY2=value2\nKEY3=value3\rKEY4=value4';

    const result = await runPipeline(mixedInput, { minConfidence: 0.5 });

    expect(result.success).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { sanitizeText, scanText } from '@/browser/index.js';

const googleKey = `AIza${'Ab3_'.repeat(8)}Ab3`;

describe('browser core boundary', () => {
  it('returns structured findings from the shared detector pipeline', async () => {
    const [finding] = await scanText(`const apiKey = '${googleKey}';`);

    expect(finding).toMatchObject({
      category: 'google_api_key',
      severity: 'high',
      detectorName: 'service-credential-detector',
      likelyTestValue: false,
    });
    expect(finding?.confidence).toBeGreaterThanOrEqual(0.5);
    expect(finding?.reason).toBeTruthy();
  });

  it('uses the shared sanitization and alias logic without persistent storage', async () => {
    const result = await sanitizeText(`key=${googleKey}`);

    expect(result.sanitizedText).toBe('key=<GOOGLE_API_KEY_1>');
    expect(result.detections).toHaveLength(1);
  });
});

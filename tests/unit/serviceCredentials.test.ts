import { describe, expect, it } from 'vitest';
import { detectOnly, sanitizeText } from '@/core/pipeline.js';

const cases = [
  ['openai_key', `sk-proj-${'Ab3_'.repeat(10)}`],
  ['anthropic_key', `sk-ant-${'An7_'.repeat(12)}`],
  ['stripe_key', 'sk_live_' + 'ABCDEF123456ABCDEF123456ABCDEF'],
  ['stripe_webhook_secret', 'whsec_A1b2C3d4E5f6G7h8I9j0K1l2M3n4'],
  ['google_api_key', `AIza${'Ab3_'.repeat(8)}Ab3`],
  ['gitlab_token', `glpat-${'Ab3_'.repeat(6)}`],
  ['discord_token', `M${'Ab3'.repeat(8).slice(0, 23)}.${'aB3_-x'.slice(0, 6)}.${'Cd4_'.repeat(8)}`],
  ['twilio_api_key', `SK${'a1b2c3d4'.repeat(4)}`],
  ['sendgrid_api_key', `SG.${'Ab3_'.repeat(5)}Ab.${'Cd4_'.repeat(10)}Cd4`],
] as const;

const nearMisses = [
  'AIzaAb3_Ab3_Ab3_Ab3_Ab3_Ab3_Ab3_Ab3_Ab',
  'glpat-short',
  'Mabc.def.ghi',
  `SK${'a1b2c3d4'.repeat(3)}`,
  `SG.${'Ab3_'.repeat(5)}A.${'Cd4_'.repeat(10)}Cd4`,
  'whsec_short',
  'OAUTH_CLIENT_SECRET=short',
  'AZURE_CLIENT_SECRET=short',
];

describe('service credential detectors', () => {
  for (const [category, value] of cases) {
    it(`detects ${category} and assigns severity`, async () => {
      const detections = await detectOnly(`credential = "${value}"`);
      const detection = detections.find((item) => item.category === category);
      expect(detection).toMatchObject({ category, likelyTestValue: false });
      expect(detection?.severity).toMatch(/^(critical|high)$/);
      expect(detection?.reason).toBeTruthy();
    });
  }

  it('detects contextual OAuth and Azure client secrets', async () => {
    const oauth = await detectOnly(`OAUTH_CLIENT_SECRET=${'aB3_'.repeat(8)}`);
    const azure = await detectOnly(`AZURE_CLIENT_SECRET=${'zY7_'.repeat(8)}`);
    expect(oauth.some((item) => item.category === 'oauth_client_secret')).toBe(true);
    expect(azure.some((item) => item.category === 'azure_client_secret')).toBe(true);
  });

  it('rejects malformed and obvious placeholder values', async () => {
    for (const value of nearMisses) {
      expect(await detectOnly(value)).toHaveLength(0);
    }
    expect(await detectOnly('key = "sk-proj-short"')).toHaveLength(0);
    expect(
      (await detectOnly(`key = "glpat-example-placeholder-value"`)).some(
        (item) => item.category === 'gitlab_token'
      )
    ).toBe(false);
  });

  it('supports inline all-category and category-specific suppression', async () => {
    const google = `AIza${'Ab3_'.repeat(8)}Ab3`;
    expect(await detectOnly(`const key = '${google}'; // debughalo-ignore`)).toHaveLength(0);
    expect(
      await detectOnly(`// debughalo-ignore-next-line google_api_key\nconst key = '${google}';`)
    ).toHaveLength(0);
    expect(
      (await detectOnly(`const key = '${google}'; // debughalo-ignore email`)).some(
        (item) => item.category === 'google_api_key'
      )
    ).toBe(true);
    expect(await detectOnly(`GOOGLE_KEY='${google}' # debughalo-ignore`)).toHaveLength(0);
    expect(
      await detectOnly(`# debughalo-ignore-next-line google_api_key\nGOOGLE_KEY='${google}'`)
    ).toHaveLength(0);
  });

  it('does not treat suppression text inside strings or data as a directive', async () => {
    const google = `AIza${'Ab3_'.repeat(8)}Ab3`;
    const sameLine = await detectOnly(
      `const note = '// debughalo-ignore'; const key = '${google}';`
    );
    const nextLine = await detectOnly(
      `const note = '# debughalo-ignore-next-line google_api_key';\nconst key = '${google}';`
    );

    expect(sameLine.some((item) => item.category === 'google_api_key')).toBe(true);
    expect(nextLine.some((item) => item.category === 'google_api_key')).toBe(true);
  });

  it('marks realistic credentials in fixture context without suppressing them', async () => {
    const google = `AIza${'Ab3_'.repeat(8)}Ab3`;
    const detections = await detectOnly(`const fixture = '${google}';`);
    expect(detections.find((item) => item.category === 'google_api_key')?.likelyTestValue).toBe(
      true
    );
  });

  it('enforces disabled categories and confidence thresholds', async () => {
    const google = `AIza${'Ab3_'.repeat(8)}Ab3`;
    expect(await detectOnly(google, { disabledCategories: ['google_api_key'] })).toHaveLength(0);
    expect(await detectOnly(google, { minConfidence: 1 })).toHaveLength(0);
  });

  it('sanitizes with the service-specific category alias', async () => {
    const key = `AIza${'Ab3_'.repeat(8)}Ab3`;
    const result = await sanitizeText(`key=${key}`);
    expect(result.sanitizedText).toContain('<GOOGLE_API_KEY_1>');
    expect(result.detections[0]?.category).toBe('google_api_key');
  });
});

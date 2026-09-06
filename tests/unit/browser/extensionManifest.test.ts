import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('browser extension manifest', () => {
  it('limits its Manifest V3 content script and host access to ChatGPT', () => {
    const manifest = JSON.parse(readFileSync(resolve('extension/manifest.json'), 'utf8'));
    const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

    expect(manifest).toMatchObject({
      manifest_version: 3,
      name: 'DebugHalo',
      version: packageJson.version,
      action: { default_popup: 'popup.html' },
    });
    expect(manifest.permissions).toBeUndefined();
    expect(manifest.host_permissions).toEqual([
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
    ]);
    expect(manifest.content_scripts).toEqual([
      {
        matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
        js: ['chatgpt.js'],
        run_at: 'document_start',
      },
      {
        matches: ['https://claude.ai/*'],
        js: ['claude.js'],
        run_at: 'document_start',
      },
      {
        matches: ['https://gemini.google.com/*'],
        js: ['gemini.js'],
        run_at: 'document_start',
      },
    ]);
    expect(JSON.stringify(manifest)).not.toContain('<all_urls>');
    expect(manifest.background).toBeUndefined();
  });
});

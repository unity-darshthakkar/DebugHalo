import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('browser extension manifest', () => {
  it('is a permission-free Manifest V3 popup shell synchronized with the package version', () => {
    const manifest = JSON.parse(readFileSync(resolve('extension/manifest.json'), 'utf8'));
    const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

    expect(manifest).toMatchObject({
      manifest_version: 3,
      name: 'DebugHalo',
      version: packageJson.version,
      action: { default_popup: 'popup.html' },
    });
    expect(manifest.permissions).toBeUndefined();
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.background).toBeUndefined();
  });
});

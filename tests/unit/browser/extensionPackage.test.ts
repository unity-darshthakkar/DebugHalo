import { describe, expect, it } from 'vitest';
// @ts-expect-error The dependency-free release script is intentionally plain JavaScript.
import { RUNTIME_FILES, createZip } from '../../../scripts/package-extension.mjs';

describe('extension release package', () => {
  it('contains exactly the runtime files and excludes source maps', () => {
    expect(RUNTIME_FILES).toEqual([
      'manifest.json',
      'popup.html',
      'popup.css',
      'popup.js',
      'background.js',
      'chatgpt.js',
      'claude.js',
      'gemini.js',
    ]);
    expect(RUNTIME_FILES.every((name: string) => !name.endsWith('.map'))).toBe(true);
  });

  it('creates deterministic ZIP bytes with sorted portable entry names', () => {
    const entries = [
      { name: 'z.js', data: Buffer.from('last') },
      { name: 'folder\\a.js', data: Buffer.from('first') },
    ];
    const first = createZip(entries);
    const second = createZip(entries);

    expect(first.equals(second)).toBe(true);
    expect(first.readUInt32LE(0)).toBe(0x04034b50);
    expect(first.toString('utf8')).toContain('folder/a.js');
    expect(first.indexOf(Buffer.from('folder/a.js'))).toBeLessThan(
      first.indexOf(Buffer.from('z.js'))
    );
    expect(first.readUInt32LE(first.length - 22)).toBe(0x06054b50);
  });
});

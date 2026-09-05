import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { discoverFiles } from '@/cli/utils/fileDiscovery.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('scan symlink discovery', () => {
  it('does not traverse file, directory, broken, or looping symlinks during directory discovery', async ({
    skip,
  }) => {
    const root = mkdtempSync(join(tmpdir(), 'debughalo-symlinks-'));
    const external = mkdtempSync(join(tmpdir(), 'debughalo-symlink-target-'));
    roots.push(root, external);
    mkdirSync(join(root, 'real'));
    writeFileSync(join(root, 'real', 'target.ts'), 'const clean = true;');
    writeFileSync(join(external, 'unique-through-link.ts'), 'const linked = true;');
    try {
      symlinkSync(join(root, 'real', 'target.ts'), join(root, 'file-link.ts'), 'file');
      symlinkSync(external, join(root, 'directory-link'), 'dir');
      symlinkSync(join(root, 'missing'), join(root, 'broken-link.ts'), 'file');
      symlinkSync(root, join(root, 'real', 'loop'), 'dir');
    } catch {
      skip();
      return;
    }
    const files = await discoverFiles([root], { cwd: root, extensions: ['ts'] });
    expect(files).toEqual([join(root, 'real', 'target.ts')]);
    const globFiles = await discoverFiles(['**/*.ts'], { cwd: root, extensions: ['ts'] });
    expect(globFiles).toEqual([join(root, 'real', 'target.ts')]);
    expect(files.some((file) => file.includes('unique-through-link.ts'))).toBe(false);
    expect(globFiles.some((file) => file.includes('unique-through-link.ts'))).toBe(false);
    await expect(
      discoverFiles([join(root, 'file-link.ts')], { cwd: root, extensions: ['ts'] })
    ).resolves.toEqual([join(root, 'file-link.ts')]);
    await expect(
      discoverFiles([join(root, 'directory-link')], { cwd: root, extensions: ['ts'] })
    ).rejects.toThrow('No valid input paths found');
    await expect(
      discoverFiles([join(root, 'broken-link.ts')], { cwd: root, extensions: ['ts'] })
    ).rejects.toThrow('No valid input paths found');
  });
});

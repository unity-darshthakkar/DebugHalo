import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const extensionRoot = resolve(projectRoot, 'extension');
const outputDirectory = resolve(extensionRoot, 'dist');

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const commonOptions = {
  bundle: true,
  platform: 'browser',
  target: 'chrome120',
  sourcemap: true,
  logLevel: 'info',
};

await build({
  ...commonOptions,
  entryPoints: [resolve(extensionRoot, 'src', 'popup', 'index.ts')],
  outfile: resolve(outputDirectory, 'popup.js'),
  format: 'esm',
});

await build({
  ...commonOptions,
  entryPoints: [resolve(extensionRoot, 'src', 'content', 'chatgpt.ts')],
  outfile: resolve(outputDirectory, 'chatgpt.js'),
  format: 'iife',
});

for (const file of ['manifest.json', 'popup.html', 'popup.css']) {
  cpSync(resolve(extensionRoot, file), resolve(outputDirectory, file));
}

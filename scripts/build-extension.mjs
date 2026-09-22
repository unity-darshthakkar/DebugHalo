import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const extensionRoot = resolve(projectRoot, 'extension');
const outputDirectory = resolve(extensionRoot, 'dist');
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(resolve(extensionRoot, 'manifest.json'), 'utf8'));

if (manifest.version !== packageJson.version) {
  throw new Error(
    `Extension manifest version ${manifest.version} does not match package version ${packageJson.version}.`
  );
}

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
  entryPoints: [resolve(extensionRoot, 'src', 'background', 'index.ts')],
  outfile: resolve(outputDirectory, 'background.js'),
  format: 'esm',
});

for (const site of ['chatgpt', 'claude', 'gemini']) {
  await build({
    ...commonOptions,
    entryPoints: [resolve(extensionRoot, 'src', 'content', `${site}.ts`)],
    outfile: resolve(outputDirectory, `${site}.js`),
    format: 'iife',
  });
}

for (const file of ['manifest.json', 'popup.html', 'popup.css']) {
  cpSync(resolve(extensionRoot, file), resolve(outputDirectory, file));
}

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const smokeRoot = mkdtempSync(join(tmpdir(), 'debug-halo-packed-install-'));
const installRoot = join(smokeRoot, 'consumer');

try {
  execFileSync('npm', ['run', 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: isWindows(),
  });
  const packOutput = execFileSync('npm', ['pack', '--json', '--pack-destination', smokeRoot], {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: isWindows(),
  });
  const [packResult] = JSON.parse(packOutput);
  if (!packResult) throw new Error('npm pack returned no package result');
  validatePackedFiles(packResult.files.map((file) => file.path));

  writeFileSync(
    join(smokeRoot, 'package-summary.json'),
    JSON.stringify(
      {
        filename: packResult.filename,
        size: packResult.size,
        unpackedSize: packResult.unpackedSize,
        entryCount: packResult.entryCount,
      },
      null,
      2
    )
  );

  mkdirSync(installRoot, { recursive: true });
  writeFileSync(
    join(installRoot, 'package.json'),
    JSON.stringify({ name: 'debug-halo-smoke-consumer', private: true, type: 'module' }),
    'utf8'
  );
  execFileSync(
    'npm',
    [
      'install',
      '--prefer-offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--prefix',
      installRoot,
      join(smokeRoot, packResult.filename),
    ],
    { cwd: smokeRoot, stdio: 'inherit', shell: isWindows() }
  );

  const packageRoot = join(installRoot, 'node_modules', 'debug-halo');
  const binPath = join(
    installRoot,
    'node_modules',
    '.bin',
    isWindows() ? 'debug-halo.cmd' : 'debug-halo'
  );
  assert(existsSync(binPath), 'installed CLI executable is missing');

  const version = run(binPath, ['--version']);
  assert(version.status === 0 && version.stdout.includes('0.1.0'), '--version failed');

  const help = run(binPath, ['--help']);
  assert(help.status === 0 && help.stdout.includes('Usage:'), '--help failed');

  const scanTarget = join(installRoot, 'clean.ts');
  writeFileSync(scanTarget, 'const value = 42;\n', 'utf8');
  const scan = run(binPath, ['scan', scanTarget]);
  assert(scan.status === 0 && scan.stdout.includes('No potential secrets'), 'scan failed');

  const apiImport = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "import { CORE_VERSION } from 'debug-halo'; process.stdout.write(CORE_VERSION);",
    ],
    { cwd: installRoot, encoding: 'utf8' }
  );
  assert(apiImport === '0.2.0', 'public ESM API import failed');

  const typeEntry = join(packageRoot, 'dist', 'core', 'index.d.ts');
  assert(existsSync(typeEntry), 'public TypeScript declaration entrypoint is missing');
  writeFileSync(
    join(installRoot, 'consumer.ts'),
    "import { CORE_VERSION } from 'debug-halo';\nconst version: string = CORE_VERSION;\n",
    'utf8'
  );
  writeFileSync(
    join(installRoot, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', noEmit: true },
    }),
    'utf8'
  );
  execFileSync(
    process.execPath,
    [join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'],
    { cwd: installRoot, stdio: 'inherit' }
  );

  console.log(
    `Packed-install smoke passed: ${packResult.entryCount} files, ${packResult.size} bytes packed, ${packResult.unpackedSize} bytes unpacked`
  );
} finally {
  rmSync(smokeRoot, { recursive: true, force: true });
}

function validatePackedFiles(files) {
  const required = [
    'package.json',
    'README.md',
    'LICENSE',
    'dist/core/index.js',
    'dist/core/index.d.ts',
    'dist/cli/index.js',
  ];
  for (const path of required) assert(files.includes(path), `packed file is missing: ${path}`);

  const forbidden = [
    /^tests\//,
    /^dist\/tests\//,
    /^dist\/src\//,
    /^coverage\//,
    /(^|\/)\.claude\//,
    /(^|\/)\.codex\//,
    /vitest\.config/,
    /\.tgz$/,
  ];
  for (const path of files) {
    assert(!forbidden.some((pattern) => pattern.test(path)), `unexpected packed file: ${path}`);
  }
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: installRoot,
    encoding: 'utf8',
    shell: isWindows(),
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isWindows() {
  return process.platform === 'win32';
}

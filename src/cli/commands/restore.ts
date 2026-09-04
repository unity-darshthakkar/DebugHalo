import chalk from 'chalk';
import { relative } from 'path';
import { restore } from '../../core/restorer.js';
import {
  assertSafeVaultPath,
  loadPersistentVault,
  resolveVaultPath,
} from '../../core/persistentVault.js';
import { discoverFiles, FileDiscoveryError } from '../utils/fileDiscovery.js';
import { readFileSafe } from '../utils/fileReading.js';
import { assertNotSymbolicLink, atomicWriteFile } from '../utils/atomicWrite.js';

export interface RestoreResult {
  filesDiscovered: number;
  filesProcessed: number;
  filesChanged: number;
  filesFailed: number;
  aliasesRestored: number;
  unresolvedAliases: number;
  errors: Array<{ file: string; message: string }>;
}

export async function runRestore(options: {
  paths: string[];
  cwd?: string;
  dryRun?: boolean;
  vaultPath?: string;
}): Promise<RestoreResult> {
  const cwd = options.cwd ?? process.cwd();
  const vaultPath = resolveVaultPath(options.vaultPath || undefined, cwd);
  assertSafeVaultPath(vaultPath, cwd);
  const vault = loadPersistentVault(vaultPath);
  let files: string[];
  try {
    files = await discoverFiles(options.paths, { cwd, respectGitignore: false });
  } catch (error) {
    if (error instanceof FileDiscoveryError) throw new Error(error.message);
    throw error;
  }
  const result: RestoreResult = {
    filesDiscovered: files.length,
    filesProcessed: 0,
    filesChanged: 0,
    filesFailed: 0,
    aliasesRestored: 0,
    unresolvedAliases: 0,
    errors: [],
  };
  for (const file of files) {
    const display = relative(cwd, file);
    try {
      assertNotSymbolicLink(file);
      const read = readFileSafe(file);
      if (read.error) throw new Error(read.error);
      const restored = restore(read.content, { vault });
      const changed = restored.restoredText !== read.content;
      if (changed && !options.dryRun) atomicWriteFile(file, restored.restoredText);
      result.filesProcessed += 1;
      if (changed) result.filesChanged += 1;
      result.aliasesRestored += restored.restored.length;
      result.unresolvedAliases += restored.unresolved.length;
    } catch (error) {
      result.filesFailed += 1;
      result.errors.push({
        file: display,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}

export function outputRestoreText(result: RestoreResult, dryRun: boolean): void {
  console.log(chalk.blue('DebugHalo Restore Results'));
  if (dryRun) console.log(chalk.dim('[DRY RUN] No files were modified'));
  console.log(chalk.dim(`Processed: ${result.filesProcessed} file(s)`));
  console.log(
    chalk.green(`${dryRun ? 'Would restore' : 'Restored'}: ${result.filesChanged} file(s)`)
  );
  console.log(chalk.dim(`Aliases restored: ${result.aliasesRestored}`));
  if (result.unresolvedAliases > 0) {
    console.log(chalk.yellow(`Unknown aliases left unchanged: ${result.unresolvedAliases}`));
  }
}

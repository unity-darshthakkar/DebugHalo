import chalk from 'chalk';
import { getHookStatus, installHook, uninstallHook, type HookStatus } from '../utils/git.js';

export type HookAction = 'install' | 'uninstall' | 'status';

export function runHook(action: HookAction, cwd = process.cwd()): HookStatus {
  if (action === 'install') return installHook(cwd);
  if (action === 'uninstall') return uninstallHook(cwd);
  return getHookStatus(cwd);
}

export function outputHookStatus(action: HookAction, status: HookStatus): void {
  if (action === 'install') console.log(chalk.green('DebugHalo pre-commit hook installed'));
  else if (action === 'uninstall') {
    console.log(
      status.state === 'conflict'
        ? chalk.yellow('Existing non-DebugHalo pre-commit hook was left unchanged')
        : chalk.green('DebugHalo pre-commit hook is not installed')
    );
  } else {
    console.log(
      status.state === 'installed'
        ? chalk.green('DebugHalo pre-commit hook is active')
        : status.state === 'conflict'
          ? chalk.yellow('A non-DebugHalo pre-commit hook is present')
          : chalk.dim('DebugHalo pre-commit hook is not installed')
    );
  }
  console.log(chalk.dim(`Hooks path: ${status.hookPath}`));
}

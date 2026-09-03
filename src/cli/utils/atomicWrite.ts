/**
 * Same-directory atomic replacement for sanitized regular files.
 */

import {
  chmodSync,
  closeSync,
  fsyncSync,
  lstatSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { randomUUID } from 'crypto';
import { dirname, join } from 'path';

const TEMP_FILE_PREFIX = '.debughalo-atomic-';

export interface AtomicWriteOperations {
  lstat: typeof lstatSync;
  open: typeof openSync;
  write: typeof writeFileSync;
  sync: typeof fsyncSync;
  close: typeof closeSync;
  chmod: typeof chmodSync;
  rename: typeof renameSync;
  unlink: typeof unlinkSync;
}

interface AtomicWriteOptions {
  operations?: AtomicWriteOperations;
  createId?: () => string;
}

const defaultOperations: AtomicWriteOperations = {
  lstat: lstatSync,
  open: openSync,
  write: writeFileSync,
  sync: fsyncSync,
  close: closeSync,
  chmod: chmodSync,
  rename: renameSync,
  unlink: unlinkSync,
};

export function assertNotSymbolicLink(filePath: string): void {
  if (lstatSync(filePath).isSymbolicLink()) {
    throw new Error('Refusing to sanitize symbolic link');
  }
}

export function atomicWriteFile(
  filePath: string,
  content: string,
  options: AtomicWriteOptions = {}
): void {
  const operations = options.operations ?? defaultOperations;
  const destination = operations.lstat(filePath);
  if (destination.isSymbolicLink()) {
    throw new Error('Refusing to sanitize symbolic link');
  }
  if (!destination.isFile()) {
    throw new Error('Refusing to sanitize non-regular file');
  }

  const tempPath = join(
    dirname(filePath),
    `${TEMP_FILE_PREFIX}${process.pid}-${(options.createId ?? randomUUID)()}.tmp`
  );
  let descriptor: number | undefined;
  let tempExists = false;
  const destinationMode = destination.mode & 0o7777;

  try {
    descriptor = operations.open(tempPath, 'wx', destinationMode);
    tempExists = true;
    operations.write(descriptor, content, { encoding: 'utf8' });
    operations.sync(descriptor);
    operations.close(descriptor);
    descriptor = undefined;

    operations.chmod(tempPath, destinationMode);

    if (operations.lstat(filePath).isSymbolicLink()) {
      throw new Error('Refusing to sanitize symbolic link');
    }

    // Node maps this to the platform rename/replace primitive. In particular,
    // no unlink-first fallback is used because that would lose atomicity.
    operations.rename(tempPath, filePath);
    tempExists = false;
  } finally {
    if (descriptor !== undefined) {
      try {
        operations.close(descriptor);
      } catch {
        // Preserve the original failure; cleanup continues below.
      }
    }
    if (tempExists) {
      try {
        operations.unlink(tempPath);
      } catch {
        // Preserve the operation failure rather than masking it with cleanup.
      }
    }
  }
}

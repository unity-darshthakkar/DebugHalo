/**
 * Shared File Reading Utility
 *
 * Provides safe, bounded file reading for CLI commands.
 * Avoids loading entire files into memory before determining if they should be processed.
 */

import { openSync, readSync, closeSync, statSync } from 'fs';
import { StringDecoder } from 'string_decoder';
import { MAX_INPUT_SIZE } from '../../core/index.js';

/**
 * Maximum bytes to read for binary detection.
 * Reads only enough to reliably detect NUL bytes without loading entire file.
 */
const BINARY_DETECTION_SAMPLE_SIZE = 8192; // 8 KiB
const FILE_READ_CHUNK_SIZE = 64 * 1024;

/**
 * Result of file reading operation.
 */
export interface FileReadResult {
  /** File content as UTF-8 string (empty if binary or error) */
  content: string;
  /** Error message if reading failed or file is binary */
  error?: string;
  /** Whether the file was detected as binary */
  isBinary: boolean;
}

export function readBufferSafe(
  buffer: Buffer,
  maxInputSize: number = MAX_INPUT_SIZE
): FileReadResult {
  if (buffer.subarray(0, BINARY_DETECTION_SAMPLE_SIZE).includes(0)) {
    return { content: '', error: 'Binary file skipped', isBinary: true };
  }
  if (buffer.length > maxInputSize) {
    return {
      content: '',
      error: `File exceeds maximum size of ${maxInputSize} bytes`,
      isBinary: false,
    };
  }
  return { content: buffer.toString('utf8'), isBinary: false };
}

interface FileReadOptions {
  maxInputSize?: number;
  chunkSize?: number;
  onChunkRead?: (bytesRead: number) => void;
}

/**
 * Checks if a file appears to be binary by reading a bounded prefix.
 * Does NOT read the entire file - only samples the first BINARY_DETECTION_SAMPLE_SIZE bytes.
 *
 * @param filePath - Path to the file to check
 * @returns true if file contains NUL byte in sampled region, false otherwise
 */
export function isBinaryFile(filePath: string): boolean {
  try {
    const stats = statSync(filePath);

    // Handle empty files
    if (stats.size === 0) {
      return false;
    }

    // Read only the sample size or file size, whichever is smaller
    const sampleSize = Math.min(stats.size, BINARY_DETECTION_SAMPLE_SIZE);
    const buffer = Buffer.alloc(sampleSize);

    // Use a file descriptor to read exact number of bytes
    const fd = openSync(filePath, 'r');
    try {
      const bytesRead = readSync(fd, buffer, 0, sampleSize, 0);
      return buffer.subarray(0, bytesRead).includes(0);
    } finally {
      closeSync(fd);
    }
  } catch {
    // If we can't stat/read the file, treat as non-binary (will error later)
    return false;
  }
}

/**
 * Safely reads a file as UTF-8 text.
 * - Returns error for binary files (detected via bounded sample)
 * - Returns error for unreadable/missing files
 * - Returns error for files exceeding the maximum input size
 * - Retains complete content only for confirmed text files within the limit
 *
 * @param filePath - Path to the file to read
 * @returns FileReadResult with content or error
 */
export function readFileSafe(filePath: string, options: FileReadOptions = {}): FileReadResult {
  const maxInputSize = options.maxInputSize ?? MAX_INPUT_SIZE;
  const chunkSize = options.chunkSize ?? FILE_READ_CHUNK_SIZE;
  // Binary detection via bounded sample
  if (isBinaryFile(filePath)) {
    return { content: '', error: 'Binary file skipped', isBinary: true };
  }

  // Decode incrementally because filesystem byte size and JavaScript string.length
  // are not equivalent for UTF-8 input.
  let fd: number | undefined;
  try {
    fd = openSync(filePath, 'r');
    const decoder = new StringDecoder('utf8');
    const buffer = Buffer.alloc(chunkSize);
    const chunks: string[] = [];
    let decodedLength = 0;

    let bytesRead: number;
    do {
      bytesRead = readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead === 0) continue;
      options.onChunkRead?.(bytesRead);

      const decoded = decoder.write(buffer.subarray(0, bytesRead));
      decodedLength += decoded.length;
      if (decodedLength > maxInputSize) {
        return {
          content: '',
          error: `File exceeds maximum size of ${maxInputSize} bytes`,
          isBinary: false,
        };
      }
      chunks.push(decoded);
    } while (bytesRead > 0);

    const finalDecoded = decoder.end();
    decodedLength += finalDecoded.length;
    if (decodedLength > maxInputSize) {
      return {
        content: '',
        error: `File exceeds maximum size of ${maxInputSize} bytes`,
        isBinary: false,
      };
    }
    chunks.push(finalDecoded);

    return { content: chunks.join(''), isBinary: false };
  } catch (err) {
    return {
      content: '',
      error: err instanceof Error ? err.message : String(err),
      isBinary: false,
    };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

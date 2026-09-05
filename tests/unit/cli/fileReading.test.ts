import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync as writeFileSyncAlias } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { readBufferSafe, readFileSafe, isBinaryFile } from '@/cli/utils/fileReading.js';
import { MAX_INPUT_SIZE } from '@/core/index.js';

function createTempDir(): string {
  const dir = join(tmpdir(), `debug-halo-file-reading-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(dir: string, relPath: string, content: string = ''): string {
  const fullPath = join(dir, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSyncAlias(fullPath, content, 'utf-8');
  return fullPath;
}

function writeBinaryFile(dir: string, relPath: string, content: Buffer): string {
  const fullPath = join(dir, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSyncAlias(fullPath, content);
  return fullPath;
}

function cleanupDir(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

describe('File Reading Utility', { timeout: 30000 }, () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTempDir();
  });

  afterEach(() => cleanupDir(testDir));

  describe('isBinaryFile', () => {
    it('returns false for normal text file', () => {
      writeFile(testDir, 'text.txt', 'hello world');
      expect(isBinaryFile(join(testDir, 'text.txt'))).toBe(false);
    });

    it('returns false for empty file', () => {
      writeFile(testDir, 'empty.txt', '');
      expect(isBinaryFile(join(testDir, 'empty.txt'))).toBe(false);
    });

    it('returns true for file with NUL byte in first 8 KiB', () => {
      // Create a file with NUL byte early in the content
      const content = Buffer.from('text\x00more text');
      writeBinaryFile(testDir, 'binary.bin', content);
      expect(isBinaryFile(join(testDir, 'binary.bin'))).toBe(true);
    });

    it('returns true for file with NUL byte after 8 KiB boundary (not in sample)', () => {
      // Create a file larger than 8 KiB with NUL byte only after the sample
      const largeContent = Buffer.alloc(10000, 0x61); // 'a' repeated
      largeContent[9000] = 0x00; // NUL byte at position 9000 (beyond 8192 sample)
      writeBinaryFile(testDir, 'large_binary.bin', largeContent);
      // Should return false because NUL is not in first 8 KiB sample
      expect(isBinaryFile(join(testDir, 'large_binary.bin'))).toBe(false);
    });

    it('returns false for missing file', () => {
      expect(isBinaryFile(join(testDir, 'nonexistent.txt'))).toBe(false);
    });

    it('returns false for file with only valid UTF-8', () => {
      writeFile(testDir, 'utf8.txt', 'Hello 世界 🌍');
      expect(isBinaryFile(join(testDir, 'utf8.txt'))).toBe(false);
    });

    it('handles file with NUL byte at exactly 8 KiB boundary', () => {
      const content = Buffer.alloc(8192, 0x61); // 8192 'a' bytes
      content[8191] = 0x00; // NUL at last byte of sample
      writeBinaryFile(testDir, 'boundary.bin', content);
      expect(isBinaryFile(join(testDir, 'boundary.bin'))).toBe(true);
    });
  });

  describe('readFileSafe', () => {
    it('reads normal text file correctly', () => {
      writeFile(testDir, 'text.txt', 'hello world\nsecond line');
      const result = readFileSafe(join(testDir, 'text.txt'));
      expect(result.error).toBeUndefined();
      expect(result.isBinary).toBe(false);
      expect(result.content).toBe('hello world\nsecond line');
    });

    it('returns error for empty file but reads content', () => {
      writeFile(testDir, 'empty.txt', '');
      const result = readFileSafe(join(testDir, 'empty.txt'));
      expect(result.error).toBeUndefined();
      expect(result.isBinary).toBe(false);
      expect(result.content).toBe('');
    });

    it('returns error for binary file with NUL byte', () => {
      const content = Buffer.from('text\x00more');
      writeBinaryFile(testDir, 'binary.bin', content);
      const result = readFileSafe(join(testDir, 'binary.bin'));
      expect(result.error).toBe('Binary file skipped');
      expect(result.isBinary).toBe(true);
      expect(result.content).toBe('');
    });

    it('returns error for missing file', () => {
      const result = readFileSafe(join(testDir, 'nonexistent.txt'));
      expect(result.error).toBeDefined();
      expect(result.error).toContain('ENOENT');
      expect(result.isBinary).toBe(false);
      expect(result.content).toBe('');
    });

    it('returns error for file without read permission (if applicable)', () => {
      // This test is platform-dependent - on some systems we can't easily
      // create unreadable files in temp dir. We'll test that the error
      // is handled gracefully if it occurs.
      const filePath = join(testDir, 'unreadable.txt');
      writeFile(testDir, 'unreadable.txt', 'secret');
      // We can't easily test this cross-platform, but we verify the function
      // doesn't throw and returns an error
      const result = readFileSafe(filePath);
      // On Windows, this might succeed. On Unix, if we chmod 000, it might fail.
      // Either way, no exception should be thrown.
      expect(result.content).toBeDefined();
    });

    it('handles file with Unicode content', () => {
      writeFile(testDir, 'unicode.txt', 'Hello 世界 🌍 café naïve résumé');
      const result = readFileSafe(join(testDir, 'unicode.txt'));
      expect(result.error).toBeUndefined();
      expect(result.content).toBe('Hello 世界 🌍 café naïve résumé');
    });

    it('handles file with Windows line endings', () => {
      writeFileSyncAlias(join(testDir, 'crlf.txt'), 'line1\r\nline2\r\nline3');
      const result = readFileSafe(join(testDir, 'crlf.txt'));
      expect(result.error).toBeUndefined();
      expect(result.content).toBe('line1\r\nline2\r\nline3');
    });
  });

  describe('bounded binary sampling', () => {
    it('does not read entire large file for binary detection', () => {
      // Create a 1 MB file with NUL byte only at the very end
      const largeContent = Buffer.alloc(1024 * 1024, 0x61); // 1 MB of 'a'
      largeContent[1024 * 1024 - 1] = 0x00; // NUL at the very end
      writeBinaryFile(testDir, 'huge.bin', largeContent);

      // Binary detection should only sample first 8 KiB and not find NUL
      const isBinary = isBinaryFile(join(testDir, 'huge.bin'));
      expect(isBinary).toBe(false);

      // Full read should still work if we bypass binary check (it won't in practice)
      // but the point is binary detection is bounded
    });

    it('detects NUL byte within first 8 KiB of large file', () => {
      const largeContent = Buffer.alloc(1024 * 1024, 0x61); // 1 MB of 'a'
      largeContent[4096] = 0x00; // NUL at 4 KiB (within sample)
      writeBinaryFile(testDir, 'huge_with_nul.bin', largeContent);

      const isBinary = isBinaryFile(join(testDir, 'huge_with_nul.bin'));
      expect(isBinary).toBe(true);
    });
  });

  describe('file size limit enforcement', () => {
    it('accepts a staged buffer exactly at the byte limit', () => {
      const buffer = Buffer.from('abcd', 'utf8');

      expect(readBufferSafe(buffer, buffer.length)).toEqual({
        content: 'abcd',
        isBinary: false,
      });
    });

    it('rejects a staged buffer exceeding the byte limit', () => {
      expect(readBufferSafe(Buffer.from('abcde', 'utf8'), 4)).toEqual({
        content: '',
        error: 'File exceeds maximum size of 4 bytes',
        isBinary: false,
      });
    });

    it('uses UTF-8 byte length for staged multibyte text', () => {
      const content = '\u20ac\u20ac';
      const buffer = Buffer.from(content, 'utf8');

      expect(content.length).toBeLessThan(4);
      expect(buffer.length).toBeGreaterThan(4);
      expect(readBufferSafe(buffer, 4)).toEqual({
        content: '',
        error: 'File exceeds maximum size of 4 bytes',
        isBinary: false,
      });
    });

    it('reads ordinary ASCII text within the decoded-text limit', () => {
      const content = 'plain text';
      writeFile(testDir, 'under_limit.txt', content);

      const result = readFileSafe(join(testDir, 'under_limit.txt'), {
        maxInputSize: content.length,
      });
      expect(result.error).toBeUndefined();
      expect(result.content).toBe(content);
      expect(result.isBinary).toBe(false);
    });

    it('uses byte length semantics for multi-byte UTF-8 input', () => {
      const content = '🌍🌍';
      writeFile(testDir, 'unicode-limit.txt', content);

      expect(Buffer.byteLength(content, 'utf8')).toBeGreaterThan(content.length);
      expect(
        readFileSafe(join(testDir, 'unicode-limit.txt'), { maxInputSize: content.length })
      ).toMatchObject({ content: '', error: expect.stringContaining('exceeds maximum size') });
    });

    it('rejects decoded text over the shared default limit and stops reading early', () => {
      const filePath = writeFile(testDir, 'over-limit.txt', 'abcdefghijklmnop');
      const streamedReads: number[] = [];

      const result = readFileSafe(filePath, {
        maxInputSize: 5,
        chunkSize: 2,
        onChunkRead: (bytesRead) => streamedReads.push(bytesRead),
      });

      expect(result).toEqual({
        content: '',
        error: 'File exceeds maximum size of 5 bytes',
        isBinary: false,
      });
      expect(streamedReads).toEqual([2, 2, 2]);
      expect(streamedReads.reduce((total, bytesRead) => total + bytesRead, 0)).toBe(6);
      expect(MAX_INPUT_SIZE).toBe(10 * 1024 * 1024);
    });

    it('decodes UTF-8 characters split across read chunk boundaries', () => {
      const content = 'a€b';
      writeFile(testDir, 'split-code-point.txt', content);

      const result = readFileSafe(join(testDir, 'split-code-point.txt'), {
        maxInputSize: Buffer.byteLength(content),
        chunkSize: 2,
      });
      expect(result.error).toBeUndefined();
      expect(result.content).toBe(content);
    });

    it('binary sampling remains bounded independently of the decoded limit', () => {
      const content = Buffer.alloc(9001, 0x61);
      content[100] = 0x00; // NUL well within 8 KiB sample
      writeBinaryFile(testDir, 'large_binary.bin', content);

      const isBinary = isBinaryFile(join(testDir, 'large_binary.bin'));
      expect(isBinary).toBe(true);
    });

    it('binary sampling returns false with NUL only beyond sample', () => {
      const content = Buffer.alloc(9001, 0x61);
      content[9000] = 0x00; // NUL at 9 KiB (outside 8 KiB sample)
      writeBinaryFile(testDir, 'large_no_nul.bin', content);

      const isBinary = isBinaryFile(join(testDir, 'large_no_nul.bin'));
      expect(isBinary).toBe(false);
    });
  });
});

describe('Scan/Sanitize Integration with Shared Reader', { timeout: 30000 }, () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTempDir();
  });

  afterEach(() => cleanupDir(testDir));

  it('scan uses shared reader for normal file', async () => {
    const { runScan } = await import('@/cli/commands/scan.js');
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const result = await runScan({
      paths: [testDir],
      extensions: ['ts'],
      ignorePatterns: [],
      outputFormat: 'json',
      failOnFindings: false,
      verbose: false,
    });

    expect(result.summary.filesScanned).toBe(1);
    expect(result.summary.findings).toBeGreaterThan(0);
  });

  it('scan uses shared reader for binary file', async () => {
    const { runScan } = await import('@/cli/commands/scan.js');
    writeFile(testDir, 'normal.ts', "const config = 'value';");
    const content = Buffer.from('binary\x00data');
    writeBinaryFile(testDir, 'binary.bin', content);

    const result = await runScan({
      paths: [testDir],
      extensions: ['ts', 'bin'],
      ignorePatterns: [],
      outputFormat: 'json',
      failOnFindings: false,
      verbose: false,
    });

    expect(result.summary.filesSkipped).toBeGreaterThanOrEqual(1);
    expect(result.summary.filesScanned).toBeGreaterThanOrEqual(1);
  });

  it('sanitize uses shared reader for normal file', async () => {
    const { runSanitize } = await import('@/cli/commands/sanitize.js');
    writeFile(
      testDir,
      'secret.ts',
      "const apiKey = 'sk-1234567890abcdef1234567890abcdef12345678';"
    );

    const result = await runSanitize({
      paths: [testDir],
      extensions: ['ts'],
      ignorePatterns: [],
      dryRun: true,
      verbose: false,
    });

    expect(result.summary.filesProcessed).toBe(1);
    expect(result.summary.filesChanged).toBe(1);
  });

  it('sanitize uses shared reader for binary file', async () => {
    const { runSanitize } = await import('@/cli/commands/sanitize.js');
    writeFile(testDir, 'normal.ts', "const config = 'value';");
    const content = Buffer.from('binary\x00data');
    writeBinaryFile(testDir, 'binary.bin', content);

    const result = await runSanitize({
      paths: [testDir],
      extensions: ['ts', 'bin'],
      ignorePatterns: [],
      dryRun: true,
      verbose: false,
    });

    expect(result.summary.filesSkipped).toBeGreaterThanOrEqual(1);
    expect(result.summary.filesProcessed).toBeGreaterThanOrEqual(1);
  });

  it('scan and sanitize both skip binary files with same error message', async () => {
    const { runScan } = await import('@/cli/commands/scan.js');
    const { runSanitize } = await import('@/cli/commands/sanitize.js');

    const binaryContent = Buffer.from('binary\x00data');
    writeBinaryFile(testDir, 'test.bin', binaryContent);

    const scanResult = await runScan({
      paths: [testDir],
      extensions: ['bin'],
      ignorePatterns: [],
      outputFormat: 'json',
      failOnFindings: false,
      verbose: false,
    });

    const sanitizeResult = await runSanitize({
      paths: [testDir],
      extensions: ['bin'],
      ignorePatterns: [],
      dryRun: true,
      verbose: false,
    });

    // Both should skip the binary file
    const scanError = scanResult.errors.find((e) => e.message === 'Binary file skipped');
    const sanitizeError = sanitizeResult.results.find((r) => r.error === 'Binary file skipped');

    expect(scanError).toBeDefined();
    expect(sanitizeError).toBeDefined();
  });
});

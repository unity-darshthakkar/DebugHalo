import { describe, expect, it } from 'vitest';
import { sanitizeExitCode, scanExitCode } from '@/cli/exitCodes.js';

describe('CLI exit-code precedence', () => {
  it('returns 2 for scan partial and all-file failures', () => {
    expect(scanExitCode(1, false, 0)).toBe(2);
    expect(scanExitCode(2, true, 3)).toBe(2);
  });

  it('preserves scan fail-on-findings and successful no-findings codes', () => {
    expect(scanExitCode(0, true, 1)).toBe(1);
    expect(scanExitCode(0, true, 0)).toBe(0);
    expect(scanExitCode(0, false, 1)).toBe(0);
  });

  it('returns 2 for sanitize partial and all-file failures', () => {
    expect(sanitizeExitCode(1, 0)).toBe(2);
    expect(sanitizeExitCode(1, 1)).toBe(2);
  });

  it('preserves sanitize changed and unchanged codes', () => {
    expect(sanitizeExitCode(0, 1)).toBe(1);
    expect(sanitizeExitCode(0, 0)).toBe(0);
  });
});

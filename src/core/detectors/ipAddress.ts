/**
 * IP Address Detector
 *
 * Detects IPv4 and IPv6 addresses, with special handling for private/internal IPs.
 * Avoids matching version numbers like 1.2.3.
 */

import { BaseDetector } from './baseDetector.js';
import type { DetectionConfidence, DetectionOptions, DetectionResult } from '../../types/core.js';

/**
 * IPv4 pattern - valid addresses only
 */
const IPV4_PATTERN =
  /\b(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}\b/g;

/**
 * IPv6 full pattern
 */
const IPV6_FULL_PATTERN = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g;

/**
 * IPv6 compressed pattern (with ::)
 */
const IPV6_COMPRESSED_PATTERN =
  /\b(?:[0-9a-fA-F]{1,4}:)*::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}\b|\b::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}\b/g;

/**
 * IPv6 loopback
 */
const IPV6_LOOPBACK_PATTERN = /(?<![a-zA-Z0-9])::1(?![a-zA-Z0-9])/g;

/**
 * CIDR notation
 */
const CIDR_PATTERN =
  /\b(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}\/\d{1,2}\b/g;

/**
 * Version number patterns to exclude
 */
const VERSION_CONTEXT_PATTERNS = [
  /version/,
  /release/,
  /build/,
  /semver/,
  /package/,
  /dependency/,
  /npm/,
  /yarn/,
  /pnpm/,
  /v\d+\.\d+\.\d+/,
  /^\d+\.\d+\.\d+$/,
];

function createIpAddressDetectorImpl(): new () => BaseDetector {
  const detectorName = 'ip-address-detector';

  class IpAddressDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['ip_address'] as const;
    public readonly confidence = 0.85 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      // Detect IPv4
      for (const match of text.matchAll(IPV4_PATTERN)) {
        if (match.index === undefined) continue;

        const ip = match[0];
        const start = match.index;
        const end = start + ip.length;

        // Skip if part of CIDR
        if (text[end] === '/') continue;

        // Skip version numbers
        if (this.isVersionNumber(ip, text, start)) continue;

        results.push(
          this.createDetection(text, start, end, 'ip_address', this.confidence, {
            contextWindow,
          })
        );
      }

      // Detect CIDR
      for (const match of text.matchAll(CIDR_PATTERN)) {
        if (match.index === undefined) continue;

        const cidr = match[0];
        const start = match.index;
        const end = start + cidr.length;

        if (!results.some((r) => r.range.start === start && r.range.end === end)) {
          results.push(
            this.createDetection(text, start, end, 'ip_address', this.confidence, {
              contextWindow,
            })
          );
        }
      }

      // Detect IPv6 full
      for (const match of text.matchAll(IPV6_FULL_PATTERN)) {
        if (match.index === undefined) continue;

        const ip = match[0];
        const start = match.index;
        const end = start + ip.length;

        results.push(
          this.createDetection(text, start, end, 'ip_address', this.confidence, {
            contextWindow,
          })
        );
      }

      // Detect IPv6 compressed
      for (const match of text.matchAll(IPV6_COMPRESSED_PATTERN)) {
        if (match.index === undefined) continue;

        const ip = match[0];
        const start = match.index;
        const end = start + ip.length;

        if (!results.some((r) => r.range.start === start && r.range.end === end)) {
          results.push(
            this.createDetection(text, start, end, 'ip_address', this.confidence, {
              contextWindow,
            })
          );
        }
      }

      // Detect IPv6 loopback
      for (const match of text.matchAll(IPV6_LOOPBACK_PATTERN)) {
        if (match.index === undefined) continue;

        const ip = match[0];
        const start = match.index;
        const end = start + ip.length;

        results.push(
          this.createDetection(text, start, end, 'ip_address', this.confidence, {
            contextWindow,
          })
        );
      }

      return results;
    }

    private isVersionNumber(ip: string, text: string, index: number): boolean {
      // Check if the surrounding context suggests a version
      const before = text.slice(Math.max(0, index - 30), index);
      const after = text.slice(index + ip.length, index + ip.length + 30);
      const context = (before + after).toLowerCase();

      // Strong version indicators
      if (VERSION_CONTEXT_PATTERNS.some((p) => p.test(context))) {
        // But make sure it's not an IP context
        const ipContext =
          /server|client|host|ip\b|address|network|connect|bind|listen|gateway|proxy|dns|router|firewall|subnet|cidr/i.test(
            context
          );
        if (!ipContext) return true;
      }

      // Check if it's a clear semantic version (major.minor.patch with small numbers)
      const parts = ip.split('.').map(Number);
      if (parts.length === 3 && parts.every((p) => p >= 0 && p <= 99)) {
        // Could be version - check if it's definitely not a private IP
        const [a, b] = parts;
        if (b === undefined) return false;
        const isPrivate =
          a === 10 ||
          (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && parts[2] === 168) ||
          (a === 169 && b === 254);
        if (!isPrivate && !context.match(/ip|host|server|network/)) {
          return true;
        }
      }

      return false;
    }
  }

  return IpAddressDetector;
}

export function createIpAddressDetector(): BaseDetector {
  return new (createIpAddressDetectorImpl())();
}

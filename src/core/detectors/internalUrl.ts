/**
 * Internal URL Detector
 *
 * Detects URLs that appear to be internal, local, or development-oriented.
 * Includes localhost, .local, .internal, private IPs, and dev service names.
 */

import { BaseDetector } from './baseDetector.js';
import type { DetectionConfidence, DetectionOptions, DetectionResult } from '../../types/core.js';

/**
 * URL pattern - matches scheme://host[:port][/path] for common protocols
 */
const URL_PATTERN =
  /\b(?:https?|ws|wss|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s<>"')]+/gi;

/**
 * Internal/private indicators
 */
const INTERNAL_INDICATORS: Record<string, boolean> = {
  // Localhost variants
  localhost: true,
  '127.0.0.1': true,
  '::1': true,
  '0.0.0.0': true,
  '0.0.0': true,

  // Local TLDs
  local: true,
  test: true,
  internal: true,
  intranet: true,
  dev: true,
  development: true,
  staging: true,
  stage: true,
  qa: true,
  sandbox: true,
  preview: true,

  // Cloud internal
  'internal.cloudapp.net': true,
  'compute.internal': true,
  'c.internal': true,
  'service.consul': true,
  consul: true,

  // Kubernetes
  'cluster.local': true,
  'svc.cluster.local': true,
  svc: true,

  // Docker
  'docker.internal': true,
  'host.docker.internal': true,

  // AWS
  'ec2.internal': true,
  'amazonaws.com': false, // Not automatically internal, but could be

  // Common dev service names
  api: true,
  admin: true,
  backend: true,
  frontend: true,
  app: true,
  service: true,
  microservice: true,
};

/**
 * Private IP ranges (RFC 1918, RFC 4193, RFC 6598)
 */
const PRIVATE_IP_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
  /^192\.168\.\d{1,3}\.\d{1,3}$/, // 192.168.0.0/16
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // 169.254.0.0/16 (link-local)
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/, // 100.64.0.0/10 (CGNAT)
  /^fd[0-9a-f]{2}:[0-9a-f:]+$/i, // IPv6 ULA
  /^fe80::[0-9a-f:]+$/i, // IPv6 link-local
];

function isPrivateIp(host: string): boolean {
  // Remove port if present
  const hostOnly = host.split(':')[0] ?? '';

  // Check exact matches
  if (hostOnly === 'localhost' || hostOnly === '127.0.0.1' || hostOnly === '::1') {
    return true;
  }

  // Check private IP patterns
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostOnly));
}

function isInternalHost(host: string): boolean {
  const hostLower = host.toLowerCase();

  // Check private IP
  if (isPrivateIp(host)) return true;

  // Check known internal domains
  if (INTERNAL_INDICATORS[hostLower] === true) return true;

  // Check suffixes
  const internalSuffixes = [
    '.local',
    '.internal',
    '.intranet',
    '.dev',
    '.test',
    '.staging',
    '.stage',
    '.qa',
    '.sandbox',
    '.preview',
    '.corp',
    '.internal.cloudapp.net',
    '.compute.internal',
    '.c.internal',
    '.service.consul',
    '.cluster.local',
    '.svc.cluster.local',
    '.docker.internal',
  ];

  for (const suffix of internalSuffixes) {
    if (hostLower.endsWith(suffix)) return true;
  }

  // Check for dev-like subdomains
  const devSubdomains = [
    'dev.',
    'development.',
    'staging.',
    'stage.',
    'qa.',
    'test.',
    'sandbox.',
    'preview.',
    'internal.',
    'admin.',
    'int.',
    'local.',
  ];

  // Check if host has dev-like subdomain
  const parts = hostLower.split('.');
  if (parts.length >= 3 && devSubdomains.some((d) => parts[0] === d.slice(0, -1))) {
    return true;
  }

  return false;
}

function createInternalUrlDetectorImpl(): new () => BaseDetector {
  const detectorName = 'internal-url-detector';

  class InternalUrlDetector extends BaseDetector {
    public readonly name = detectorName;
    public readonly categories = ['internal_url', 'internal_domain'] as const;
    public readonly confidence = 0.8 as DetectionConfidence;

    detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
      const results: DetectionResult[] = [];

      const contextWindow = options.contextWindow ?? 50;

      for (const match of text.matchAll(URL_PATTERN)) {
        if (match.index === undefined) continue;

        const url = match[0];
        const start = match.index;
        const end = start + url.length;

        // Extract host from URL
        const host = this.extractHost(url);
        if (!host) continue;

        // Check if internal
        if (!isInternalHost(host)) continue;

        // Determine category
        const category = isPrivateIp(host) ? 'internal_url' : 'internal_domain';

        results.push(
          this.createDetection(text, start, end, category, this.confidence, {
            contextWindow,
          })
        );
      }

      return results;
    }

    private extractHost(url: string): string | null {
      try {
        const parsed = new URL(url);
        return parsed.hostname;
      } catch {
        return null;
      }
    }
  }

  return InternalUrlDetector;
}

export function createInternalUrlDetector(): BaseDetector {
  return new (createInternalUrlDetectorImpl())();
}

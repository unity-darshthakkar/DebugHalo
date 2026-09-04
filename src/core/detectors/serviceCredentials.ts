import { BaseDetector } from './baseDetector.js';
import type {
  DetectionCategory,
  DetectionConfidence,
  DetectionOptions,
  DetectionResult,
} from '../../types/core.js';

interface CredentialPattern {
  category: DetectionCategory;
  pattern: RegExp;
  confidence: DetectionConfidence;
  reason: string;
  valueGroup?: number;
}

const PATTERNS: CredentialPattern[] = [
  {
    category: 'openai_key',
    pattern: /\bsk-(?:proj|svcacct)-[A-Za-z0-9_-]{32,}\b/g,
    confidence: 0.99 as DetectionConfidence,
    reason: 'OpenAI credential with a service-specific key prefix',
  },
  {
    category: 'anthropic_key',
    pattern: /\bsk-ant-[A-Za-z0-9_-]{40,}\b/g,
    confidence: 0.99 as DetectionConfidence,
    reason: 'Anthropic credential with the sk-ant prefix',
  },
  {
    category: 'stripe_webhook_secret',
    pattern: /\bwhsec_[A-Za-z0-9]{24,}\b/g,
    confidence: 0.99 as DetectionConfidence,
    reason: 'Stripe webhook signing secret with the whsec_ prefix',
  },
  {
    category: 'google_api_key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    confidence: 0.99 as DetectionConfidence,
    reason: 'Google API key with the AIza prefix and canonical length',
  },
  {
    category: 'gitlab_token',
    pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
    confidence: 0.99 as DetectionConfidence,
    reason: 'GitLab access token with the glpat- prefix',
  },
  {
    category: 'discord_token',
    pattern: /\b[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27,}\b/g,
    confidence: 0.98 as DetectionConfidence,
    reason: 'Discord bot token with the canonical three-segment format',
  },
  {
    category: 'twilio_api_key',
    pattern: /\bSK[0-9a-fA-F]{32}\b/g,
    confidence: 0.99 as DetectionConfidence,
    reason: 'Twilio API key SID with the SK prefix and canonical length',
  },
  {
    category: 'sendgrid_api_key',
    pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g,
    confidence: 0.99 as DetectionConfidence,
    reason: 'SendGrid API key with the canonical SG prefix and segments',
  },
  {
    category: 'azure_client_secret',
    pattern:
      /\b(?:AZURE_CLIENT_SECRET|azure[_-]?client[_-]?secret)\s*[=:]\s*["']?([A-Za-z0-9~._-]{24,})["']?/gi,
    confidence: 0.9 as DetectionConfidence,
    reason: 'High-entropy client secret in explicit Azure credential context',
    valueGroup: 1,
  },
  {
    category: 'oauth_client_secret',
    pattern:
      /\b(?:OAUTH_CLIENT_SECRET|oauth[_-]?client[_-]?secret|client[_-]?secret)\s*[=:]\s*["']?([A-Za-z0-9~._-]{24,})["']?/gi,
    confidence: 0.85 as DetectionConfidence,
    reason: 'High-entropy value assigned to an OAuth client-secret field',
    valueGroup: 1,
  },
];

class ServiceCredentialDetector extends BaseDetector {
  public readonly name = 'service-credential-detector';
  public readonly categories = PATTERNS.map((entry) => entry.category);
  public readonly confidence = 0.85 as DetectionConfidence;
  public override readonly priority = 95;

  detect(text: string, options: DetectionOptions = {}): DetectionResult[] {
    const results: DetectionResult[] = [];
    for (const entry of PATTERNS) {
      entry.pattern.lastIndex = 0;
      for (const match of text.matchAll(entry.pattern)) {
        if (match.index === undefined) continue;
        const value = match[entry.valueGroup ?? 0];
        if (!value || !this.hasSufficientEntropy(value, 20)) continue;
        const start = match.index + match[0].indexOf(value);
        const end = start + value.length;
        results.push(
          this.createDetection(text, start, end, entry.category, entry.confidence, {
            contextWindow: options.contextWindow,
            reason: entry.reason,
          })
        );
      }
    }
    return results;
  }
}

export function createServiceCredentialDetector(): BaseDetector {
  return new ServiceCredentialDetector();
}

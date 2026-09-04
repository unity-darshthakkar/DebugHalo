import type { DetectionCategory, DetectionResult, DetectionSeverity } from '../types/core.js';

const CRITICAL = new Set<DetectionCategory>([
  'private_key',
  'ssh_private_key',
  'pgp_private_key',
  'aws_secret_key',
  'openai_key',
  'anthropic_key',
  'stripe_key',
  'stripe_webhook_secret',
  'sendgrid_api_key',
  'azure_client_secret',
]);
const HIGH = new Set<DetectionCategory>([
  'aws_access_key',
  'aws_session_token',
  'github_token',
  'gitlab_token',
  'slack_token',
  'discord_token',
  'google_api_key',
  'twilio_api_key',
  'oauth_client_secret',
  'database_url',
  'postgres_url',
  'mysql_url',
  'mongodb_url',
  'redis_url',
  'password',
  'password_env',
  'password_config',
]);
const LOW = new Set<DetectionCategory>(['email', 'ip_address', 'internal_url', 'internal_domain']);
const PLACEHOLDER_FILTERED = new Set<DetectionCategory>([
  'openai_key',
  'anthropic_key',
  'stripe_key',
  'stripe_webhook_secret',
  'google_api_key',
  'gitlab_token',
  'discord_token',
  'twilio_api_key',
  'sendgrid_api_key',
  'oauth_client_secret',
  'azure_client_secret',
]);

export function severityForCategory(category: DetectionCategory): DetectionSeverity {
  if (CRITICAL.has(category)) return 'critical';
  if (HIGH.has(category)) return 'high';
  if (LOW.has(category)) return 'low';
  return 'medium';
}

export function isObviousPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  if (
    /(example|placeholder|changeme|replace[_-]?me|your[_-]|dummy|not[_-]?real)/.test(normalized)
  ) {
    return true;
  }
  return false;
}

function sourceLine(input: string, offset: number): string {
  const start = input.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const end = input.indexOf('\n', offset);
  return input.slice(start, end === -1 ? input.length : end);
}

function previousLine(input: string, offset: number): string {
  const currentStart = input.lastIndexOf('\n', Math.max(0, offset - 1));
  if (currentStart < 0) return '';
  const previousEnd = currentStart;
  const previousStart = input.lastIndexOf('\n', Math.max(0, previousEnd - 1)) + 1;
  return input.slice(previousStart, previousEnd);
}

interface SuppressionDirective {
  categories: string[];
  nextLine: boolean;
}

function commentBody(line: string): string | undefined {
  let quote: "'" | '"' | '`' | undefined;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }

    if (character === '/' && line[index + 1] === '/') {
      return line.slice(index + 2);
    }

    if (character === '#' && (index === 0 || /\s/.test(line[index - 1] ?? ''))) {
      return line.slice(index + 1);
    }
  }

  return undefined;
}

function suppressionDirective(line: string): SuppressionDirective | undefined {
  const comment = commentBody(line);
  if (comment === undefined) return undefined;

  const match = /^\s*debughalo-ignore(-next-line)?(?:\s+([a-z0-9_, -]+))?\s*$/i.exec(comment);
  if (!match) return undefined;

  return {
    categories: (match[2] ?? '')
      .split(/[\s,]+/)
      .map((category) => category.toLowerCase())
      .filter(Boolean),
    nextLine: match[1] !== undefined,
  };
}

function suppressionApplies(directive: SuppressionDirective, category: DetectionCategory): boolean {
  return directive.categories.length === 0 || directive.categories.includes(category);
}

export function isInlineSuppressed(
  input: string,
  detection: Pick<DetectionResult, 'category' | 'range'>
): boolean {
  const current = suppressionDirective(sourceLine(input, detection.range.start));
  if (current && !current.nextLine && suppressionApplies(current, detection.category)) return true;

  const prior = suppressionDirective(previousLine(input, detection.range.start));
  return Boolean(prior?.nextLine && suppressionApplies(prior, detection.category));
}

export function enrichDetection<T extends DetectionResult>(input: string, detection: T): T {
  const nearby = sourceLine(input, detection.range.start).toLowerCase();
  return {
    ...detection,
    reason:
      detection.reason ?? `Matched ${detection.category} pattern in ${detection.detectorName}`,
    severity: severityForCategory(detection.category),
    likelyTestValue: /\b(test|fixture|mock|sample|example)\b/.test(nearby),
  };
}

export function applyDetectionPolicy(
  input: string,
  detections: ReadonlyArray<DetectionResult>,
  categories?: ReadonlyArray<DetectionCategory>,
  disabledCategories: ReadonlyArray<DetectionCategory> = []
): DetectionResult[] {
  const enabled = categories?.length ? new Set(categories) : undefined;
  const disabled = new Set(disabledCategories);
  return detections.filter(
    (detection) =>
      (!enabled || enabled.has(detection.category)) &&
      !disabled.has(detection.category) &&
      !(PLACEHOLDER_FILTERED.has(detection.category) && isObviousPlaceholder(detection.value)) &&
      !isInlineSuppressed(input, detection)
  );
}

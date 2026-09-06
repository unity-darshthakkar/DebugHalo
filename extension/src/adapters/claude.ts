import {
  extractComposerText,
  installSiteProtection,
  type SiteProtection,
  type SiteProtectionOptions,
} from './siteProtection.js';

const CLAUDE_CONFIG = {
  id: 'claude',
  composerSelectors: [
    '[data-testid="chat-input"]',
    'div.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
  ],
  sendButtonSelectors: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send Message"]',
    'button[aria-label="Send message"]',
  ],
} as const;

export type ClaudeProtection = SiteProtection;
export type ClaudeProtectionOptions = SiteProtectionOptions;

export function extractClaudeComposerText(composer: Element): string {
  return extractComposerText(composer);
}

export function installClaudeProtection(
  document: Document,
  options: ClaudeProtectionOptions = {}
): ClaudeProtection {
  return installSiteProtection(document, CLAUDE_CONFIG, options);
}

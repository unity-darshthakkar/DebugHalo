import {
  extractComposerText,
  installSiteProtection,
  type SiteProtection,
  type SiteProtectionOptions,
} from './siteProtection.js';

const GEMINI_CONFIG = {
  id: 'gemini',
  composerSelectors: [
    'rich-textarea [contenteditable="true"]',
    '.ql-editor[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    'textarea',
  ],
  sendButtonSelectors: [
    'button[aria-label="Send message"]',
    'button[aria-label="Send Message"]',
    'button.send-button',
  ],
} as const;

export type GeminiProtection = SiteProtection;
export type GeminiProtectionOptions = SiteProtectionOptions;

export function extractGeminiComposerText(composer: Element): string {
  return extractComposerText(composer);
}

export function installGeminiProtection(
  document: Document,
  options: GeminiProtectionOptions = {}
): GeminiProtection {
  return installSiteProtection(document, GEMINI_CONFIG, options);
}

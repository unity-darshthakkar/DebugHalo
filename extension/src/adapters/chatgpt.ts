import {
  extractComposerText,
  installSiteProtection,
  isSendKey,
  replaceComposerText,
  type SiteProtection,
  type SiteProtectionOptions,
} from './siteProtection.js';

const CHATGPT_CONFIG = {
  id: 'chatgpt',
  composerSelectors: [
    '#prompt-textarea',
    '[data-testid="composer-text-input"]',
    '[contenteditable="true"][role="textbox"]',
    'textarea',
  ],
  sendButtonSelectors: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send message"]',
    'button[type="submit"]',
  ],
} as const;

export type ChatGptProtection = SiteProtection;
export type ChatGptProtectionOptions = SiteProtectionOptions;
export { extractComposerText, isSendKey, replaceComposerText };

export function installChatGptProtection(
  document: Document,
  options: ChatGptProtectionOptions = {}
): ChatGptProtection {
  return installSiteProtection(document, CHATGPT_CONFIG, options);
}

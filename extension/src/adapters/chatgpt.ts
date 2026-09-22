import {
  extractComposerText,
  installSiteProtection,
  isSendKey,
  replaceComposerText,
  type SiteProtection,
  type SiteProtectionOptions,
} from './siteProtection.js';

const CHATGPT_COMPOSER_SELECTORS = [
  '#prompt-textarea',
  '[data-testid="composer-text-input"]',
  '[contenteditable="true"][role="textbox"]',
  'textarea',
] as const;

const CHATGPT_SEND_BUTTON_SELECTORS = [
  'button[data-testid="send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send message"]',
] as const;

const CHATGPT_CONFIG = {
  id: 'chatgpt',
  composerSelectors: CHATGPT_COMPOSER_SELECTORS,
  sendButtonSelectors: CHATGPT_SEND_BUTTON_SELECTORS,
  findComposerForSendControl: (
    _document: Document,
    control: HTMLElement,
    composerSelector: string
  ): HTMLElement | null =>
    (control.closest('form')?.querySelector(composerSelector) as HTMLElement | null) ?? null,
  findSendControlForComposer: (
    _document: Document,
    composer: HTMLElement,
    sendButtonSelector: string
  ): HTMLElement | null =>
    (composer.closest('form')?.querySelector(sendButtonSelector) as HTMLElement | null) ?? null,
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

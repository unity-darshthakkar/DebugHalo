// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetectionResult } from '@/browser/index.js';
import {
  extractClaudeComposerText,
  installClaudeProtection,
} from '../../../extension/src/adapters/claude.js';
import {
  extractGeminiComposerText,
  installGeminiProtection,
} from '../../../extension/src/adapters/gemini.js';
import type {
  SiteProtection,
  SiteProtectionOptions,
} from '../../../extension/src/adapters/siteProtection.js';

const secret = `AIza${'Ab3_'.repeat(8)}Ab3`;
const finding = {
  id: 'google-1',
  category: 'google_api_key',
  value: secret,
  confidence: 0.95,
  range: {
    start: 5,
    end: 5 + secret.length,
    startLine: 1,
    endLine: 1,
    startColumn: 6,
    endColumn: 6 + secret.length,
  },
  detectorName: 'service-credential-detector',
  reason: 'Google API key format',
  severity: 'high',
  likelyTestValue: false,
} as DetectionResult;

interface SiteFixture {
  name: string;
  markup: (text: string) => string;
  composerSelector: string;
  sendSelector: string;
  install: (document: Document, options?: SiteProtectionOptions) => SiteProtection;
  extract: (composer: Element) => string;
}

const sites: SiteFixture[] = [
  {
    name: 'Claude',
    markup: (text) =>
      `<form><div data-testid="chat-input" class="ProseMirror" role="textbox" contenteditable="true">${text}</div><button aria-label="Send Message" type="button">Send</button></form>`,
    composerSelector: '[data-testid="chat-input"]',
    sendSelector: '[aria-label="Send Message"]',
    install: installClaudeProtection,
    extract: extractClaudeComposerText,
  },
  {
    name: 'Gemini',
    markup: (text) =>
      `<form><rich-textarea><div class="ql-editor" role="textbox" contenteditable="true">${text}</div></rich-textarea><button class="send-button" aria-label="Send message" type="button">Send</button></form>`,
    composerSelector: '.ql-editor',
    sendSelector: '.send-button',
    install: installGeminiProtection,
    extract: extractGeminiComposerText,
  },
];

let protection: SiteProtection | undefined;

afterEach(() => {
  protection?.stop();
  protection = undefined;
  document.documentElement.querySelector('[data-debughalo-warning]')?.remove();
  document.body.replaceChildren();
});

describe.each(sites)('$name adapter', (site) => {
  it('extracts its contenteditable composer text', () => {
    mount(site, 'site composer text');
    expect(site.extract(composer(site))).toBe('site composer text');
  });

  it('permits clean Send-button and Enter submissions exactly once', async () => {
    mount(site, 'clean message');
    const scan = vi.fn().mockResolvedValue([]);
    protection = site.install(document, { scan });
    let sends = 0;
    sendButton(site).addEventListener('click', () => sends++);

    sendButton(site).click();
    await vi.waitFor(() => expect(sends).toBe(1));

    composer(site).textContent = 'another clean message';
    composer(site).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
    await vi.waitFor(() => expect(sends).toBe(2));
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it('preserves Shift+Enter and IME composition behavior', () => {
    mount(site, 'multiline');
    const scan = vi.fn().mockResolvedValue([]);
    protection = site.install(document, { scan });
    const shifted = keydown(site, { key: 'Enter', shiftKey: true });
    const composing = keydown(site, { key: 'Enter', isComposing: true });

    expect(shifted.defaultPrevented).toBe(false);
    expect(composing.defaultPrevented).toBe(false);
    expect(scan).not.toHaveBeenCalled();
  });

  it('blocks sensitive content, invokes shared review, and preserves content on Cancel', async () => {
    mount(site, `send ${secret}`);
    const presentReview = vi.fn().mockResolvedValue({ action: 'cancel' });
    protection = site.install(document, {
      scan: vi.fn().mockResolvedValue([finding]),
      presentReview,
    });
    let sends = 0;
    sendButton(site).addEventListener('click', () => sends++);

    sendButton(site).click();
    await vi.waitFor(() => expect(presentReview).toHaveBeenCalledOnce());
    expect(sends).toBe(0);
    expect(site.extract(composer(site))).toBe(`send ${secret}`);
  });

  it('uses a one-shot Send Anyway bypass and restores protection', async () => {
    mount(site, `send ${secret}`);
    const presentReview = vi
      .fn()
      .mockResolvedValueOnce({ action: 'send-original' })
      .mockResolvedValueOnce({ action: 'cancel' });
    protection = site.install(document, {
      scan: vi.fn().mockResolvedValue([finding]),
      presentReview,
    });
    let sends = 0;
    sendButton(site).addEventListener('click', () => sends++);

    sendButton(site).click();
    await vi.waitFor(() => expect(sends).toBe(1));
    sendButton(site).click();
    await vi.waitFor(() => expect(presentReview).toHaveBeenCalledTimes(2));
    expect(sends).toBe(1);
  });

  it('previews and confirms a sanitized message exactly once', async () => {
    mount(site, `send ${secret}`);
    protection = site.install(document, { scan: vi.fn().mockResolvedValue([finding]) });
    let sends = 0;
    sendButton(site).addEventListener('click', () => sends++);

    sendButton(site).click();
    await dialogElement();
    action('Sanitize').click();
    await vi.waitFor(() => expect(previewText()).toContain('<GOOGLE_API_KEY_1>'));
    expect(sends).toBe(0);
    action('Confirm Sanitized Send').click();

    await vi.waitFor(() => expect(sends).toBe(1));
    expect(site.extract(composer(site))).toBe('send <GOOGLE_API_KEY_1>');
  });

  it('invalidates changed content and remains idempotent across composer recreation', async () => {
    mount(site, `send ${secret}`);
    const notifyComposerChanged = vi.fn();
    const presentReview = vi.fn().mockResolvedValue({ action: 'send-original' });
    const scan = vi.fn().mockResolvedValue([finding]);
    const first = site.install(document, { scan, presentReview, notifyComposerChanged });
    protection = first;
    expect(site.install(document, { scan })).toBe(first);

    sendButton(site).click();
    composer(site).textContent = 'newer edit';
    await vi.waitFor(() => expect(notifyComposerChanged).toHaveBeenCalledOnce());

    mount(site, 'clean after navigation');
    let sends = 0;
    sendButton(site).addEventListener('click', () => sends++);
    scan.mockResolvedValueOnce([]);
    sendButton(site).click();
    await vi.waitFor(() => expect(sends).toBe(1));
  });
});

function mount(site: SiteFixture, text: string): void {
  document.body.innerHTML = site.markup(text);
}

function composer(site: SiteFixture): HTMLElement {
  return document.querySelector<HTMLElement>(site.composerSelector)!;
}

function sendButton(site: SiteFixture): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(site.sendSelector)!;
}

function keydown(site: SiteFixture, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
  composer(site).dispatchEvent(event);
  return event;
}

async function dialogElement(): Promise<HTMLElement> {
  await vi.waitFor(() => expect(document.querySelector('[data-debughalo-warning]')).not.toBeNull());
  return document.querySelector<HTMLElement>('[data-debughalo-warning]')!;
}

function action(label: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('[data-debughalo-warning] button')].find(
    (button) => button.textContent === label
  )!;
}

function previewText(): string | null {
  return document.querySelector('[data-debughalo-preview-text]')?.textContent ?? null;
}

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetectionResult } from '@/browser/index.js';
import { installChatGptProtection } from '../../../extension/src/adapters/chatgpt.js';
import { installClaudeProtection } from '../../../extension/src/adapters/claude.js';
import { installGeminiProtection } from '../../../extension/src/adapters/gemini.js';
import type { SiteProtection } from '../../../extension/src/adapters/siteProtection.js';
import type { ExtensionSettings } from '../../../extension/src/state/extensionState.js';

const secret = `AIza${'Ab3_'.repeat(8)}Ab3`;
const finding = { category: 'google_api_key', value: secret } as DetectionResult;
const sites = [
  { name: 'ChatGPT', install: installChatGptProtection },
  { name: 'Claude', install: installClaudeProtection },
  { name: 'Gemini', install: installGeminiProtection },
] as const;
let protection: SiteProtection | undefined;

afterEach(() => {
  protection?.stop();
  protection = undefined;
  document.documentElement.querySelector('[data-debughalo-warning]')?.remove();
  document.body.replaceChildren();
});

describe.each(sites)('$name shared settings', ({ install }) => {
  it('bypasses scanning while disabled and resumes immediately when enabled', async () => {
    mount();
    const settings: ExtensionSettings = { protectionEnabled: false, onDetection: 'ask' };
    const scan = vi.fn().mockResolvedValue([]);
    protection = install(document, { scan, getPolicy: () => settings });
    let sends = 0;
    button().addEventListener('click', () => sends++);

    button().click();
    expect(sends).toBe(1);
    expect(scan).not.toHaveBeenCalled();

    settings.protectionEnabled = true;
    button().click();
    await vi.waitFor(() => expect(sends).toBe(2));
    expect(scan).toHaveBeenCalledOnce();
  });

  it('records one scan and one blocked attempt for sensitive content', async () => {
    mount();
    const recordEvent = vi.fn();
    protection = install(document, {
      scan: vi.fn().mockResolvedValue([finding]),
      presentReview: vi.fn().mockResolvedValue({ action: 'cancel' }),
      recordEvent,
    });

    button().click();
    await vi.waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(2));
    expect(recordEvent.mock.calls).toEqual([['messagesScanned'], ['sensitiveSubmissionsBlocked']]);
  });
});

describe('shared protection preferences and counters', () => {
  it('does not count a sanitize preview until the confirmed sanitized send', async () => {
    mount();
    const recordEvent = vi.fn();
    protection = installChatGptProtection(document, {
      scan: vi.fn().mockResolvedValue([finding]),
      recordEvent,
    });
    button().click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-debughalo-warning]')).not.toBeNull()
    );
    action('Sanitize').click();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>('[data-debughalo-preview]')?.hidden).toBe(false)
    );
    expect(recordEvent).not.toHaveBeenCalledWith('messagesSanitized');

    action('Confirm Sanitized Send').click();
    await vi.waitFor(() => expect(recordEvent).toHaveBeenCalledWith('messagesSanitized'));
    expect(recordEvent.mock.calls.filter(([event]) => event === 'messagesSanitized')).toHaveLength(
      1
    );
  });

  it('records scans, blocks, confirmed sanitization, and Send Anyway without content', async () => {
    mount();
    const recordEvent = vi.fn();
    const presentReview = vi
      .fn()
      .mockResolvedValueOnce({ action: 'send-original' })
      .mockResolvedValueOnce({ action: 'send-sanitized', sanitizedText: 'safe alias' });
    protection = installChatGptProtection(document, {
      scan: vi.fn().mockResolvedValue([finding]),
      presentReview,
      recordEvent,
    });
    button().click();
    await vi.waitFor(() => expect(recordEvent).toHaveBeenCalledWith('sendAnywayUses'));
    composer().textContent = secret;
    button().click();
    await vi.waitFor(() => expect(recordEvent).toHaveBeenCalledWith('messagesSanitized'));

    expect(recordEvent.mock.calls.map(([event]) => event)).toEqual([
      'messagesScanned',
      'sensitiveSubmissionsBlocked',
      'sendAnywayUses',
      'messagesScanned',
      'sensitiveSubmissionsBlocked',
      'messagesSanitized',
    ]);
  });

  it('starts directly with local sanitize preview in sanitize mode', async () => {
    mount();
    const presentReview = vi.fn().mockResolvedValue({ action: 'cancel' });
    protection = installChatGptProtection(document, {
      scan: vi.fn().mockResolvedValue([finding]),
      presentReview,
      getPolicy: () => ({ protectionEnabled: true, onDetection: 'sanitize' }),
    });
    button().click();
    await vi.waitFor(() => expect(presentReview).toHaveBeenCalledOnce());
    expect(presentReview.mock.calls[0]?.[0]).toMatchObject({ startWithSanitize: true });
  });

  it('blocks sensitive sending without offering Send Anyway in block mode', async () => {
    mount();
    protection = installChatGptProtection(document, {
      scan: vi.fn().mockResolvedValue([finding]),
      getPolicy: () => ({ protectionEnabled: true, onDetection: 'block' }),
    });
    let sends = 0;
    button().addEventListener('click', () => sends++);
    button().click();

    await vi.waitFor(() =>
      expect(document.documentElement.textContent).toContain('Sensitive content blocked')
    );
    expect(document.documentElement.textContent).not.toContain('Send Anyway');
    expect(sends).toBe(0);
  });
});

function mount(): void {
  document.body.innerHTML = `<form><div id="prompt-textarea" data-testid="chat-input" class="ProseMirror ql-editor" role="textbox" contenteditable="true">${secret}</div><button data-testid="send-button" class="send-button" aria-label="Send message" type="button">Send</button></form>`;
}

function composer(): HTMLElement {
  return document.querySelector<HTMLElement>('#prompt-textarea')!;
}

function button(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('button')!;
}

function action(label: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('[data-debughalo-warning] button')].find(
    (candidate) => candidate.textContent === label
  )!;
}

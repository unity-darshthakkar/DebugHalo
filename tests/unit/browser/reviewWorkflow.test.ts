// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetectionResult } from '@/browser/index.js';
import {
  installChatGptProtection,
  type ChatGptProtection,
} from '../../../extension/src/adapters/chatgpt.js';
import { showReview } from '../../../extension/src/ui/review.js';

const googleKey = `AIza${'Ab3_'.repeat(8)}Ab3`;
const email = 'person@example.com';
const googleFinding = finding('google_api_key', googleKey, 'high', 0.95);
const emailFinding = finding('email', email, 'low', 0.9);

let protection: ChatGptProtection | undefined;

beforeEach(() => {
  document.body.innerHTML = composerMarkup(`send ${googleKey}`);
});

afterEach(() => {
  protection?.stop();
  protection = undefined;
  document.documentElement.querySelector('[data-debughalo-warning]')?.remove();
  document.body.replaceChildren();
});

describe('ChatGPT sanitize review workflow', () => {
  it('automatically prepares a sanitized preview without sending', async () => {
    const sanitize = vi.fn().mockResolvedValue({ sanitizedText: 'safe alias', aliases: [] });
    const decision = showReview(document, {
      findings: [googleFinding],
      originalText: googleKey,
      sanitize,
      startWithSanitize: true,
    });

    const preview = await previewElement();
    expect(sanitize).toHaveBeenCalledWith(googleKey);
    expect(preview.textContent).toContain('safe alias');
    action('Back to editing').click();
    await expect(decision).resolves.toEqual({ action: 'cancel' });
  });

  it('groups multiple findings and renders only safe review metadata', async () => {
    const decision = showReview(document, {
      findings: [googleFinding, emailFinding],
      originalText: `${googleKey} ${email}`,
      sanitize: vi.fn(),
    });
    const dialog = await dialogElement();

    expect(dialog.querySelectorAll('[data-debughalo-finding]')).toHaveLength(2);
    expect(dialog.textContent).toContain('google_api_key');
    expect(dialog.textContent).toContain('email');
    expect(dialog.textContent).not.toContain(googleKey);
    expect(dialog.textContent).not.toContain(email);

    action('Review findings').click();
    expect(dialog.querySelector<HTMLElement>('[data-debughalo-details]')?.hidden).toBe(false);
    expect(dialog.textContent).not.toContain(googleKey);
    action('Cancel').click();
    await expect(decision).resolves.toEqual({ action: 'cancel' });
  });

  it('sanitizes locally and previews aliases without immediately submitting', async () => {
    protection = installChatGptProtection(document, {
      scan: vi.fn().mockResolvedValue([googleFinding]),
    });
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);

    sendButton().click();
    await dialogElement();
    action('Sanitize').click();
    const preview = await previewElement();

    expect(preview.textContent).toContain('<GOOGLE_API_KEY_1>');
    expect(preview.textContent).not.toContain(googleKey);
    expect(composerText()).toContain(googleKey);
    expect(sends).toBe(0);
  });

  it('confirms sanitized text, emits an input event, and submits exactly once', async () => {
    const scan = vi.fn().mockResolvedValue([googleFinding]);
    protection = installChatGptProtection(document, { scan });
    let sends = 0;
    let inputEvents = 0;
    sendButton().addEventListener('click', () => sends++);
    composer().addEventListener('input', () => inputEvents++);

    sendButton().click();
    await dialogElement();
    action('Sanitize').click();
    await previewElement();
    action('Confirm Sanitized Send').click();

    await vi.waitFor(() => expect(sends).toBe(1));
    expect(composerText()).toBe('send <GOOGLE_API_KEY_1>');
    expect(inputEvents).toBe(1);

    composer().textContent = `another ${googleKey}`;
    sendButton().click();
    await dialogElement();
    expect(sends).toBe(1);
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it('keeps the original message when backing out of the preview', async () => {
    protection = installChatGptProtection(document, {
      scan: vi.fn().mockResolvedValue([googleFinding]),
    });
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);

    sendButton().click();
    await dialogElement();
    action('Sanitize').click();
    await previewElement();
    action('Back to editing').click();

    await vi.waitFor(() => expect(document.querySelector('[data-debughalo-warning]')).toBeNull());
    expect(composerText()).toContain(googleKey);
    expect(sends).toBe(0);
  });

  it('invalidates review when the composer changes before Send Anyway', async () => {
    protection = installChatGptProtection(document, {
      scan: vi.fn().mockResolvedValue([googleFinding]),
    });
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);

    sendButton().click();
    await dialogElement();
    composer().textContent = 'newer user edit';
    action('Send Anyway').click();

    await vi.waitFor(() => expect(dialogTitle()).toBe('Composer changed'));
    expect(composerText()).toBe('newer user edit');
    expect(sends).toBe(0);
  });

  it('does not overwrite edits made while the sanitized preview is open', async () => {
    protection = installChatGptProtection(document, {
      scan: vi.fn().mockResolvedValue([googleFinding]),
    });
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);

    sendButton().click();
    await dialogElement();
    action('Sanitize').click();
    await previewElement();
    composer().textContent = 'newer preview edit';
    action('Confirm Sanitized Send').click();

    await vi.waitFor(() => expect(dialogTitle()).toBe('Composer changed'));
    expect(composerText()).toBe('newer preview edit');
    expect(sends).toBe(0);
  });
});

function finding(
  category: DetectionResult['category'],
  value: string,
  severity: DetectionResult['severity'],
  confidence: number
): DetectionResult {
  return {
    id: `${category}-1`,
    category,
    value,
    confidence: confidence as DetectionResult['confidence'],
    range: {
      start: 5,
      end: 5 + value.length,
      startLine: 1,
      endLine: 1,
      startColumn: 6,
      endColumn: 6 + value.length,
    },
    detectorName: `${category}-detector`,
    reason: `Matched ${category}; never reveal ${value}`,
    severity,
    likelyTestValue: false,
  };
}

function composerMarkup(text: string): string {
  return `<form><div id="prompt-textarea" role="textbox" contenteditable="true">${text}</div><button data-testid="send-button" type="button">Send</button></form>`;
}

function composer(): HTMLElement {
  return document.querySelector<HTMLElement>('#prompt-textarea')!;
}

function composerText(): string {
  return composer().textContent ?? '';
}

function sendButton(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('[data-testid="send-button"]')!;
}

async function dialogElement(): Promise<HTMLElement> {
  await vi.waitFor(() => expect(document.querySelector('[data-debughalo-warning]')).not.toBeNull());
  return document.querySelector<HTMLElement>('[data-debughalo-warning]')!;
}

async function previewElement(): Promise<HTMLElement> {
  await vi.waitFor(() => {
    expect(document.querySelector<HTMLElement>('[data-debughalo-preview]')?.hidden).toBe(false);
  });
  return document.querySelector<HTMLElement>('[data-debughalo-preview]')!;
}

function action(label: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('[data-debughalo-warning] button')].find(
    (button) => button.textContent === label
  )!;
}

function dialogTitle(): string | null {
  return document.querySelector('[data-debughalo-warning] h2')?.textContent ?? null;
}

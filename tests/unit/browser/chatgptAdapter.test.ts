// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetectionResult } from '@/browser/index.js';
import {
  extractComposerText,
  installChatGptProtection,
  isSendKey,
  type ChatGptProtection,
} from '../../../extension/src/adapters/chatgpt.js';

const rawSecret = `AIza${'Ab3_'.repeat(8)}Ab3`;
const finding = {
  category: 'google_api_key',
  severity: 'high',
  confidence: 0.95,
  detectorName: 'service-credential-detector',
  value: rawSecret,
} as DetectionResult;

let protection: ChatGptProtection | undefined;

beforeEach(() => {
  document.body.innerHTML = composerMarkup('hello');
});

afterEach(() => {
  protection?.stop();
  protection = undefined;
  document.body.replaceChildren();
});

describe('ChatGPT adapter', () => {
  it('extracts text from textarea and contenteditable composers', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'textarea value';
    expect(extractComposerText(textarea)).toBe('textarea value');

    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.textContent = 'editable value';
    expect(extractComposerText(editable)).toBe('editable value');
  });

  it('permits clean button and Enter submissions exactly once', async () => {
    const scan = vi.fn().mockResolvedValue([]);
    protection = installChatGptProtection(document, { scan });
    const button = sendButton();
    let sends = 0;
    button.addEventListener('click', () => sends++);

    button.click();
    await vi.waitFor(() => expect(sends).toBe(1));

    composer().textContent = 'another clean message';
    composer().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
    await vi.waitFor(() => expect(sends).toBe(2));
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it('does not treat Shift+Enter or composition Enter as submission', () => {
    const scan = vi.fn().mockResolvedValue([]);
    protection = installChatGptProtection(document, { scan });

    const multiline = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    composer().dispatchEvent(multiline);
    const composing = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    composer().dispatchEvent(composing);

    expect(multiline.defaultPrevented).toBe(false);
    expect(composing.defaultPrevented).toBe(false);
    expect(scan).not.toHaveBeenCalled();
    expect(isSendKey(multiline)).toBe(false);
  });

  it('blocks sensitive content and never renders the raw value in its warning', async () => {
    composer().textContent = `send ${rawSecret}`;
    protection = installChatGptProtection(document, {
      scan: vi.fn().mockResolvedValue([finding]),
    });
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);

    sendButton().click();
    const warning = await warningElement();

    expect(sends).toBe(0);
    expect(warning.textContent).toContain('google_api_key');
    expect(warning.textContent).toContain('HIGH');
    expect(warning.textContent).not.toContain(rawSecret);

    warningButton('Cancel').click();
    expect(composer().textContent).toContain(rawSecret);
  });

  it('bypasses only the explicitly approved pending submission', async () => {
    composer().textContent = `send ${rawSecret}`;
    const scan = vi.fn().mockResolvedValue([finding]);
    protection = installChatGptProtection(document, { scan });
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);

    sendButton().click();
    await warningElement();
    warningButton('Send Anyway').click();
    await vi.waitFor(() => expect(sends).toBe(1));

    sendButton().click();
    await warningElement();
    expect(sends).toBe(1);
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it('installs once and continues protecting a composer recreated by SPA navigation', async () => {
    const scan = vi.fn().mockResolvedValue([]);
    const first = installChatGptProtection(document, { scan });
    protection = first;
    expect(installChatGptProtection(document, { scan })).toBe(first);

    document.body.innerHTML = composerMarkup('after navigation');
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);
    sendButton().click();

    await vi.waitFor(() => expect(sends).toBe(1));
    expect(scan).toHaveBeenCalledTimes(1);
  });
});

function composerMarkup(text: string): string {
  return `<form><div id="prompt-textarea" role="textbox" contenteditable="true">${text}</div><button data-testid="send-button" type="button">Send</button></form>`;
}

function composer(): HTMLElement {
  const element = document.querySelector<HTMLElement>('#prompt-textarea');
  if (!element) throw new Error('Missing test composer');
  return element;
}

function sendButton(): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>('[data-testid="send-button"]');
  if (!element) throw new Error('Missing test send button');
  return element;
}

async function warningElement(): Promise<HTMLElement> {
  await vi.waitFor(() => expect(document.querySelector('[data-debughalo-warning]')).not.toBeNull());
  return document.querySelector<HTMLElement>('[data-debughalo-warning]')!;
}

function warningButton(label: string): HTMLButtonElement {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-debughalo-warning] button'),
  ].find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`Missing warning button: ${label}`);
  return button;
}

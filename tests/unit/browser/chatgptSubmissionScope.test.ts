// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetectionResult } from '@/browser/index.js';
import {
  installChatGptProtection,
  type ChatGptProtection,
} from '../../../extension/src/adapters/chatgpt.js';

const secret = `AIza${'Ab3_'.repeat(8)}Ab3`;
const finding = { category: 'google_api_key', value: secret } as DetectionResult;
let protection: ChatGptProtection | undefined;

afterEach(() => {
  protection?.stop();
  protection = undefined;
  document.documentElement.querySelector('[data-debughalo-warning]')?.remove();
  document.body.replaceChildren();
});

describe('ChatGPT submission scoping and attachments', () => {
  it('does not intercept generic submit controls or Project-like forms outside the composer', () => {
    mount('chat text');
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<form id="project-form"><button id="generic" type="submit">Create Project</button><button id="project" aria-label="Send message" type="button">Create</button></form>'
    );
    const scan = vi.fn();
    const counters = vi.fn();
    protection = installChatGptProtection(document, { scan, recordEvent: counters });
    const generic = element<HTMLButtonElement>('generic');
    const project = element<HTMLButtonElement>('project');
    let actions = 0;
    generic.addEventListener('click', (event) => {
      event.preventDefault();
      actions++;
    });
    project.addEventListener('click', () => actions++);

    generic.click();
    project.click();

    expect(actions).toBe(2);
    expect(scan).not.toHaveBeenCalled();
    expect(counters).not.toHaveBeenCalled();
  });

  it.each(['', '   \n  '])(
    'allows an empty or whitespace-only composer through natively: %j',
    (text) => {
      mount(text);
      const scan = vi.fn();
      const counters = vi.fn();
      protection = installChatGptProtection(document, { scan, recordEvent: counters });
      let sends = 0;
      sendButton().addEventListener('click', () => sends++);

      sendButton().click();

      expect(sends).toBe(1);
      expect(scan).not.toHaveBeenCalled();
      expect(counters).not.toHaveBeenCalled();
    }
  );

  it('allows an attachment-only-shaped submission without scanning or mutation', () => {
    mount('', true);
    const attachment = attachmentNode();
    const scan = vi.fn();
    protection = installChatGptProtection(document, { scan });
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);

    sendButton().click();

    expect(sends).toBe(1);
    expect(scan).not.toHaveBeenCalled();
    expect(attachmentNode()).toBe(attachment);
  });

  it('scans attachment plus clean text once and preserves the attachment', async () => {
    mount('clean attachment message', true);
    const attachment = attachmentNode();
    const scan = vi.fn().mockResolvedValue([]);
    protection = installChatGptProtection(document, { scan });
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);

    sendButton().click();

    await vi.waitFor(() => expect(sends).toBe(1));
    expect(scan).toHaveBeenCalledOnce();
    expect(attachmentNode()).toBe(attachment);
  });

  it('blocks attachment plus sensitive text and Cancel preserves all state', async () => {
    mount(secret, true);
    const attachment = attachmentNode();
    protection = installChatGptProtection(document, {
      scan: vi.fn().mockResolvedValue([finding]),
    });
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);

    sendButton().click();
    await warning();
    action('Cancel').click();

    expect(sends).toBe(0);
    expect(composer().textContent).toBe(secret);
    expect(attachmentNode()).toBe(attachment);
  });

  it('sends sensitive text anyway exactly once without disturbing the attachment', async () => {
    mount(secret, true);
    const attachment = attachmentNode();
    const scan = vi.fn().mockResolvedValue([finding]);
    protection = installChatGptProtection(document, { scan });
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);

    sendButton().click();
    await warning();
    action('Send Anyway').click();

    await vi.waitFor(() => expect(sends).toBe(1));
    expect(scan).toHaveBeenCalledOnce();
    expect(attachmentNode()).toBe(attachment);
  });

  it('sanitizes only composer text and confirms once with the attachment intact', async () => {
    mount(`send ${secret}`, true);
    const attachment = attachmentNode();
    protection = installChatGptProtection(document, {
      scan: vi.fn().mockResolvedValue([finding]),
    });
    let sends = 0;
    sendButton().addEventListener('click', () => sends++);

    sendButton().click();
    await warning();
    action('Sanitize').click();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>('[data-debughalo-preview]')?.hidden).toBe(false)
    );
    expect(attachmentNode()).toBe(attachment);
    expect(composer().textContent).toContain(secret);
    action('Confirm Sanitized Send').click();

    await vi.waitFor(() => expect(sends).toBe(1));
    expect(composer().textContent).toBe('send <GOOGLE_API_KEY_1>');
    expect(attachmentNode()).toBe(attachment);
  });
});

function mount(text: string, attachment = false): void {
  document.body.innerHTML = `<form id="composer-form">${attachment ? '<div id="attachment" data-testid="attachment">test.png</div>' : ''}<div id="prompt-textarea" role="textbox" contenteditable="true">${text}</div><button data-testid="send-button" type="button">Send</button></form>`;
}

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function composer(): HTMLElement {
  return element<HTMLElement>('prompt-textarea');
}

function sendButton(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('[data-testid="send-button"]')!;
}

function attachmentNode(): HTMLElement {
  return element<HTMLElement>('attachment');
}

async function warning(): Promise<void> {
  await vi.waitFor(() => expect(document.querySelector('[data-debughalo-warning]')).not.toBeNull());
}

function action(label: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('[data-debughalo-warning] button')].find(
    (button) => button.textContent === label
  )!;
}

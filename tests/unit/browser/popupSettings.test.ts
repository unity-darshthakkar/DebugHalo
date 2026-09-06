// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializePopup } from '../../../extension/src/popup/index.js';
import type { ExtensionState } from '../../../extension/src/state/extensionState.js';

afterEach(() => document.body.replaceChildren());

describe('extension popup settings', () => {
  it('renders current protection, supported sites, and session counters', () => {
    mountPopup();
    const state = stateFixture();
    const stop = initializePopup(document, state);

    expect(document.body.textContent).toContain('ChatGPT');
    expect(document.body.textContent).toContain('Claude');
    expect(document.body.textContent).toContain('Gemini');
    expect(text('protection-status')).toBe('ON');
    expect(text('messages-scanned')).toBe('4');
    expect(text('submissions-blocked')).toBe('3');
    expect(text('messages-sanitized')).toBe('2');
    expect(text('send-anyway-uses')).toBe('1');
    stop();
  });

  it('updates the protection and on-detection preferences through semantic controls', async () => {
    mountPopup();
    const state = stateFixture();
    initializePopup(document, state);
    const toggle = element<HTMLInputElement>('protection-enabled');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    const select = element<HTMLSelectElement>('on-detection');
    select.value = 'block';
    select.dispatchEvent(new Event('change'));

    expect(state.updateSettings).toHaveBeenNthCalledWith(1, { protectionEnabled: false });
    expect(state.updateSettings).toHaveBeenNthCalledWith(2, { onDetection: 'block' });
  });

  it('reads latest session values when reopened and renders storage changes while open', () => {
    mountPopup();
    let scanned = 5;
    let listener = (): void => undefined;
    const state = stateFixture();
    state.getSessionStats = () => ({
      messagesScanned: scanned,
      sensitiveSubmissionsBlocked: 2,
      messagesSanitized: 1,
      sendAnywayUses: 1,
    });
    state.subscribe = (next) => {
      listener = next;
      return () => undefined;
    };
    const close = initializePopup(document, state);
    expect(text('messages-scanned')).toBe('5');

    scanned = 6;
    listener();
    expect(text('messages-scanned')).toBe('6');
    close();

    mountPopup();
    initializePopup(document, state);
    expect(text('messages-scanned')).toBe('6');
  });
});

function mountPopup(): void {
  document.body.innerHTML = `
    <h1>DebugHalo</h1><p>ChatGPT Claude Gemini</p>
    <output id="protection-status"></output>
    <span id="messages-scanned"></span><span id="submissions-blocked"></span>
    <span id="messages-sanitized"></span><span id="send-anyway-uses"></span>
    <input id="protection-enabled" type="checkbox">
    <select id="on-detection"><option value="ask">Ask</option><option value="block">Block</option></select>`;
}

function stateFixture(): ExtensionState {
  return {
    getSettings: () => ({ protectionEnabled: true, onDetection: 'ask' }),
    getSessionStats: () => ({
      messagesScanned: 4,
      sensitiveSubmissionsBlocked: 3,
      messagesSanitized: 2,
      sendAnywayUses: 1,
    }),
    updateSettings: vi.fn().mockResolvedValue({ protectionEnabled: true, onDetection: 'ask' }),
    increment: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    stop: vi.fn(),
  };
}

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function text(id: string): string | null {
  return document.getElementById(id)?.textContent ?? null;
}

// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, SANITIZED_MESSAGE } from '../../../website/src/App.js';
import { release } from '../../../website/src/release.js';

const styles = readFileSync(resolve('website/src/styles.css'), 'utf8');

let root: Root;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root')!);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('DebugHalo product website', () => {
  it('centralizes the stable release and renders the official download target', () => {
    expect(release).toMatchObject({
      version: 'v1.1.1',
      fileName: 'debughalo-extension-1.1.1.zip',
    });
    expect(release.downloadUrl).toBe(
      'https://github.com/unity-darshthakkar/DebugHalo/releases/download/v1.1.1/debughalo-extension-1.1.1.zip'
    );
    render();
    const downloads = [...document.querySelectorAll<HTMLAnchorElement>('a')].filter((link) =>
      link.textContent?.includes('Download')
    );
    expect(downloads.length).toBeGreaterThanOrEqual(3);
    expect(downloads.every((link) => link.href === release.downloadUrl)).toBe(true);
    expect(document.body.textContent).toContain('Latest stable · v1.1.1');
  });

  it('renders supported sites, manual installation, and the attachment limitation', () => {
    render();
    expect(document.body.textContent).toContain('ChatGPT');
    expect(document.body.textContent).toContain('Claude');
    expect(document.body.textContent).toContain('Gemini');
    expect(document.body.textContent).toContain('chrome://extensions');
    expect(document.body.textContent).toContain('Load unpacked');
    expect(document.body.textContent).toContain(
      'File and image attachment contents are not scanned in the current release.'
    );
  });

  it('progresses through block, sanitize preview, and confirmed demo states', async () => {
    vi.useFakeTimers();
    render();
    const send = button('Send');
    act(() => send.click());
    await act(async () => vi.advanceTimersByTime(600));

    const review = document.querySelector<HTMLElement>('[data-testid="review-card"]')!;
    expect(review.textContent).toContain('AWS Access Key');
    expect(review.textContent).toContain('HIGH');
    expect(review.textContent).not.toContain('AKIAIOSFODNN7EXAMPLE');

    act(() => button('Sanitize').click());
    expect(review.textContent).toContain(SANITIZED_MESSAGE);
    act(() => button('Confirm sanitized send').click());
    expect(document.querySelector('[data-testid="sent-message"]')?.textContent).toContain(
      SANITIZED_MESSAGE
    );
  });

  it('keeps interaction available under reduced-motion styling', () => {
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('.reveal');
    render();
    expect(button('Send').disabled).toBe(false);
  });
});

function render(): void {
  act(() => root.render(<App />));
}

function button(label: string): HTMLButtonElement {
  const match = [...document.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.trim().includes(label)
  );
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

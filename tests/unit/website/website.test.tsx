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
    expect(document.body.textContent).toContain('Latest stable: v1.1.1');
    expect(document.querySelector('#install')?.textContent).toContain('Latest stable: v1.1.1');
    expect(document.querySelector('#top')?.textContent).not.toContain('Latest stable');
    expect(document.querySelector('#top')?.textContent).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(document.querySelector('#top')?.textContent).toContain(
      'Local-first. No message content sent to DebugHalo servers.'
    );
  });

  it('renders factual trust signals and current scope limitations', () => {
    render();
    expect(document.body.textContent).toContain('Local scanning');
    expect(document.body.textContent).toContain('Open source');
    expect(document.body.textContent).toContain('No message telemetry');
    expect(document.body.textContent).toContain('600+');
    expect(document.body.textContent).toContain('production dependency vulnerabilities');
    expect(document.body.textContent).toContain('File attachment contents');
    expect(document.body.textContent).toContain('Image contents');
    expect(document.body.textContent).toContain('Arbitrary desktop applications');
    expect(document.body.textContent).toContain('Unsupported AI sites');
    for (const roadmapItem of [
      'Attachment scanning',
      'Response restoration',
      'Local extension vault',
      'VS Code integration',
      'Desktop protection',
      'Additional AI platforms',
    ]) {
      expect(document.querySelector('#roadmap')?.textContent).toContain(roadmapItem);
    }
  });

  it('renders supported sites and explains the manual installation requirement', () => {
    render();
    expect(document.body.textContent).toContain('ChatGPT');
    expect(document.body.textContent).toContain('Claude');
    expect(document.body.textContent).toContain('Gemini');
    expect(document.body.textContent).toContain('Live text protection');
    expect(document.body.textContent).toContain('chrome://extensions');
    expect(document.body.textContent).toContain('Load unpacked');
    expect(document.body.textContent).toContain(
      'Developer mode is currently required because DebugHalo is not yet published in the Chrome Web Store.'
    );
    expect(document.body.textContent).toContain(
      'Downloads come directly from the official DebugHalo GitHub Release.'
    );
  });

  it('progresses through block, sanitize preview, and confirmed demo states', async () => {
    vi.useFakeTimers();
    render();
    const send = button('Send');
    act(() => send.click());
    expect(document.body.textContent).toContain('Local scan in progress');
    await act(async () => vi.advanceTimersByTime(600));

    const review = document.querySelector<HTMLElement>('[data-testid="review-card"]')!;
    expect(document.body.textContent).toContain('Credential detected · submission blocked');
    expect(review.textContent).toContain('AWS Access Key');
    expect(review.textContent).toContain('HIGH');
    expect(review.textContent).not.toContain('AKIAIOSFODNN7EXAMPLE');

    act(() => button('Sanitize').click());
    expect(document.body.textContent).toContain('Safe alias ready for confirmation');
    expect(review.textContent).toContain(SANITIZED_MESSAGE);
    act(() => button('Confirm sanitized send').click());
    expect(document.body.textContent).toContain('Sanitized message sent');
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

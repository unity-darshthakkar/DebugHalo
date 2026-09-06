import { scanText, type DetectionResult } from '../../../src/browser/index.js';

const COMPOSER_SELECTOR = [
  '#prompt-textarea',
  '[data-testid="composer-text-input"]',
  '[contenteditable="true"][role="textbox"]',
  'textarea',
].join(',');

const SEND_BUTTON_SELECTOR = [
  'button[data-testid="send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send message"]',
  'button[type="submit"]',
].join(',');

const installedDocuments = new WeakMap<Document, ChatGptProtection>();

export type ChatGptScanner = (text: string) => Promise<ReadonlyArray<DetectionResult>>;

export type WarningDecision = 'cancel' | 'send';

export type WarningPresenter = (
  findings: ReadonlyArray<DetectionResult>,
  scanFailed?: boolean
) => Promise<WarningDecision>;

export interface ChatGptProtection {
  stop(): void;
}

export interface ChatGptProtectionOptions {
  scan?: ChatGptScanner;
  presentWarning?: WarningPresenter;
}

export function extractComposerText(composer: Element): string {
  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
    return composer.value;
  }
  return (composer as HTMLElement).innerText ?? composer.textContent ?? '';
}

export function isSendKey(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'isComposing'>): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing;
}

export function installChatGptProtection(
  document: Document,
  options: ChatGptProtectionOptions = {}
): ChatGptProtection {
  const existing = installedDocuments.get(document);
  if (existing) return existing;

  const scan = options.scan ?? scanText;
  const presentWarning =
    options.presentWarning ??
    ((findings, scanFailed) => showWarning(document, findings, scanFailed));
  const bypassTargets = new WeakSet<EventTarget>();
  let pending = false;

  const resume = (target: HTMLElement): void => {
    bypassTargets.add(target);
    if (target instanceof HTMLButtonElement) {
      target.click();
      return;
    }
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
  };

  const protect = async (event: Event, composer: HTMLElement, resumeTarget: HTMLElement) => {
    if (bypassTargets.delete(resumeTarget)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (pending) return;

    const pendingText = extractComposerText(composer);
    if (!pendingText.trim()) return;
    pending = true;

    try {
      const findings = await scan(pendingText);
      const decision = findings.length === 0 ? 'send' : await presentWarning(findings);
      if (decision === 'send' && extractComposerText(composer) === pendingText) {
        resume(resumeTarget);
      }
    } catch {
      const decision = await presentWarning([], true);
      if (decision === 'send' && extractComposerText(composer) === pendingText) {
        resume(resumeTarget);
      }
    } finally {
      pending = false;
    }
  };

  const onClick = (event: MouseEvent): void => {
    const button = closestElement(event.target, SEND_BUTTON_SELECTOR);
    if (!(button instanceof HTMLButtonElement)) return;
    const composer = findComposer(document, button);
    if (!composer) return;
    void protect(event, composer, button);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isSendKey(event)) return;
    const composer = closestElement(event.target, COMPOSER_SELECTOR);
    if (!(composer instanceof HTMLElement)) return;
    const button = findSendButton(document, composer);
    void protect(event, composer, button ?? composer);
  };

  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);

  const protection: ChatGptProtection = {
    stop() {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      installedDocuments.delete(document);
    },
  };
  installedDocuments.set(document, protection);
  return protection;
}

function closestElement(target: EventTarget | null, selector: string): Element | null {
  return target instanceof Element ? target.closest(selector) : null;
}

function findComposer(document: Document, button: Element): HTMLElement | null {
  const formComposer = button.closest('form')?.querySelector(COMPOSER_SELECTOR);
  return (formComposer ?? document.querySelector(COMPOSER_SELECTOR)) as HTMLElement | null;
}

function findSendButton(document: Document, composer: Element): HTMLButtonElement | null {
  const formButton = composer.closest('form')?.querySelector(SEND_BUTTON_SELECTOR);
  return (formButton ?? document.querySelector(SEND_BUTTON_SELECTOR)) as HTMLButtonElement | null;
}

function showWarning(
  document: Document,
  findings: ReadonlyArray<DetectionResult>,
  scanFailed = false
): Promise<WarningDecision> {
  return new Promise((resolve) => {
    document.querySelector('[data-debughalo-warning]')?.remove();

    const overlay = document.createElement('div');
    overlay.dataset['debughaloWarning'] = 'true';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(0,0,0,.6);padding:20px';

    const panel = document.createElement('section');
    panel.style.cssText =
      'max-width:480px;width:100%;box-sizing:border-box;background:#fff;color:#111;border-radius:12px;padding:20px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 16px 48px rgba(0,0,0,.35)';

    const heading = document.createElement('h2');
    heading.textContent = scanFailed
      ? 'DebugHalo could not complete the local scan'
      : 'DebugHalo detected potentially sensitive content';
    heading.style.margin = '0 0 12px';
    panel.append(heading);

    if (!scanFailed) {
      const list = document.createElement('ul');
      for (const finding of findings) {
        const item = document.createElement('li');
        item.textContent = `${finding.category} · ${finding.severity ?? 'unknown'} · ${Math.round(finding.confidence * 100)}% confidence`;
        list.append(item);
      }
      panel.append(list);
    }

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    const send = document.createElement('button');
    send.type = 'button';
    send.textContent = 'Send Anyway';

    const finish = (decision: WarningDecision): void => {
      overlay.remove();
      resolve(decision);
    };
    cancel.addEventListener('click', () => finish('cancel'), { once: true });
    send.addEventListener('click', () => finish('send'), { once: true });
    actions.append(cancel, send);
    panel.append(actions);
    overlay.append(panel);
    document.documentElement.append(overlay);
    cancel.focus();
  });
}

import {
  sanitizeText,
  scanText,
  type DetectionResult,
  type SanitizationResult,
} from '../../../src/browser/index.js';
import {
  showComposerChanged,
  showReview,
  showScanFailure,
  type ReviewDecision,
  type ReviewPresenter,
} from '../ui/review.js';

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
export type ChatGptSanitizer = (text: string) => Promise<SanitizationResult>;

export interface ChatGptProtection {
  stop(): void;
}

export interface ChatGptProtectionOptions {
  scan?: ChatGptScanner;
  sanitize?: ChatGptSanitizer;
  presentReview?: ReviewPresenter;
  presentScanFailure?: () => Promise<'cancel' | 'send'>;
  notifyComposerChanged?: () => void;
}

export function extractComposerText(composer: Element): string {
  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
    return composer.value;
  }
  return (composer as HTMLElement).innerText ?? composer.textContent ?? '';
}

export function replaceComposerText(composer: HTMLElement, text: string): void {
  const document = composer.ownerDocument;
  const view = document.defaultView;

  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
    const prototype =
      composer instanceof HTMLTextAreaElement
        ? view?.HTMLTextAreaElement.prototype
        : view?.HTMLInputElement.prototype;
    const setter = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value')?.set : undefined;
    if (setter) setter.call(composer, text);
    else composer.value = text;
  } else {
    composer.focus();
    const selection = view?.getSelection();
    selection?.selectAllChildren(composer);
    const inserted = document.execCommand?.('insertText', false, text) ?? false;
    if (!inserted) composer.textContent = text;
  }

  const InputEventConstructor = view?.InputEvent ?? Event;
  composer.dispatchEvent(new InputEventConstructor('input', { bubbles: true }));
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
  const sanitize = options.sanitize ?? sanitizeText;
  const presentReview = options.presentReview ?? ((request) => showReview(document, request));
  const presentScanFailure = options.presentScanFailure ?? (() => showScanFailure(document));
  const notifyComposerChanged =
    options.notifyComposerChanged ?? (() => showComposerChanged(document));
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

  const applyDecision = async (
    decision: ReviewDecision,
    composer: HTMLElement,
    resumeTarget: HTMLElement,
    pendingText: string
  ): Promise<void> => {
    if (decision.action === 'cancel') {
      composer.focus();
      return;
    }
    if (extractComposerText(composer) !== pendingText) {
      notifyComposerChanged();
      return;
    }
    if (decision.action === 'send-original') {
      resume(resumeTarget);
      return;
    }

    replaceComposerText(composer, decision.sanitizedText);
    if (extractComposerText(composer) !== decision.sanitizedText) {
      notifyComposerChanged();
      return;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const currentComposer = document.querySelector(COMPOSER_SELECTOR) as HTMLElement | null;
    if (!currentComposer || extractComposerText(currentComposer) !== decision.sanitizedText) {
      notifyComposerChanged();
      return;
    }
    resume(findSendButton(document, currentComposer) ?? currentComposer);
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
      const decision: ReviewDecision =
        findings.length === 0
          ? { action: 'send-original' }
          : await presentReview({ findings, originalText: pendingText, sanitize });
      await applyDecision(decision, composer, resumeTarget, pendingText);
    } catch {
      const action = await presentScanFailure();
      await applyDecision(
        { action: action === 'send' ? 'send-original' : 'cancel' },
        composer,
        resumeTarget,
        pendingText
      );
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

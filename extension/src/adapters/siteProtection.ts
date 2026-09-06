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

const installedProtections = new WeakMap<Document, Map<string, SiteProtection>>();

export type SiteScanner = (text: string) => Promise<ReadonlyArray<DetectionResult>>;
export type SiteSanitizer = (text: string) => Promise<SanitizationResult>;

export interface SiteProtection {
  stop(): void;
}

export interface SiteProtectionOptions {
  scan?: SiteScanner;
  sanitize?: SiteSanitizer;
  presentReview?: ReviewPresenter;
  presentScanFailure?: () => Promise<'cancel' | 'send'>;
  notifyComposerChanged?: () => void;
}

export interface SiteAdapterConfig {
  id: string;
  composerSelectors: ReadonlyArray<string>;
  sendButtonSelectors: ReadonlyArray<string>;
  extractComposerText?: (composer: Element) => string;
  replaceComposerText?: (composer: HTMLElement, text: string) => void;
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

export function installSiteProtection(
  document: Document,
  config: SiteAdapterConfig,
  options: SiteProtectionOptions = {}
): SiteProtection {
  const documentProtections =
    installedProtections.get(document) ?? new Map<string, SiteProtection>();
  const existing = documentProtections.get(config.id);
  if (existing) return existing;

  const composerSelector = config.composerSelectors.join(',');
  const sendButtonSelector = config.sendButtonSelectors.join(',');
  const extractText = config.extractComposerText ?? extractComposerText;
  const replaceText = config.replaceComposerText ?? replaceComposerText;
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
    if (target.tagName === 'BUTTON') {
      target.click();
      return;
    }
    const KeyboardEventConstructor = document.defaultView?.KeyboardEvent ?? KeyboardEvent;
    target.dispatchEvent(
      new KeyboardEventConstructor('keydown', { key: 'Enter', bubbles: true, cancelable: true })
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
    if (extractText(composer) !== pendingText) {
      notifyComposerChanged();
      return;
    }
    if (decision.action === 'send-original') {
      resume(resumeTarget);
      return;
    }

    replaceText(composer, decision.sanitizedText);
    if (extractText(composer) !== decision.sanitizedText) {
      notifyComposerChanged();
      return;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const currentComposer = document.querySelector(composerSelector) as HTMLElement | null;
    if (!currentComposer || extractText(currentComposer) !== decision.sanitizedText) {
      notifyComposerChanged();
      return;
    }
    resume(findSendButton(document, currentComposer, sendButtonSelector) ?? currentComposer);
  };

  const protect = async (event: Event, composer: HTMLElement, resumeTarget: HTMLElement) => {
    if (bypassTargets.delete(resumeTarget)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (pending) return;

    const pendingText = extractText(composer);
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
    const button = closestElement(event.target, sendButtonSelector);
    if (!(button instanceof HTMLElement)) return;
    const composer = findComposer(document, button, composerSelector);
    if (!composer) return;
    void protect(event, composer, button);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isSendKey(event)) return;
    const composer = closestElement(event.target, composerSelector);
    if (!(composer instanceof HTMLElement)) return;
    const button = findSendButton(document, composer, sendButtonSelector);
    void protect(event, composer, button ?? composer);
  };

  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);

  const protection: SiteProtection = {
    stop() {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      documentProtections.delete(config.id);
      if (documentProtections.size === 0) installedProtections.delete(document);
    },
  };
  documentProtections.set(config.id, protection);
  installedProtections.set(document, documentProtections);
  return protection;
}

function closestElement(target: EventTarget | null, selector: string): Element | null {
  return target instanceof Element ? target.closest(selector) : null;
}

function findComposer(
  document: Document,
  button: Element,
  composerSelector: string
): HTMLElement | null {
  const formComposer = button.closest('form')?.querySelector(composerSelector);
  return (formComposer ?? document.querySelector(composerSelector)) as HTMLElement | null;
}

function findSendButton(
  document: Document,
  composer: Element,
  sendButtonSelector: string
): HTMLElement | null {
  const formButton = composer.closest('form')?.querySelector(sendButtonSelector);
  return (formButton ?? document.querySelector(sendButtonSelector)) as HTMLElement | null;
}

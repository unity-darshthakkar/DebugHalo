import { createChromeExtensionState } from '../state/chromeStorage.js';
import type { DetectionAction, ExtensionState } from '../state/extensionState.js';

export function initializePopup(document: Document, state: ExtensionState): () => void {
  const protection = requiredElement<HTMLInputElement>(document, 'protection-enabled');
  const detectionAction = requiredElement<HTMLSelectElement>(document, 'on-detection');
  const status = requiredElement<HTMLOutputElement>(document, 'protection-status');
  const render = (): void => {
    const settings = state.getSettings();
    const stats = state.getSessionStats();
    protection.checked = settings.protectionEnabled;
    detectionAction.value = settings.onDetection;
    detectionAction.disabled = !settings.protectionEnabled;
    status.textContent = settings.protectionEnabled ? 'ON' : 'OFF';
    status.dataset['enabled'] = String(settings.protectionEnabled);
    setCount(document, 'messages-scanned', stats.messagesScanned);
    setCount(document, 'submissions-blocked', stats.sensitiveSubmissionsBlocked);
    setCount(document, 'messages-sanitized', stats.messagesSanitized);
    setCount(document, 'send-anyway-uses', stats.sendAnywayUses);
  };
  const onProtectionChange = (): void => {
    void state.updateSettings({ protectionEnabled: protection.checked }).catch(render);
  };
  const onActionChange = (): void => {
    void state
      .updateSettings({ onDetection: detectionAction.value as DetectionAction })
      .catch(render);
  };
  protection.addEventListener('change', onProtectionChange);
  detectionAction.addEventListener('change', onActionChange);
  const unsubscribe = state.subscribe(render);
  render();
  return () => {
    protection.removeEventListener('change', onProtectionChange);
    detectionAction.removeEventListener('change', onActionChange);
    unsubscribe();
  };
}

function requiredElement<T extends HTMLElement>(document: Document, id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing extension element: ${id}`);
  return element as T;
}

function setCount(document: Document, id: string, value: number): void {
  requiredElement<HTMLElement>(document, id).textContent = String(value);
}

if (typeof document !== 'undefined' && 'chrome' in globalThis) {
  void createChromeExtensionState()
    .then((state) => initializePopup(document, state))
    .catch(() => {
      const status = document.getElementById('protection-status');
      if (status) status.textContent = 'Storage unavailable';
    });
}

import {
  createExtensionState,
  type ExtensionState,
  type ExtensionStorage,
} from './extensionState.js';
import { ENABLE_SESSION_STORAGE_MESSAGE } from './sessionAccess.js';

interface ChromeWithStorage {
  storage: ExtensionStorage;
  runtime?: {
    sendMessage(message: string): Promise<{ ok?: boolean } | undefined>;
  };
}

export async function createChromeExtensionState(): Promise<ExtensionState> {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeWithStorage }).chrome;
  if (!chromeApi?.storage) throw new Error('Chrome extension storage is unavailable.');
  if (chromeApi.runtime) {
    const response = await chromeApi.runtime.sendMessage(ENABLE_SESSION_STORAGE_MESSAGE);
    if (!response?.ok) throw new Error('Session storage access could not be initialized.');
  }
  return createExtensionState(chromeApi.storage);
}

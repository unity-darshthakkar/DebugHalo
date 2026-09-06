import {
  ENABLE_SESSION_STORAGE_MESSAGE,
  enableContentScriptSessionStorage,
  type SessionStorageAccess,
} from '../state/sessionAccess.js';

interface BackgroundChromeApi {
  storage: { session: SessionStorageAccess };
  runtime: {
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: { ok: boolean }) => void
        ) => boolean | void
      ): void;
    };
  };
}

const chromeApi = (globalThis as typeof globalThis & { chrome: BackgroundChromeApi }).chrome;
let accessReady = enableContentScriptSessionStorage(chromeApi.storage.session);

chromeApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message !== ENABLE_SESSION_STORAGE_MESSAGE) return;
  accessReady = accessReady.catch(() =>
    enableContentScriptSessionStorage(chromeApi.storage.session)
  );
  void accessReady.then(
    () => sendResponse({ ok: true }),
    () => sendResponse({ ok: false })
  );
  return true;
});

import type { SiteProtection, SiteProtectionOptions } from '../adapters/siteProtection.js';
import { createChromeExtensionState } from '../state/chromeStorage.js';

export async function installConfiguredProtection(
  install: (document: Document, options: SiteProtectionOptions) => SiteProtection
): Promise<void> {
  try {
    const state = await createChromeExtensionState();
    install(document, {
      getPolicy: () => state.getSettings(),
      recordEvent: (counter) => {
        void state.increment(counter).catch(() => undefined);
      },
    });
  } catch {
    install(document, {});
  }
}

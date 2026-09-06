import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChromeExtensionState } from '../../../extension/src/state/chromeStorage.js';
import { EMPTY_SESSION_STATS } from '../../../extension/src/state/extensionState.js';
import {
  ENABLE_SESSION_STORAGE_MESSAGE,
  enableContentScriptSessionStorage,
} from '../../../extension/src/state/sessionAccess.js';

afterEach(() => vi.unstubAllGlobals());

describe('Chrome session storage access', () => {
  it('enables content-script access with the Chromium-required access level', async () => {
    const setAccessLevel = vi.fn().mockResolvedValue(undefined);
    await enableContentScriptSessionStorage({ setAccessLevel });
    expect(setAccessLevel).toHaveBeenCalledWith({
      accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
    });
  });

  it('waits for the background access handshake before reading session counters', async () => {
    const order: string[] = [];
    const sendMessage = vi.fn(async () => {
      order.push('access');
      return { ok: true };
    });
    const getLocal = vi.fn(async () => ({}));
    const getSession = vi.fn(async () => {
      order.push('session-read');
      return {};
    });
    vi.stubGlobal('chrome', chromeFixture(sendMessage, getLocal, getSession));

    const state = await createChromeExtensionState();

    expect(sendMessage).toHaveBeenCalledWith(ENABLE_SESSION_STORAGE_MESSAGE);
    expect(order).toEqual(['access', 'session-read']);
    expect(state.getSessionStats()).toEqual(EMPTY_SESSION_STATS);
  });

  it('does not silently initialize counter state when session access was denied', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('chrome', chromeFixture(sendMessage, vi.fn(), vi.fn()));
    await expect(createChromeExtensionState()).rejects.toThrow(
      'Session storage access could not be initialized.'
    );
  });
});

function chromeFixture(
  sendMessage: ReturnType<typeof vi.fn>,
  getLocal: ReturnType<typeof vi.fn>,
  getSession: ReturnType<typeof vi.fn>
) {
  return {
    runtime: { sendMessage },
    storage: {
      local: { get: getLocal, set: vi.fn() },
      session: { get: getSession, set: vi.fn() },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  };
}

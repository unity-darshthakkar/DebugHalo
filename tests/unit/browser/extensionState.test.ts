import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  EMPTY_SESSION_STATS,
  SESSION_STATS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  createExtensionState,
  type ExtensionStorage,
  type StorageChange,
} from '../../../extension/src/state/extensionState.js';

function storageFixture(initial: { local?: unknown; session?: unknown } = {}) {
  const values = {
    local: { [SETTINGS_STORAGE_KEY]: initial.local } as Record<string, unknown>,
    session: { [SESSION_STATS_STORAGE_KEY]: initial.session } as Record<string, unknown>,
  };
  const listeners = new Set<(changes: Record<string, StorageChange>, area: string) => void>();
  const area = (name: 'local' | 'session') => ({
    get: vi.fn(async () => ({ ...values[name] })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(values[name], items);
      const changes = Object.fromEntries(
        Object.entries(items).map(([key, newValue]) => [key, { newValue }])
      );
      listeners.forEach((listener) => listener(changes, name));
    }),
  });
  const storage: ExtensionStorage = {
    local: area('local'),
    session: area('session'),
    onChanged: {
      addListener: (listener) => listeners.add(listener),
      removeListener: (listener) => listeners.delete(listener),
    },
  };
  return { storage, values };
}

describe('extension settings and safe session statistics', () => {
  it('uses safe defaults and normalizes malformed stored data', async () => {
    const { storage } = storageFixture({
      local: { protectionEnabled: 'yes', onDetection: 'unknown', rawMessage: 'secret' },
      session: { messagesScanned: -1, sensitiveSubmissionsBlocked: '2', secret: 'value' },
    });
    const state = await createExtensionState(storage);

    expect(state.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(state.getSessionStats()).toEqual(EMPTY_SESSION_STATS);
  });

  it('persists only the documented preference schema', async () => {
    const { storage, values } = storageFixture();
    const state = await createExtensionState(storage);
    await state.updateSettings({ protectionEnabled: false, onDetection: 'block' });

    expect(values.local).toEqual({
      [SETTINGS_STORAGE_KEY]: { protectionEnabled: false, onDetection: 'block' },
    });
    expect(JSON.stringify(values.local)).not.toMatch(/message|secret|finding|composer/i);
  });

  it('serializes counter increments and stores numbers only', async () => {
    const { storage, values } = storageFixture();
    const state = await createExtensionState(storage);
    await Promise.all([
      state.increment('messagesScanned'),
      state.increment('messagesScanned'),
      state.increment('sensitiveSubmissionsBlocked'),
      state.increment('messagesSanitized'),
      state.increment('sendAnywayUses'),
    ]);

    expect(state.getSessionStats()).toEqual({
      messagesScanned: 2,
      sensitiveSubmissionsBlocked: 1,
      messagesSanitized: 1,
      sendAnywayUses: 1,
    });
    expect(
      Object.values(values.session[SESSION_STATS_STORAGE_KEY] as object).every(
        (value) => typeof value === 'number'
      )
    ).toBe(true);
  });
});

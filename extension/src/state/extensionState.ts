export type DetectionAction = 'ask' | 'sanitize' | 'block';

export interface ExtensionSettings {
  protectionEnabled: boolean;
  onDetection: DetectionAction;
}

export interface SessionStats {
  messagesScanned: number;
  sensitiveSubmissionsBlocked: number;
  messagesSanitized: number;
  sendAnywayUses: number;
}

export type SessionCounter = keyof SessionStats;

export const DEFAULT_SETTINGS: Readonly<ExtensionSettings> = {
  protectionEnabled: true,
  onDetection: 'ask',
};

export const EMPTY_SESSION_STATS: Readonly<SessionStats> = {
  messagesScanned: 0,
  sensitiveSubmissionsBlocked: 0,
  messagesSanitized: 0,
  sendAnywayUses: 0,
};

export const SETTINGS_STORAGE_KEY = 'debughaloSettings';
export const SESSION_STATS_STORAGE_KEY = 'debughaloSessionStats';

export interface StorageArea {
  get(keys: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface StorageChange {
  newValue?: unknown;
}

export interface ExtensionStorage {
  local: StorageArea;
  session: StorageArea;
  onChanged: {
    addListener(listener: (changes: Record<string, StorageChange>, areaName: string) => void): void;
    removeListener(
      listener: (changes: Record<string, StorageChange>, areaName: string) => void
    ): void;
  };
}

export interface ExtensionState {
  getSettings(): ExtensionSettings;
  getSessionStats(): SessionStats;
  updateSettings(update: Partial<ExtensionSettings>): Promise<ExtensionSettings>;
  increment(counter: SessionCounter): Promise<void>;
  subscribe(listener: () => void): () => void;
  stop(): void;
}

export async function createExtensionState(storage: ExtensionStorage): Promise<ExtensionState> {
  const [storedSettings, storedStats] = await Promise.all([
    storage.local.get(SETTINGS_STORAGE_KEY),
    storage.session.get(SESSION_STATS_STORAGE_KEY),
  ]);
  let settings = normalizeSettings(storedSettings[SETTINGS_STORAGE_KEY]);
  let stats = normalizeStats(storedStats[SESSION_STATS_STORAGE_KEY]);
  let counterWrites = Promise.resolve();
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((listener) => listener());

  const onChanged = (changes: Record<string, StorageChange>, areaName: string): void => {
    if (areaName === 'local' && changes[SETTINGS_STORAGE_KEY]) {
      settings = normalizeSettings(changes[SETTINGS_STORAGE_KEY].newValue);
      notify();
    }
    if (areaName === 'session' && changes[SESSION_STATS_STORAGE_KEY]) {
      stats = normalizeStats(changes[SESSION_STATS_STORAGE_KEY].newValue);
      notify();
    }
  };
  storage.onChanged.addListener(onChanged);

  return {
    getSettings: () => ({ ...settings }),
    getSessionStats: () => ({ ...stats }),
    async updateSettings(update) {
      settings = normalizeSettings({ ...settings, ...update });
      await storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
      notify();
      return { ...settings };
    },
    increment(counter) {
      counterWrites = counterWrites.then(async () => {
        stats = { ...stats, [counter]: stats[counter] + 1 };
        await storage.session.set({ [SESSION_STATS_STORAGE_KEY]: stats });
        notify();
      });
      return counterWrites;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop() {
      storage.onChanged.removeListener(onChanged);
      listeners.clear();
    },
  };
}

export function normalizeSettings(value: unknown): ExtensionSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };
  const onDetection = value['onDetection'];
  return {
    protectionEnabled:
      typeof value['protectionEnabled'] === 'boolean'
        ? value['protectionEnabled']
        : DEFAULT_SETTINGS.protectionEnabled,
    onDetection:
      onDetection === 'ask' || onDetection === 'sanitize' || onDetection === 'block'
        ? onDetection
        : DEFAULT_SETTINGS.onDetection,
  };
}

export function normalizeStats(value: unknown): SessionStats {
  if (!isRecord(value)) return { ...EMPTY_SESSION_STATS };
  return {
    messagesScanned: safeCounter(value['messagesScanned']),
    sensitiveSubmissionsBlocked: safeCounter(value['sensitiveSubmissionsBlocked']),
    messagesSanitized: safeCounter(value['messagesSanitized']),
    sendAnywayUses: safeCounter(value['sendAnywayUses']),
  };
}

function safeCounter(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

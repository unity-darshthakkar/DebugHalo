export const ENABLE_SESSION_STORAGE_MESSAGE = 'debughalo-enable-session-storage';

export interface SessionStorageAccess {
  setAccessLevel(details: { accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }): Promise<void>;
}

export function enableContentScriptSessionStorage(session: SessionStorageAccess): Promise<void> {
  return session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
}

/**
 * サーバーとのセッション同期
 */

import { localSessionStore } from './local-session-store';

export interface SyncSessionParams {
  localId: string;
  onSuccess?: (serverId: string) => void;
  onError?: (error: Error) => void;
}

/**
 * ローカルセッションをサーバーと同期
 */
export async function syncSessionToServer({
  localId,
  onSuccess,
  onError,
}: SyncSessionParams): Promise<string | null> {
  try {
    const localSession = localSessionStore.get(localId);

    if (!localSession) {
      throw new Error('Local session not found');
    }

    if (localSession.synced) {
      // Already synced
      return localSession.serverId || null;
    }

    if (localSession.syncing) {
      // Already syncing
      return null;
    }

    // Mark as syncing
    localSessionStore.setSyncing(localId, true);

    // Create session on server (without initial message - will be sent after sync)
    const response = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consultType: localSession.consultType,
        isAnonymous: localSession.isAnonymous,
        // Don't send initialMessage - it will be sent after sync completes
        ...(localSession.targetUserIds && {
          targetUserHandles: localSession.targetUserIds,
        }),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to sync session');
    }

    const data = await response.json();
    const serverId = data.id || data.sessionId;

    // Update local store with server ID
    localSessionStore.updateWithServerId(localId, serverId);

    onSuccess?.(serverId);
    return serverId;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    localSessionStore.setError(localId, err.message);
    onError?.(err);
    return null;
  }
}

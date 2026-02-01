/**
 * ローカルファーストセッション管理
 * サーバー同期前のセッションをメモリとIndexedDBで管理
 */

import { indexedDB } from './indexed-db';

export interface OptimisticMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  responderId?: string;
}

export interface OptimisticSession {
  id: string; // ローカル一時ID（"local-xxx"形式）
  serverId?: string; // サーバーから返されたID
  consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
  messages: OptimisticMessage[];
  isAnonymous: boolean;
  targetUserIds?: string[];
  syncing: boolean;
  synced: boolean;
  error?: string;
  createdAt: number;
}

class LocalSessionStore {
  private sessions = new Map<string, OptimisticSession>();

  /**
   * ローカルセッションを作成
   */
  create(params: {
    consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
    initialMessage: string;
    isAnonymous: boolean;
    targetUserIds?: string[];
  }): OptimisticSession {
    const localId = `local-${crypto.randomUUID()}`;
    const session: OptimisticSession = {
      id: localId,
      consultType: params.consultType,
      messages: [
        {
          id: `local-msg-${crypto.randomUUID()}`,
          role: 'user',
          content: params.initialMessage,
          timestamp: new Date(),
        },
      ],
      isAnonymous: params.isAnonymous,
      targetUserIds: params.targetUserIds,
      syncing: false,
      synced: false,
      createdAt: Date.now(),
    };

    this.sessions.set(localId, session);

    // Persist to IndexedDB
    indexedDB.saveSession(session).catch(console.error);

    return session;
  }

  /**
   * ローカルセッションを取得
   */
  get(id: string): OptimisticSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * サーバーIDで更新（同期完了時）
   */
  updateWithServerId(localId: string, serverId: string): void {
    const session = this.sessions.get(localId);
    if (session) {
      session.serverId = serverId;
      session.synced = true;
      session.syncing = false;
      this.sessions.set(localId, session);

      // Persist to IndexedDB
      indexedDB.saveSession(session).catch(console.error);
    }
  }

  /**
   * 同期状態を更新
   */
  setSyncing(localId: string, syncing: boolean): void {
    const session = this.sessions.get(localId);
    if (session) {
      session.syncing = syncing;
      this.sessions.set(localId, session);

      // Persist to IndexedDB
      indexedDB.saveSession(session).catch(console.error);
    }
  }

  /**
   * エラー状態を設定
   */
  setError(localId: string, error: string): void {
    const session = this.sessions.get(localId);
    if (session) {
      session.error = error;
      session.syncing = false;
      this.sessions.set(localId, session);

      // Persist to IndexedDB
      indexedDB.saveSession(session).catch(console.error);
    }
  }

  /**
   * セッションを削除
   */
  delete(id: string): void {
    this.sessions.delete(id);

    // Remove from IndexedDB
    indexedDB.deleteSession(id).catch(console.error);
  }

  /**
   * IndexedDBからセッションをロード（起動時）
   */
  async loadFromIndexedDB(): Promise<void> {
    try {
      const sessions = await indexedDB.getAllSessions();
      sessions.forEach((session) => {
        // Only load local sessions that haven't been synced yet
        if (session.id.startsWith('local-') && !session.synced) {
          this.sessions.set(session.id, session);
        }
      });
      console.log('[LocalSessionStore] Loaded', sessions.length, 'sessions from IndexedDB');
    } catch (error) {
      console.error('[LocalSessionStore] Failed to load from IndexedDB:', error);
    }
  }

  /**
   * 古いセッションをクリーンアップ（1時間以上前）
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, session] of this.sessions.entries()) {
      if (session.createdAt < oneHourAgo && session.synced) {
        this.sessions.delete(id);
      }
    }
  }
}

// シングルトンインスタンス
export const localSessionStore = new LocalSessionStore();

// 定期的なクリーンアップ（5分ごと）
if (typeof window !== 'undefined') {
  // Load from IndexedDB on startup
  localSessionStore.loadFromIndexedDB();

  setInterval(() => {
    localSessionStore.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * ローカルファーストセッション管理
 * サーバー同期前のセッションをメモリで管理
 */

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
    }
  }

  /**
   * セッションを削除
   */
  delete(id: string): void {
    this.sessions.delete(id);
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
  setInterval(() => {
    localSessionStore.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * 完全ローカルファーストセッション管理
 * IndexedDBを単一の真実の源（Single Source of Truth）として使用
 * リアクティブな更新通知をサポート
 */

import { indexedDB, type StoredMessage } from './indexed-db';
import { encrypt, decrypt, isEncrypted, type EncryptedData } from './client-encryption';

export interface OptimisticMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string | EncryptedData; // E2EE対応: 暗号化データまたは平文
  timestamp: Date;
  responderId?: string;
  synced?: boolean; // サーバーに同期済みか
  isE2EE?: boolean; // E2EE暗号化されているか（AIメッセージは除外）
}

export interface OptimisticSession {
  id: string; // ローカル一時ID（"local-xxx"形式）またはサーバーID
  serverId?: string; // サーバーから返されたID
  consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
  messages: OptimisticMessage[];
  isAnonymous: boolean;
  targetUserIds?: string[];
  syncing: boolean;
  synced: boolean;
  error?: string;
  createdAt: number;
  updatedAt?: number;
}

type SessionChangeListener = (sessionId: string, session: OptimisticSession | null) => void;

class LocalSessionStore {
  private sessions = new Map<string, OptimisticSession>();
  private listeners = new Set<SessionChangeListener>();
  private initialized = false;

  /**
   * IndexedDBから初期化（アプリ起動時に一度だけ呼ぶ）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const sessions = await indexedDB.getAllSessions();
      sessions.forEach((session) => {
        this.sessions.set(session.id, session);
      });
      console.log('[LocalSessionStore] Initialized with', sessions.length, 'sessions from IndexedDB');
      this.initialized = true;
    } catch (error) {
      console.error('[LocalSessionStore] Failed to initialize from IndexedDB:', error);
    }
  }

  /**
   * ローカルセッションを作成
   * E2EE対応: 非AI相談の場合は初期メッセージを暗号化
   */
  async create(params: {
    consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
    initialMessage: string;
    isAnonymous: boolean;
    targetUserIds?: string[];
  }): Promise<OptimisticSession> {
    const localId = `local-${crypto.randomUUID()}`;
    const now = Date.now();

    // 初期メッセージを作成
    const initialMessageObj: OptimisticMessage = {
      id: `local-msg-${crypto.randomUUID()}`,
      role: 'user',
      content: params.initialMessage,
      timestamp: new Date(),
      synced: false,
    };

    // PRIVATE相談（AI専用）以外はE2EE暗号化
    const isAIOnly = params.consultType === 'PRIVATE';
    const encryptedMessage = await this.encryptMessageIfNeeded(initialMessageObj, isAIOnly);

    const session: OptimisticSession = {
      id: localId,
      consultType: params.consultType,
      messages: [encryptedMessage],
      isAnonymous: params.isAnonymous,
      targetUserIds: params.targetUserIds,
      syncing: false,
      synced: false,
      createdAt: now,
      updatedAt: now,
    };

    // メモリに保存
    this.sessions.set(localId, session);

    // IndexedDBに永続化
    try {
      await indexedDB.saveSession(session);
      // メッセージも保存
      await indexedDB.saveMessage({
        ...encryptedMessage,
        sessionId: localId,
        synced: false,
      });
    } catch (error) {
      console.error('[LocalSessionStore] Failed to save session:', error);
    }

    // リスナーに通知
    this.notifyListeners(localId, session);

    return session;
  }

  /**
   * セッションを取得（メモリから）
   */
  get(id: string): OptimisticSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * セッションのメッセージを復号して取得（表示用）
   */
  async getDecryptedMessages(sessionId: string): Promise<OptimisticMessage[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    // すべてのメッセージを復号
    const decryptedMessages = await Promise.all(
      session.messages.map((msg) => this.decryptMessageIfNeeded(msg))
    );

    return decryptedMessages;
  }

  /**
   * セッションを取得（IndexedDBから、メモリになければロード）
   */
  async getOrLoad(id: string): Promise<OptimisticSession | null> {
    // メモリにあればそれを返す
    const cached = this.sessions.get(id);
    if (cached) return cached;

    // IndexedDBから読み込み
    try {
      const session = await indexedDB.getSession(id);
      if (session) {
        this.sessions.set(id, session);
        return session;
      }
    } catch (error) {
      console.error('[LocalSessionStore] Failed to load session:', error);
    }

    return null;
  }

  /**
   * すべてのセッションを取得（ローカル + サーバー統合）
   */
  async getAllSessions(): Promise<OptimisticSession[]> {
    // IndexedDBから最新を取得
    try {
      const sessions = await indexedDB.getAllSessions();

      // メモリキャッシュを更新
      sessions.forEach((session) => {
        this.sessions.set(session.id, session);
      });

      // 更新日時でソート（新しい順）
      return sessions.sort((a, b) => {
        const aTime = a.updatedAt || a.createdAt;
        const bTime = b.updatedAt || b.createdAt;
        return bTime - aTime;
      });
    } catch (error) {
      console.error('[LocalSessionStore] Failed to get all sessions:', error);
      return [];
    }
  }

  /**
   * メッセージ内容を暗号化（E2EE対応）
   * AIメッセージは除外（OpenAI APIに送信するため）
   */
  private async encryptMessageIfNeeded(message: OptimisticMessage, isAIMessage: boolean): Promise<OptimisticMessage> {
    // AIメッセージは暗号化しない
    if (isAIMessage || message.role === 'assistant') {
      return message;
    }

    // 既に暗号化されている場合はスキップ
    if (isEncrypted(message.content)) {
      return message;
    }

    // E2EE暗号化
    try {
      const encryptedContent = await encrypt(message.content as string);
      return {
        ...message,
        content: encryptedContent,
        isE2EE: true,
      };
    } catch (error) {
      console.error('[LocalSessionStore] Encryption failed, storing as plaintext:', error);
      return message;
    }
  }

  /**
   * メッセージ内容を復号（E2EE対応）
   */
  private async decryptMessageIfNeeded(message: OptimisticMessage): Promise<OptimisticMessage> {
    // E2EEフラグがなければそのまま返す
    if (!message.isE2EE) {
      return message;
    }

    // 暗号化データでなければそのまま返す
    if (!isEncrypted(message.content)) {
      return message;
    }

    // 復号
    try {
      const decryptedContent = await decrypt(message.content);
      return {
        ...message,
        content: decryptedContent,
      };
    } catch (error) {
      console.error('[LocalSessionStore] Decryption failed:', error);
      return {
        ...message,
        content: '[復号エラー]',
      };
    }
  }

  /**
   * メッセージを追加（楽観的UI）
   * E2EE対応: 人間メッセージは暗号化して保存
   */
  async addMessage(sessionId: string, message: OptimisticMessage, isAIMessage = false): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error('[LocalSessionStore] Session not found:', sessionId);
      return;
    }

    // E2EE暗号化（必要な場合）
    const encryptedMessage = await this.encryptMessageIfNeeded(message, isAIMessage);

    // メッセージを追加
    session.messages.push(encryptedMessage);
    session.updatedAt = Date.now();

    // メモリを更新
    this.sessions.set(sessionId, session);

    // IndexedDBに永続化
    try {
      await Promise.all([
        indexedDB.saveSession(session),
        indexedDB.saveMessage({
          ...encryptedMessage,
          sessionId,
          synced: message.synced || false,
        }),
      ]);
    } catch (error) {
      console.error('[LocalSessionStore] Failed to save message:', error);
    }

    // リスナーに通知
    this.notifyListeners(sessionId, session);
  }

  /**
   * メッセージを更新（サーバーIDに置き換えなど）
   */
  async updateMessage(sessionId: string, messageId: string, updates: Partial<OptimisticMessage>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const messageIndex = session.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // メッセージを更新
    session.messages[messageIndex] = {
      ...session.messages[messageIndex],
      ...updates,
    };
    session.updatedAt = Date.now();

    // メモリを更新
    this.sessions.set(sessionId, session);

    // IndexedDBに永続化
    try {
      await Promise.all([
        indexedDB.saveSession(session),
        indexedDB.saveMessage({
          ...session.messages[messageIndex],
          sessionId,
          synced: session.messages[messageIndex].synced || false,
        }),
      ]);
    } catch (error) {
      console.error('[LocalSessionStore] Failed to update message:', error);
    }

    // リスナーに通知
    this.notifyListeners(sessionId, session);
  }

  /**
   * サーバーIDで更新（同期完了時）
   */
  async updateWithServerId(localId: string, serverId: string): Promise<void> {
    const session = this.sessions.get(localId);
    if (!session) return;

    session.serverId = serverId;
    session.synced = true;
    session.syncing = false;
    session.updatedAt = Date.now();

    // メモリを更新
    this.sessions.set(localId, session);

    // IndexedDBに永続化
    try {
      await indexedDB.saveSession(session);
    } catch (error) {
      console.error('[LocalSessionStore] Failed to update session:', error);
    }

    // リスナーに通知
    this.notifyListeners(localId, session);
  }

  /**
   * 同期状態を更新
   */
  async setSyncing(localId: string, syncing: boolean): Promise<void> {
    const session = this.sessions.get(localId);
    if (!session) return;

    session.syncing = syncing;
    session.updatedAt = Date.now();

    // メモリを更新
    this.sessions.set(localId, session);

    // IndexedDBに永続化
    try {
      await indexedDB.saveSession(session);
    } catch (error) {
      console.error('[LocalSessionStore] Failed to update syncing state:', error);
    }

    // リスナーに通知
    this.notifyListeners(localId, session);
  }

  /**
   * エラー状態を設定
   */
  async setError(localId: string, error: string): Promise<void> {
    const session = this.sessions.get(localId);
    if (!session) return;

    session.error = error;
    session.syncing = false;
    session.updatedAt = Date.now();

    // メモリを更新
    this.sessions.set(localId, session);

    // IndexedDBに永続化
    try {
      await indexedDB.saveSession(session);
    } catch (error) {
      console.error('[LocalSessionStore] Failed to save error:', error);
    }

    // リスナーに通知
    this.notifyListeners(localId, session);
  }

  /**
   * セッションを削除
   */
  async delete(id: string): Promise<void> {
    // メモリから削除
    this.sessions.delete(id);

    // IndexedDBから削除
    try {
      await indexedDB.deleteSession(id);
    } catch (error) {
      console.error('[LocalSessionStore] Failed to delete session:', error);
    }

    // リスナーに通知（null = 削除）
    this.notifyListeners(id, null);
  }

  /**
   * 変更リスナーを追加（Reactコンポーネントから使用）
   */
  onChange(listener: SessionChangeListener): () => void {
    this.listeners.add(listener);
    // アンサブスクライブ関数を返す
    return () => this.listeners.delete(listener);
  }

  /**
   * リスナーに変更を通知
   */
  private notifyListeners(sessionId: string, session: OptimisticSession | null): void {
    this.listeners.forEach((listener) => {
      try {
        listener(sessionId, session);
      } catch (error) {
        console.error('[LocalSessionStore] Listener error:', error);
      }
    });
  }

  /**
   * 古いセッションをクリーンアップ（同期済みで1時間以上前）
   */
  async cleanup(): Promise<void> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const toDelete: string[] = [];

    for (const [id, session] of this.sessions.entries()) {
      if (session.createdAt < oneHourAgo && session.synced) {
        toDelete.push(id);
      }
    }

    // 削除実行
    await Promise.all(toDelete.map((id) => this.delete(id)));

    if (toDelete.length > 0) {
      console.log('[LocalSessionStore] Cleaned up', toDelete.length, 'old sessions');
    }
  }
}

// シングルトンインスタンス
export const localSessionStore = new LocalSessionStore();

// ブラウザ環境でのみ初期化
if (typeof window !== 'undefined') {
  // アプリ起動時に初期化
  localSessionStore.initialize().catch(console.error);

  // 定期的なクリーンアップ（5分ごと）
  setInterval(() => {
    localSessionStore.cleanup().catch(console.error);
  }, 5 * 60 * 1000);
}

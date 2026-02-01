/**
 * オフラインメッセージキュー管理
 * 送信失敗したメッセージをキューに保存し、オンライン復帰時に再送
 */

import { indexedDB } from './indexed-db';
import type { OptimisticMessage } from './local-session-store';

export interface QueuedMessage extends OptimisticMessage {
  sessionId: string;
  retries: number;
  error?: string;
  isAnonymous?: boolean;
  queuedAt: number;
}

class MessageQueueManager {
  private processing = false;
  private listeners: Array<() => void> = [];

  /**
   * メッセージをキューに追加
   */
  async enqueue(message: Omit<QueuedMessage, 'queuedAt' | 'retries'>): Promise<void> {
    const queuedMessage: QueuedMessage = {
      ...message,
      queuedAt: Date.now(),
      retries: 0,
    };

    await indexedDB.addToSyncQueue({
      type: 'message',
      data: queuedMessage,
      timestamp: Date.now(),
      retries: 0,
    });

    this.notifyListeners();
  }

  /**
   * キューからメッセージを取得
   */
  async getQueue(): Promise<QueuedMessage[]> {
    const queue = await indexedDB.getSyncQueue();
    return queue
      .filter((item) => item.type === 'message')
      .map((item) => item.data as QueuedMessage)
      .sort((a, b) => a.queuedAt - b.queuedAt);
  }

  /**
   * キューを処理（オンライン復帰時）
   */
  async processQueue(): Promise<void> {
    if (this.processing) return;
    if (!navigator.onLine) return;

    this.processing = true;

    try {
      const queue = await this.getQueue();

      for (const queuedMsg of queue) {
        try {
          await this.sendMessage(queuedMsg);

          // 成功したらキューから削除
          const queueItems = await indexedDB.getSyncQueue();
          const item = queueItems.find(
            (i) => i.type === 'message' && (i.data as QueuedMessage).id === queuedMsg.id
          );
          if (item) {
            await indexedDB.removeFromSyncQueue(item.id);
          }
        } catch (error) {
          console.error('[MessageQueue] Failed to send message:', error);

          // リトライ回数を増やす
          const queueItems = await indexedDB.getSyncQueue();
          const item = queueItems.find(
            (i) => i.type === 'message' && (i.data as QueuedMessage).id === queuedMsg.id
          );

          if (item) {
            queuedMsg.retries += 1;
            queuedMsg.error = error instanceof Error ? error.message : 'Unknown error';

            // 5回以上失敗したらキューから削除（諦める）
            if (queuedMsg.retries >= 5) {
              await indexedDB.removeFromSyncQueue(item.id);
              console.error('[MessageQueue] Message failed after 5 retries, removing from queue');
            }
          }
        }
      }
    } finally {
      this.processing = false;
      this.notifyListeners();
    }
  }

  /**
   * メッセージを送信
   */
  private async sendMessage(message: QueuedMessage): Promise<void> {
    const response = await fetch(`/api/chat/sessions/${message.sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.content,
        isAnonymous: message.isAnonymous,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to send message');
    }
  }

  /**
   * キュー変更を監視
   */
  onChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * オンライン/オフライン監視を開始
   */
  startListening(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('[MessageQueue] Online - processing queue');
      this.processQueue();
    });

    // アプリ起動時にキューを処理
    if (navigator.onLine) {
      this.processQueue();
    }
  }
}

// シングルトンインスタンス
export const messageQueue = new MessageQueueManager();

// 自動的に監視を開始
if (typeof window !== 'undefined') {
  messageQueue.startListening();
}

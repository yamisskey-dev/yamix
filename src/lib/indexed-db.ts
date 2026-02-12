/**
 * IndexedDB wrapper for offline-first chat storage
 * Stores sessions and messages locally for offline access
 */

import type { OptimisticSession, OptimisticMessage } from './local-session-store';

const DB_NAME = 'YamiDB';
const DB_VERSION = 1;

// Object store names
const STORES = {
  SESSIONS: 'sessions',
  MESSAGES: 'messages',
  SYNC_QUEUE: 'syncQueue',
} as const;

export interface StoredMessage extends OptimisticMessage {
  sessionId: string;
  synced: boolean;
}

export interface SyncQueueItem {
  id: string;
  type: 'session' | 'message';
  data: unknown;
  timestamp: number;
  retries: number;
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize database
   */
  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Sessions store
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
          sessionStore.createIndex('updatedAt', 'createdAt', { unique: false });
          sessionStore.createIndex('consultType', 'consultType', { unique: false });
        }

        // Messages store
        if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
          const messageStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
          messageStore.createIndex('sessionId', 'sessionId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Sync queue store (for offline operations)
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Save session to IndexedDB
   */
  async saveSession(session: OptimisticSession): Promise<void> {
    const db = await this.init();
    const tx = db.transaction(STORES.SESSIONS, 'readwrite');
    const store = tx.objectStore(STORES.SESSIONS);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get session from IndexedDB
   */
  async getSession(sessionId: string): Promise<OptimisticSession | null> {
    const db = await this.init();
    const tx = db.transaction(STORES.SESSIONS, 'readonly');
    const store = tx.objectStore(STORES.SESSIONS);

    return new Promise((resolve, reject) => {
      const request = store.get(sessionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all sessions (for session list)
   */
  async getAllSessions(limit = 50): Promise<OptimisticSession[]> {
    const db = await this.init();
    const tx = db.transaction(STORES.SESSIONS, 'readonly');
    const store = tx.objectStore(STORES.SESSIONS);
    const index = store.index('updatedAt');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, 'prev'); // Newest first
      const sessions: OptimisticSession[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && sessions.length < limit) {
          sessions.push(cursor.value);
          cursor.continue();
        } else {
          resolve(sessions);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save message to IndexedDB
   */
  async saveMessage(message: StoredMessage): Promise<void> {
    const db = await this.init();
    const tx = db.transaction(STORES.MESSAGES, 'readwrite');
    const store = tx.objectStore(STORES.MESSAGES);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(message);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all messages for a session
   */
  async getMessages(sessionId: string): Promise<StoredMessage[]> {
    const db = await this.init();
    const tx = db.transaction(STORES.MESSAGES, 'readonly');
    const store = tx.objectStore(STORES.MESSAGES);
    const index = store.index('sessionId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(sessionId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add item to sync queue (for offline operations)
   */
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
    const db = await this.init();
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);

    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      ...item,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.add(queueItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all pending sync queue items
   */
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await this.init();
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = tx.objectStore(STORES.SYNC_QUEUE);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove item from sync queue
   */
  async removeFromSyncQueue(id: string): Promise<void> {
    const db = await this.init();
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all data (for privacy/logout)
   */
  async clearAll(): Promise<void> {
    const db = await this.init();
    const tx = db.transaction([STORES.SESSIONS, STORES.MESSAGES, STORES.SYNC_QUEUE], 'readwrite');

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = tx.objectStore(STORES.SESSIONS).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = tx.objectStore(STORES.MESSAGES).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = tx.objectStore(STORES.SYNC_QUEUE).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ]);
  }

  /**
   * Delete session and its messages
   */
  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.init();

    // Delete session
    const sessionTx = db.transaction(STORES.SESSIONS, 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const request = sessionTx.objectStore(STORES.SESSIONS).delete(sessionId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Delete all messages for this session
    const messages = await this.getMessages(sessionId);
    if (messages.length > 0) {
      const msgTx = db.transaction(STORES.MESSAGES, 'readwrite');
      const store = msgTx.objectStore(STORES.MESSAGES);

      await Promise.all(
        messages.map((msg) =>
          new Promise<void>((resolve, reject) => {
            const request = store.delete(msg.id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          })
        )
      );
    }
  }
}

// Singleton instance
export const indexedDB = new IndexedDBManager();

// Initialize on import (only in browser)
if (typeof window !== 'undefined') {
  indexedDB.init().catch(console.error);
}

"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * localStorage用のキー定義
 * 型安全性を確保するための定数
 */
export const STORAGE_KEYS = {
  HANDLE: "yamix_handle",
  DISPLAY_NAME: "yamix_displayName",
  AVATAR_URL: "yamix_avatarUrl",
  SERVER: "yamix_server",
  THEME_PREFERENCE: "yamix_theme_preference",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * useLocalStorage - 型安全なlocalStorage管理
 *
 * @param key - localStorage key
 * @param initialValue - 初期値
 * @returns [value, setValue, removeValue]
 */
export function useLocalStorage<T>(
  key: StorageKey,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // SSR対応: 初期値は常にinitialValue
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isInitialized, setIsInitialized] = useState(false);

  // マウント時にlocalStorageから読み込み
  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item) as T);
      }
    } catch (error) {
      console.warn(`Failed to read localStorage key "${key}":`, error);
    }
    setIsInitialized(true);
  }, [key]);

  // 値の設定
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.warn(`Failed to set localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // 値の削除
  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Failed to remove localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

/**
 * ユーザーキャッシュデータの型
 */
export interface UserCache {
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  server: string | null;
}

/**
 * useUserCache - ユーザー情報のlocalStorageキャッシュ管理
 * 複数のlocalStorageキーを一括管理
 */
export function useUserCache() {
  const [handle, setHandle, removeHandle] = useLocalStorage<string | null>(
    STORAGE_KEYS.HANDLE,
    null
  );
  const [displayName, setDisplayName, removeDisplayName] = useLocalStorage<
    string | null
  >(STORAGE_KEYS.DISPLAY_NAME, null);
  const [avatarUrl, setAvatarUrl, removeAvatarUrl] = useLocalStorage<
    string | null
  >(STORAGE_KEYS.AVATAR_URL, null);
  const [server, setServer, removeServer] = useLocalStorage<string | null>(
    STORAGE_KEYS.SERVER,
    null
  );

  const cache: UserCache = {
    handle,
    displayName,
    avatarUrl,
    server,
  };

  /**
   * ユーザーキャッシュを一括設定
   */
  const setCache = useCallback(
    (data: Partial<UserCache>) => {
      if (data.handle !== undefined) setHandle(data.handle);
      if (data.displayName !== undefined) setDisplayName(data.displayName);
      if (data.avatarUrl !== undefined) setAvatarUrl(data.avatarUrl);
      if (data.server !== undefined) setServer(data.server);
    },
    [setHandle, setDisplayName, setAvatarUrl, setServer]
  );

  /**
   * ユーザーキャッシュを全クリア（ログアウト時）
   */
  const clearCache = useCallback(() => {
    removeHandle();
    removeDisplayName();
    removeAvatarUrl();
    removeServer();
  }, [removeHandle, removeDisplayName, removeAvatarUrl, removeServer]);

  return {
    cache,
    setCache,
    clearCache,
    // 個別アクセス用
    handle,
    setHandle,
    displayName,
    setDisplayName,
    avatarUrl,
    setAvatarUrl,
    server,
    setServer,
  };
}

/**
 * 直接localStorage操作用のヘルパー（非React環境用）
 */
export const storageHelper = {
  get<T>(key: StorageKey): T | null {
    if (typeof window === "undefined") return null;
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    } catch {
      return null;
    }
  },

  set<T>(key: StorageKey, value: T): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  },

  remove(key: StorageKey): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },

  /**
   * ユーザーキャッシュを全クリア
   */
  clearUserCache(): void {
    this.remove(STORAGE_KEYS.HANDLE);
    this.remove(STORAGE_KEYS.DISPLAY_NAME);
    this.remove(STORAGE_KEYS.AVATAR_URL);
    this.remove(STORAGE_KEYS.SERVER);
  },
};

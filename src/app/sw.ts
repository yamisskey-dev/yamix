/// <reference lib="webworker" />
/**
 * Service Worker (Serwist)
 *
 * next-pwa 5.6 から移行。runtimeCaching は旧 next.config.ts の設定を踏襲:
 * - アプリページ: Cache-first（オフライン即時表示）
 * - API: Network-first（5秒でキャッシュにフォールバック）
 * - メッセージ送信: Background Sync キュー
 * - 外部フォント: Cache-first
 */

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  BackgroundSyncPlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    // App pages: Cache-first for instant offline access
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin && (url.pathname.startsWith("/main/") || request.mode === "navigate"),
      handler: new CacheFirst({
        cacheName: "app-pages",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          }),
        ],
      }),
    },
    // API requests: Network-first with cache fallback
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin &&
        url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/api/auth/"),
      handler: new NetworkFirst({
        cacheName: "api-cache",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 5 * 60, // 5 minutes
          }),
        ],
      }),
    },
    // Message sending: Background sync for offline queue
    {
      matcher: /^https:\/\/.*\/api\/chat\/sessions\/.*\/messages$/,
      method: "POST",
      handler: new NetworkOnly({
        plugins: [
          new BackgroundSyncPlugin("message-queue", {
            maxRetentionTime: 24 * 60, // Retry for max of 24 hours (in minutes)
          }),
        ],
      }),
    },
    // External fonts: Cache-first
    {
      matcher: /^https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com)\/.*/i,
      handler: new CacheFirst({
        cacheName: "external-resources",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();

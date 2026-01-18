/**
 * Service Worker for Yamix PWA
 * - オフラインキャッシュ
 * - バックグラウンド同期（将来用）
 */

const CACHE_NAME = "yamix-v1";
const STATIC_ASSETS = [
  "/",
  "/main",
  "/manifest.json",
  "/static/loading/1.gif",
  "/static/loading/2.gif",
  "/static/loading/3.gif",
];

// インストール時に静的アセットをキャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // すぐにアクティベート
  self.skipWaiting();
});

// アクティベート時に古いキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // クライアントを即座に制御
  self.clients.claim();
});

// フェッチイベント - ネットワーク優先、フォールバックでキャッシュ
self.addEventListener("fetch", (event) => {
  // APIリクエストはキャッシュしない
  if (event.request.url.includes("/api/")) {
    return;
  }

  // ナビゲーションリクエスト
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match("/main") || caches.match("/");
      })
    );
    return;
  }

  // その他のリクエスト - stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // 成功したらキャッシュを更新
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // ネットワークエラー時はキャッシュを返す
            return cachedResponse;
          });

        // キャッシュがあればすぐ返す、なければネットワークを待つ
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// プッシュ通知（将来用）
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/main",
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "やみっくす", options)
  );
});

// 通知クリック時
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || "/main")
  );
});

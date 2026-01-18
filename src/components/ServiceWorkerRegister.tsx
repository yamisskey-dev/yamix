"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Service Workerを登録するコンポーネント
 * ルートレイアウトに配置して使用
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          logger.info("Service Worker registered", {
            scope: registration.scope,
          });

          // 更新をチェック
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // 新しいバージョンが利用可能
                  logger.info("New version available");
                }
              });
            }
          });
        })
        .catch((error) => {
          logger.error("Service Worker registration failed", {}, error);
        });
    }
  }, []);

  return null;
}

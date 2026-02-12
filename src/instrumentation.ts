/**
 * Next.js Instrumentation
 * アプリ起動時に一度だけ実行される
 */

export async function register() {
  // サーバーサイドのみで実行
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // CI環境ではスキップ（DATABASE_URLがない）
    if (process.env.CI) {
      return;
    }

    const { migrateUnencryptedMessages } = await import("@/lib/auto-migrate");
    await migrateUnencryptedMessages();
  }
}

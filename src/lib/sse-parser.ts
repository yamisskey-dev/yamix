/**
 * SSE (Server-Sent Events) の JSON ペイロードパーサ
 *
 * サーバー（yamii ストリームのプロキシ）とクライアント（チャット画面）の
 * 両方から使う。`data: {...}` 行だけを取り出して JSON として yield する。
 * コメント行・event 行・JSON でない行（[DONE] 等）・壊れた行はスキップ。
 */

export async function* parseSSEJsonStream<T>(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function parseLine(line: string): T | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) return null;
    const dataStr = trimmed.slice(6).trim();
    if (!dataStr.startsWith("{")) return null;
    try {
      return JSON.parse(dataStr) as T;
    } catch {
      return null; // 壊れた行はスキップ
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const event = parseLine(line);
        if (event !== null) yield event;
      }
    }

    // 改行で終わらないストリームの最終行も取りこぼさない
    if (buffer) {
      const event = parseLine(buffer);
      if (event !== null) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

"use client";

/**
 * SSEイベントの型定義
 */
export interface SSEInitEvent {
  type: "init";
  userMessageId?: string;
  sessionTitle?: string;
}

export interface SSEChunkEvent {
  type: "chunk";
  chunk: string;
}

export interface SSEDoneEvent {
  type: "done";
  assistantMessageId?: string;
  isCrisis?: boolean;
  sessionPrivatized?: boolean;
}

export interface SSEErrorEvent {
  type: "error";
  error: string;
}

export type SSEEvent = SSEInitEvent | SSEChunkEvent | SSEDoneEvent | SSEErrorEvent;

/**
 * SSEストリームレスポンスをパースする
 */
export async function processSSEStream(
  response: Response,
  callbacks: {
    onInit?: (event: SSEInitEvent) => void;
    onChunk?: (chunk: string) => void;
    onDone?: (event: SSEDoneEvent) => void;
    onError?: (error: string) => void;
  }
): Promise<void> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const dataStr = trimmed.slice(6).trim();
        if (!dataStr || !dataStr.startsWith("{")) continue;

        try {
          const event: SSEEvent = JSON.parse(dataStr);

          switch (event.type) {
            case "init":
              callbacks.onInit?.(event);
              break;
            case "chunk":
              callbacks.onChunk?.(event.chunk);
              break;
            case "done":
              callbacks.onDone?.(event);
              break;
            case "error":
              callbacks.onError?.(event.error);
              break;
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && dataStr.includes('"type":"error"')) {
            throw parseErr;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

"use client";

import { parseSSEJsonStream } from "@/lib/sse-parser";

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

  for await (const event of parseSSEJsonStream<SSEEvent>(response.body)) {
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
  }
}

import type { Dispatch, SetStateAction } from "react";
import { processSSEStream } from "@/hooks/useSSEStream";
import { checkCrisisAlert, type LocalMessage, type SessionInfo } from "./chat-types";

/**
 * SSEストリーミングレスポンスの処理
 * 初回メッセージ送信とチャット送信で共通化
 */
export async function handleSSEResponse(
  res: Response,
  userMessageId: string,
  callbacks: {
    setMessages: Dispatch<SetStateAction<LocalMessage[]>>;
    setIsLoading: Dispatch<SetStateAction<boolean>>;
    setSessionInfo: Dispatch<SetStateAction<SessionInfo | null>>;
    setShowCrisisAlert: Dispatch<SetStateAction<boolean>>;
    showToast: (message: string, type?: "success" | "error" | "warning" | "info") => void;
    /** 最初のチャンク受信時（ストリーミング表示が始まったらタイピングインジケーターを消す等） */
    onStreamStart?: () => void;
    onStreamComplete?: () => void;
  }
): Promise<void> {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream") && res.body) {
    const streamingMsgId = crypto.randomUUID();
    let streamStarted = false;
    let contentBuffer = "";
    let rafId: number | null = null;

    // Batch chunk updates using requestAnimationFrame
    const flushContentBuffer = () => {
      if (contentBuffer.length > 0) {
        const bufferedContent = contentBuffer;
        contentBuffer = "";
        callbacks.setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMsgId
              ? { ...m, content: m.content + bufferedContent }
              : m
          )
        );
      }
      rafId = null;
    };

    const scheduleUpdate = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(flushContentBuffer);
      }
    };

    try {
      await processSSEStream(res, {
        onInit(event) {
          if (event.userMessageId) {
            callbacks.setMessages((prev) =>
              prev.map((m) =>
                m.id === userMessageId ? { ...m, id: event.userMessageId! } : m
              )
            );
          }
          if (event.sessionTitle) {
            callbacks.setSessionInfo((prev) => prev ? { ...prev, title: event.sessionTitle! } : null);
            window.dispatchEvent(new CustomEvent("newChatSessionCreated"));
          }
        },
        onChunk(chunk) {
          if (!streamStarted) {
            streamStarted = true;
            callbacks.onStreamStart?.();
            // Note: Don't set isLoading=false here, it will be set in finally block
            // Setting it here causes race condition with SWR update useEffect
            callbacks.setMessages((prev) => [...prev, {
              id: streamingMsgId,
              role: "assistant",
              content: chunk,
              timestamp: new Date(),
            }]);
          } else {
            // Buffer the chunk and schedule an update
            contentBuffer += chunk;
            scheduleUpdate();
          }
        },
        onDone(event) {
          // Cancel any pending RAF and flush remaining buffer
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          flushContentBuffer();

          const realMsgId = event.assistantMessageId || streamingMsgId;
          callbacks.setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingMsgId ? { ...m, id: realMsgId } : m
            )
          );
          if (event.sessionPrivatized) {
            callbacks.setSessionInfo((prev) => prev ? { ...prev, consultType: "PRIVATE" } : null);
            callbacks.showToast("この相談は安全のため非公開に変更されました", "warning");
          }
          if (checkCrisisAlert(event.isCrisis)) {
            callbacks.setShowCrisisAlert(true);
          }
        },
        onError(error) {
          // Clean up RAF on error
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          throw new Error(error);
        },
      });
    } finally {
      // Clean up RAF in finally block
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        flushContentBuffer();
      }
      // Mark streaming as just completed to prevent SWR overwrite
      callbacks.onStreamComplete?.();
      callbacks.setIsLoading(false);
    }
  } else {
    // Non-streaming JSON response
    const data = await res.json();

    if (data.sessionPrivatized) {
      callbacks.setSessionInfo((prev) => prev ? { ...prev, consultType: "PRIVATE" } : null);
      callbacks.showToast("この相談は安全のため非公開に変更されました", "warning");
    }
    if (checkCrisisAlert(data.isCrisis)) {
      callbacks.setShowCrisisAlert(true);
    }
    if (data.assistantMessage) {
      callbacks.setMessages((prev) => [...prev, {
        id: data.assistantMessage.id,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }]);
    }
    callbacks.setIsLoading(false);
  }
}

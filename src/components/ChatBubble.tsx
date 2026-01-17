"use client";

import Image from "next/image";

interface ResponderInfo {
  displayName: string | null;
  avatarUrl: string | null;
}

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  isLoading?: boolean;
  responder?: ResponderInfo; // 人間回答者の情報
}

export function ChatBubble({
  role,
  content,
  timestamp,
  isLoading,
  responder,
}: ChatBubbleProps) {
  const isUser = role === "user";
  const isHumanResponse = !isUser && responder;

  if (isLoading) {
    return (
      <div className={`chat ${isUser ? "chat-end" : "chat-start"}`}>
        <div className="chat-bubble chat-assistant-loading flex items-center gap-1.5 min-h-[2.5rem] px-4">
          <div className="typing-dot-gradient" />
          <div className="typing-dot-gradient" />
          <div className="typing-dot-gradient" />
        </div>
      </div>
    );
  }

  return (
    <div className={`chat ${isUser ? "chat-end" : "chat-start"} animate-slide-up`}>
      {/* Avatar for assistant */}
      {!isUser && (
        <div className="chat-image avatar">
          {isHumanResponse ? (
            // Human responder avatar
            <div className="w-8 h-8 rounded-full ring-2 ring-secondary/30">
              {responder.avatarUrl ? (
                <Image
                  src={responder.avatarUrl}
                  alt={responder.displayName || "回答者"}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white text-sm font-bold">
                  {(responder.displayName || "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            // AI avatar
            <div className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {/* Responder name for human responses */}
        {isHumanResponse && (
          <div className="text-xs text-secondary font-medium ml-1">
            {responder.displayName || "匿名の回答者"}
          </div>
        )}

        <div className={`chat-bubble ${isUser ? "chat-user" : "chat-assistant"} ${isHumanResponse ? "chat-human-response" : ""} shadow-sm`}>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p>
        </div>
      </div>

      {/* Timestamp */}
      {timestamp && (
        <div className="chat-footer opacity-40 mt-1">
          <time className="text-xs">
            {timestamp.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
      )}
    </div>
  );
}

interface CrisisAlertProps {
  onClose: () => void;
}

export function CrisisAlert({ onClose }: CrisisAlertProps) {
  return (
    <div className="alert alert-warning shadow-lg animate-fade-in">
      <div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <h3 className="font-bold">つらい気持ちを感じていませんか？</h3>
          <div className="text-sm">
            <p>相談できる窓口があります：</p>
            <ul className="list-disc list-inside mt-1">
              <li>いのちの電話: 0570-783-556</li>
              <li>よりそいホットライン: 0120-279-338</li>
            </ul>
          </div>
        </div>
      </div>
      <button className="btn btn-sm btn-ghost" onClick={onClose}>
        閉じる
      </button>
    </div>
  );
}

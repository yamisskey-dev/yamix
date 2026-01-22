"use client";

import { memo, useMemo } from "react";
import Image from "next/image";

interface ResponderInfo {
  displayName: string | null;
  avatarUrl: string | null;
  isAnonymous?: boolean; // 匿名かどうか
}

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  isLoading?: boolean;
  responder?: ResponderInfo; // 人間の情報（相談者または回答者）
}

export const ChatBubble = memo(function ChatBubble({
  role,
  content,
  timestamp,
  isLoading,
  responder,
}: ChatBubbleProps) {
  const isUser = role === "user";
  const isHuman = !!responder; // responderがいれば人間（相談者または回答者）
  const isAI = !isUser && !isHuman; // 右側でなく、人間でもない場合はAI

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
      {/* Avatar for assistant or human */}
      {!isUser && (
        <div className="chat-image avatar">
          {isHuman ? (
            // Human avatar (questioner or responder)
            <div className="w-8 h-8 rounded-full ring-2 ring-secondary/30">
              {responder!.isAnonymous ? (
                // Anonymous user
                <div className="w-full h-full rounded-full bg-base-300 flex items-center justify-center text-base-content/70">
                  <span className="text-lg">😎</span>
                </div>
              ) : responder!.avatarUrl ? (
                // User with avatar
                <Image
                  src={responder!.avatarUrl}
                  alt={responder!.displayName || "ユーザー"}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                // User without avatar - show initial
                <div className="w-full h-full rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white text-sm font-bold">
                  {(responder!.displayName || "?").charAt(0).toUpperCase()}
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

      {/* Name for human messages */}
      {isHuman && (
        <div className="chat-header text-xs text-secondary font-medium">
          {responder!.isAnonymous ? "匿名さん" : (responder!.displayName || "ユーザー")}
        </div>
      )}

      <div className={`chat-bubble ${isUser ? "chat-user" : "chat-assistant"} ${isHuman ? "chat-human-response" : ""} shadow-sm`}>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p>
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
});

interface CrisisAlertProps {
  onClose: () => void;
  onDisable: () => void;
}

export const CrisisAlert = memo(function CrisisAlert({ onClose, onDisable }: CrisisAlertProps) {
  return (
    <div className="chat chat-start animate-slide-up">
      <div className="chat-image avatar">
        <div className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center">
          <span className="text-lg">🫂</span>
        </div>
      </div>
      <div className="chat-bubble chat-assistant shadow-sm">
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          つらい気持ちを感じていませんか？ 24時間チャット相談:{" "}
          <a href="https://talkme.jp/" target="_blank" rel="noopener noreferrer" className="link link-primary">
            あなたのいばしょ
          </a>
        </p>
        <div className="flex justify-end gap-2 mt-2">
          <button className="btn btn-xs btn-ghost opacity-60" onClick={onDisable}>
            今後表示しない
          </button>
          <button className="btn btn-xs btn-ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
});

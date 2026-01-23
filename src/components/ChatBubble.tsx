"use client";

import { memo, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { parseMentions } from "@/lib/mention-parser";
import { encodeHandle } from "@/lib/encode-handle";

interface ResponderInfo {
  displayName: string | null;
  avatarUrl: string | null;
  isAnonymous?: boolean; // 匿名かどうか
  handle?: string; // ユーザーハンドル（プロフィールリンク用）
  responderId?: string; // ブロック用のID
}

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  isLoading?: boolean;
  responder?: ResponderInfo; // 人間の情報（相談者または回答者）
  isSessionOwner?: boolean; // セッション所有者かどうか
  onBlock?: (userId: string) => void; // ブロックコールバック
  messageId?: string; // メッセージID（灯を送るため）
  gasAmount?: number; // 受け取った灯の合計
  onSendGas?: (messageId: string) => void; // 灯を送るコールバック
}

export const ChatBubble = memo(function ChatBubble({
  role,
  content,
  timestamp,
  isLoading,
  responder,
  isSessionOwner,
  onBlock,
  messageId,
  gasAmount,
  onSendGas,
}: ChatBubbleProps) {
  const isUser = role === "user";
  const isHuman = !!responder; // responderがいれば人間（相談者または回答者）
  const isAI = !isUser && !isHuman; // 右側でなく、人間でもない場合はAI

  // Show block button if: session owner, this is a human response (not owner's message), and has responderId
  const canBlock = isSessionOwner && !isUser && isHuman && responder!.responderId && onBlock;

  // Show gas button if: this is a human response (not your own), has messageId and callback
  const canSendGas = !isUser && isHuman && messageId && onSendGas;

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
    <div className={`chat ${isUser ? "chat-end" : "chat-start"} animate-slide-up group`}>
      {/* Avatar for assistant or human */}
      {!isUser && (
        <div className="chat-image avatar">
          {isHuman ? (
            // Human avatar (questioner or responder) - clickable if not anonymous
            responder!.isAnonymous || !responder!.handle ? (
              <div className="w-8 h-8 rounded-full ring-2 ring-base-300/50">
                {responder!.isAnonymous ? (
                  // Anonymous user - show generic anonymous avatar
                  <div className="w-full h-full rounded-full bg-base-300 flex items-center justify-center text-base-content/50">
                    <span className="text-lg">😎</span>
                  </div>
                ) : responder!.avatarUrl ? (
                  // User with avatar (no handle)
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
              // Clickable user avatar
              <Link
                href={`/main/user/${encodeHandle(responder!.handle)}`}
                className="w-8 h-8 rounded-full ring-2 ring-secondary/30 block hover:ring-4 hover:ring-secondary/40 transition-all"
              >
                {responder!.avatarUrl ? (
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
              </Link>
            )
          ) : (
            // AI avatar - not clickable
            <div className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
          )}
        </div>
      )}

      {/* Anonymous user label (User A, B, C, etc.) - only label, no buttons */}
      {!isUser && isHuman && responder!.isAnonymous && responder!.displayName && (
        <div className="chat-header">
          <span className="text-xs opacity-50">{responder!.displayName}</span>
        </div>
      )}

      <div className={`chat-bubble ${isUser ? "chat-user" : "chat-assistant"} ${isHuman ? "chat-human-response" : ""} shadow-sm`}>
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {parseMentions(content, "text-base-content/90 hover:text-base-content hover:underline font-medium")}
        </p>
      </div>

      {/* Footer: Timestamp and action buttons (buttons visible on hover only) */}
      {(timestamp || canSendGas || canBlock) && (
        <div className="chat-footer flex items-center gap-2 mt-1">
          {/* Timestamp */}
          {timestamp && (
            <time className="text-xs opacity-40">
              {timestamp.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          )}

          {/* Action buttons - visible on message hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Gas button (only for non-owners) */}
            {canSendGas && (
              <button
                onClick={() => onSendGas!(messageId!)}
                className="btn btn-xs btn-ghost hover:text-amber-500 transition-colors"
                title="このユーザーを応援する"
              >
                🕯️
              </button>
            )}

            {/* Block button (only for session owner) */}
            {canBlock && (
              <button
                onClick={() => onBlock!(responder!.responderId!)}
                className="btn btn-xs btn-ghost hover:btn-error transition-colors"
                title="このユーザーをブロック"
              >
                🚫
              </button>
            )}
          </div>
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

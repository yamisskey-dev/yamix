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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                        clipRule="evenodd"
                      />
                    </svg>
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5 text-primary"
              >
                <path d="M12 2a2 2 0 012 2v1h2a2 2 0 012 2v2h1a2 2 0 110 4h-1v2a2 2 0 01-2 2h-2v1a2 2 0 11-4 0v-1H8a2 2 0 01-2-2v-2H5a2 2 0 110-4h1V7a2 2 0 012-2h2V4a2 2 0 012-2zm-2 7a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 100 2 1 1 0 000-2z" />
              </svg>
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
                aria-label="応援する"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              </button>
            )}

            {/* Block button (only for session owner) */}
            {canBlock && (
              <button
                onClick={() => onBlock!(responder!.responderId!)}
                className="btn btn-xs btn-ghost hover:btn-error transition-colors"
                title="このユーザーをブロック"
                aria-label="ブロック"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
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
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-warning/20 to-error/20 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5 text-warning"
          >
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
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

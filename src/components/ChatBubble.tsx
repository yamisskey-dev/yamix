"use client";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  isLoading?: boolean;
}

export function ChatBubble({
  role,
  content,
  timestamp,
  isLoading,
}: ChatBubbleProps) {
  const isUser = role === "user";

  if (isLoading) {
    return (
      <div className={`chat ${isUser ? "chat-end" : "chat-start"}`}>
        <div className="chat-bubble chat-assistant flex items-center gap-1 min-h-[2.5rem]">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    );
  }

  return (
    <div className={`chat ${isUser ? "chat-end" : "chat-start"} animate-slide-up`}>
      <div className={`chat-bubble ${isUser ? "chat-user" : "chat-assistant"}`}>
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>

      {/* Timestamp */}
      {timestamp && (
        <div className="chat-footer opacity-50">
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

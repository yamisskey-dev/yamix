"use client";

/** セッション読み込み中のスケルトン表示 */
export function ChatSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full p-4 space-y-4 animate-fade-in">
      <div className="chat chat-start">
        <div className="chat-image avatar">
          <div className="w-8 h-8 rounded-full bg-base-300 skeleton" />
        </div>
        <div className="chat-bubble bg-base-200/60 shadow-none">
          <div className="skeleton bg-base-300 h-4 w-48 mb-2 rounded" />
          <div className="skeleton bg-base-300 h-4 w-32 rounded" />
        </div>
      </div>
      <div className="chat chat-end">
        <div className="chat-bubble bg-primary/20 shadow-none">
          <div className="skeleton bg-primary/30 h-4 w-40 rounded" />
        </div>
      </div>
      <div className="chat chat-start">
        <div className="chat-image avatar">
          <div className="w-8 h-8 rounded-full bg-base-300 skeleton" />
        </div>
        <div className="chat-bubble bg-base-200/60 shadow-none">
          <div className="skeleton bg-base-300 h-4 w-56 mb-2 rounded" />
          <div className="skeleton bg-base-300 h-4 w-44 mb-2 rounded" />
          <div className="skeleton bg-base-300 h-4 w-36 rounded" />
        </div>
      </div>
    </div>
  );
}

"use client";

import { TimelineFeed } from "@/components/Timeline";

export default function TimelinePage() {
  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
            タイムライン
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            みんなの公開相談をチェック
          </p>
        </div>

        {/* Feed */}
        <TimelineFeed />
      </div>
    </div>
  );
}

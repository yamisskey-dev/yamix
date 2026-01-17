"use client";

import { TimelineFeed } from "@/components/Timeline";

export default function TimelinePage() {
  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-2xl mx-auto p-4">
        <TimelineFeed />
      </div>
    </div>
  );
}

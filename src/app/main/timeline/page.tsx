"use client";

import { TimelineFeed } from "@/components/Timeline";

export default function TimelinePage() {
  return (
    <div className="flex-1 overflow-y-auto h-full">
      {/* Timeline column - wider on desktop */}
      <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-3">
        <TimelineFeed />
      </div>
    </div>
  );
}

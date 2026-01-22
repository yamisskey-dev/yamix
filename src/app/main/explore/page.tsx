"use client";

import { ExploreFeed } from "@/components/Timeline/ExploreFeed";

export default function ExplorePage() {
  return (
    <div className="flex-1 overflow-y-auto h-full">
      {/* Explore column - wider on desktop */}
      <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-3">
        <ExploreFeed />
      </div>
    </div>
  );
}

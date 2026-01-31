"use client";

import { ExploreFeed } from "@/components/Timeline/ExploreFeed";

export default function ExplorePage() {
  return (
    <div className="h-[calc(100dvh-3.5rem)] xl:h-full overflow-hidden">
      <ExploreFeed />
    </div>
  );
}

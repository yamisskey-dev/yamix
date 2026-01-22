import Link from "next/link";
import React from "react";
import { encodeHandle } from "@/lib/encode-handle";

/**
 * Parse message text and convert mentions (@username) to clickable links
 * Supports both @username and @username@instance.com formats
 */
export function parseMentions(text: string, linkClassName?: string): React.ReactNode[] {
  // Match @username or @username@host.com
  const mentionRegex = /@([a-zA-Z0-9_]+(?:@[a-zA-Z0-9.-]+)?)/g;
  const defaultClassName = linkClassName || "text-primary hover:underline font-medium";

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const fullMention = match[0]; // @username or @username@host
    const mentionContent = match[1]; // username or username@host

    // Special case: @yamii is not a user link
    if (mentionContent.toLowerCase() === "yamii") {
      parts.push(
        <span key={match.index} className={linkClassName || "text-primary font-medium"}>
          {fullMention}
        </span>
      );
    } else {
      // Create clickable user link
      parts.push(
        <Link
          key={match.index}
          href={`/main/user/${encodeHandle(fullMention)}`}
          className={defaultClassName}
          onClick={(e) => e.stopPropagation()}
        >
          {fullMention}
        </Link>
      );
    }

    lastIndex = match.index + fullMention.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export const QUERY_LIMITS = {
  /** Recent messages included with session load */
  RECENT_MESSAGES: 10,
  /** Maximum messages loaded for full session view */
  MAX_MESSAGES_PER_SESSION: 200,
} as const;

export interface PrismaMessage {
  role: string;
  content: string;
}

/** @yamii mention regex */
const YAMII_MENTION_RE = /^@yamii(\s|$)/i;

export function hasMentionYamii(message: string): boolean {
  return YAMII_MENTION_RE.test(message.trim());
}

export function removeMentionYamii(message: string): string {
  return message.trim().replace(/^@yamii\s*/i, "");
}

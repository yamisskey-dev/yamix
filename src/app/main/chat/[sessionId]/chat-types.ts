import type { ChatMessage, ChatSessionWithMessages } from "@/types";

export interface ResponderInfo {
  displayName: string | null;
  avatarUrl: string | null;
  isAnonymous?: boolean;
  handle?: string;
  responderId?: string;
}

export interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  responder?: ResponderInfo | null;
  gasAmount?: number;
  isCrisis?: boolean;
}

export interface SessionInfo {
  consultType: "PRIVATE" | "PUBLIC" | "DIRECTED";
  userId: string;
  isOwner: boolean;
  isAnonymous: boolean;
  currentUserId: string | null;
  title: string | null;
  responseCount: number;
  crisisCount?: number;
  targets?: { userId: string; handle: string; displayName: string | null }[];
}

// SWR fetcher function
export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("NOT_FOUND");
    }
    throw new Error("Failed to fetch");
  }
  return res.json();
};

/**
 * サーバーメッセージをローカル表示用に変換
 * 注: E2EE復号は呼び出し元で事前に完了している前提
 */
export function transformMessage(
  m: ChatMessage,
  isOwner: boolean,
  currentUserId: string | null,
  sessionIsAnonymous: boolean,
  sessionUser: ChatSessionWithMessages["user"],
  anonymousUserMap: Map<string, string>
): LocalMessage {
  const isMyMessage = currentUserId && (
    (m.role === "USER" && isOwner) ||
    (m.role === "ASSISTANT" && m.responderId === currentUserId)
  );

  if (isMyMessage) {
    return {
      id: m.id,
      role: "user",
      content: m.content as string,
      timestamp: new Date(m.createdAt),
      gasAmount: m.gasAmount,
      isCrisis: m.isCrisis,
    };
  }

  if (!isOwner && m.role === "USER") {
    return {
      id: m.id,
      role: "assistant",
      content: m.content as string,
      timestamp: new Date(m.createdAt),
      gasAmount: m.gasAmount,
      isCrisis: m.isCrisis,
      responder: {
        displayName: sessionIsAnonymous ? null : (sessionUser?.displayName || null),
        avatarUrl: sessionIsAnonymous ? null : (sessionUser?.avatarUrl || null),
        isAnonymous: sessionIsAnonymous,
        handle: sessionIsAnonymous ? undefined : sessionUser?.handle,
      },
    };
  }

  return {
    id: m.id,
    role: "assistant",
    content: m.content as string,
    timestamp: new Date(m.createdAt),
    gasAmount: m.gasAmount,
    isCrisis: m.isCrisis,
    responder: m.responder ? {
      displayName: m.isAnonymous
        ? `User ${anonymousUserMap.get(m.responderId!)}`
        : m.responder.displayName,
      avatarUrl: m.isAnonymous ? null : m.responder.avatarUrl,
      isAnonymous: m.isAnonymous,
      handle: m.isAnonymous ? undefined : m.responder.handle,
      responderId: m.responderId || undefined,
    } : undefined,
  };
}

/**
 * 危機アラートのチェックと表示
 */
export function checkCrisisAlert(isCrisis: boolean | undefined): boolean {
  if (!isCrisis) return false;
  const disabled = localStorage.getItem("yamix_crisis_alert_disabled");
  return !disabled;
}

/**
 * Centralized API Client
 * 型安全なAPI呼び出しの一元管理
 */

import { ApiError, NetworkError, getHttpErrorMessage } from "./errors";
import { logger } from "./logger";
import type {
  UserProfile,
  ChatSession,
  ChatSessionsResponse,
  TimelineResponse,
  TimelineConsultation,
} from "@/types";

// ============================================
// Types
// ============================================

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
}

interface ApiResponse<T> {
  data: T;
  status: number;
}

// ============================================
// Core Functions
// ============================================

/**
 * URLにクエリパラメータを追加
 */
function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  const url = new URL(path, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * 基本のfetch wrapper
 */
async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { body, params, ...fetchOptions } = options;

  const url = buildUrl(path, params);
  const headers: HeadersInit = Object.assign(
    {},
    body ? { "Content-Type": "application/json" } : {},
    fetchOptions.headers ?? {}
  );

  logger.debug(`API Request: ${method} ${path}`, { params });

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...fetchOptions,
    });

    // レスポンスボディの取得
    let data: T;
    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = (await response.text()) as unknown as T;
    }

    // エラーレスポンスの処理
    if (!response.ok) {
      logger.apiError(method, path, response.status);
      throw ApiError.fromResponse(response, data);
    }

    return { data, status: response.status };
  } catch (error) {
    // ネットワークエラー
    if (error instanceof TypeError && error.message.includes("fetch")) {
      logger.error("Network error", { method, path }, error);
      throw new NetworkError();
    }

    // ApiErrorはそのまま再throw
    if (error instanceof ApiError) {
      throw error;
    }

    // その他のエラー
    logger.error("Request failed", { method, path }, error);
    throw error;
  }
}

// ============================================
// HTTP Methods
// ============================================

export const api = {
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    const { data } = await request<T>("GET", path, options);
    return data;
  },

  async post<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const { data } = await request<T>("POST", path, { ...options, body });
    return data;
  },

  async patch<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const { data } = await request<T>("PATCH", path, { ...options, body });
    return data;
  },

  async delete<T = void>(path: string, options?: RequestOptions): Promise<T> {
    const { data } = await request<T>("DELETE", path, options);
    return data;
  },
};

// ============================================
// Domain-Specific API Functions
// ============================================

/**
 * 認証API
 */
export const authApi = {
  async getMe(): Promise<UserProfile> {
    return api.get<UserProfile>("/api/auth/me");
  },

  async logout(): Promise<void> {
    return api.post("/api/auth/logout");
  },

  async misskeyLogin(server: string): Promise<{ url: string }> {
    return api.post("/api/auth/misskey-login", { server });
  },
};

/**
 * チャットセッションAPI
 */
export const chatApi = {
  async getSessions(
    cursor?: string | null,
    limit = 20
  ): Promise<ChatSessionsResponse> {
    return api.get<ChatSessionsResponse>("/api/chat/sessions", {
      params: { cursor, limit },
    });
  },

  async getSession(
    sessionId: string
  ): Promise<ChatSession & { messages: unknown[] }> {
    return api.get(`/api/chat/sessions/${sessionId}`);
  },

  async createSession(): Promise<ChatSession> {
    return api.post<ChatSession>("/api/chat/sessions");
  },

  async updateSession(
    sessionId: string,
    data: { title?: string }
  ): Promise<ChatSession> {
    return api.patch(`/api/chat/sessions/${sessionId}`, data);
  },

  async deleteSession(sessionId: string): Promise<void> {
    return api.delete(`/api/chat/sessions/${sessionId}`);
  },

  async sendMessage(
    sessionId: string,
    message: string
  ): Promise<{
    userMessage: { id: string };
    assistantMessage: { id: string };
    response: string;
    isCrisis: boolean;
  }> {
    return api.post(`/api/chat/sessions/${sessionId}/messages`, { message });
  },

  async sendHumanResponse(
    sessionId: string,
    content: string
  ): Promise<{
    message: {
      id: string;
      content: string;
      responderId: string;
    };
  }> {
    return api.post(`/api/chat/sessions/${sessionId}/respond`, { content });
  },
};

/**
 * タイムラインAPI
 */
export const timelineApi = {
  async getTimeline(
    cursor?: string | null,
    limit = 10
  ): Promise<TimelineResponse> {
    return api.get<TimelineResponse>("/api/timeline", {
      params: { cursor, limit },
    });
  },

  async getUserTimeline(
    handle: string,
    cursor?: string | null,
    limit = 10
  ): Promise<TimelineResponse> {
    return api.get<TimelineResponse>(`/api/timeline/user/${handle}`, {
      params: { cursor, limit },
    });
  },

  async getConsultation(id: string): Promise<TimelineConsultation> {
    return api.get(`/api/posts/${id}`);
  },
};

/**
 * フォローAPI
 */
export const followApi = {
  async follow(targetId: string): Promise<void> {
    return api.post("/api/follows", { targetId });
  },

  async unfollow(targetId: string): Promise<void> {
    return api.delete("/api/follows", { body: { targetId } } as RequestOptions);
  },

  async checkFollowing(targetId: string): Promise<{ following: boolean }> {
    return api.get("/api/follows", { params: { targetId } });
  },
};

// ============================================
// Re-exports
// ============================================

export { ApiError, NetworkError, getHttpErrorMessage };

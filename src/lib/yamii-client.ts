import type {
  CounselingRequest,
  CounselingResponse,
  ConversationMessage,
  HealthResponse,
} from "@/types/yamii-api.generated";

const YAMII_API_URL = process.env.YAMII_API_URL || "http://localhost:8000";
const YAMII_API_KEY = process.env.YAMII_API_KEY || "";

// 通常リクエストのタイムアウト（プロフィール取得等の軽い呼び出し）
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
// counseling は LLM 生成を含むため長め（yamii 側の OpenAI timeout は 60s）
const COUNSELING_TIMEOUT_MS = 90_000;
// ストリームは接続確立（ヘッダ受信）までのタイムアウト。ボディの受信は制限しない
const STREAM_CONNECT_TIMEOUT_MS = 15_000;
// リトライ間隔（指数バックオフ）
const DEFAULT_RETRY_DELAYS_MS = [500, 1000];

interface YamiiClientConfig {
  requestTimeoutMs?: number;
  streamConnectTimeoutMs?: number;
  retryDelaysMs?: number[];
}

export class YamiiClient {
  private baseUrl: string;
  private apiKey?: string;
  private requestTimeoutMs: number;
  private streamConnectTimeoutMs: number;
  private retryDelaysMs: number[];

  constructor(baseUrl?: string, apiKey?: string, config: YamiiClientConfig = {}) {
    this.baseUrl = baseUrl || YAMII_API_URL;
    this.apiKey = apiKey || YAMII_API_KEY || undefined;
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.streamConnectTimeoutMs = config.streamConnectTimeoutMs ?? STREAM_CONNECT_TIMEOUT_MS;
    this.retryDelaysMs = config.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    config: { timeoutMs?: number; retryable?: boolean } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const method = (options.method || "GET").toUpperCase();
    // GET は安全なのでデフォルトでリトライ。POST 等は非冪等の可能性があるため明示時のみ
    const retryable = config.retryable ?? method === "GET";
    const maxAttempts = retryable ? this.retryDelaysMs.length + 1 : 1;
    const timeoutMs = config.timeoutMs ?? this.requestTimeoutMs;

    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelaysMs[attempt - 1]));
      }

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        // ネットワークエラー・タイムアウトはリトライ対象
        lastError = error;
        continue;
      }

      if (!response.ok) {
        const error = await response.text();
        const apiError = new Error(`Yamii API Error: ${response.status} - ${error}`);
        // 5xx はリトライ対象、4xx は再試行しても無駄なので即座に失敗
        if (response.status >= 500) {
          lastError = apiError;
          continue;
        }
        throw apiError;
      }

      return response.json();
    }

    throw lastError;
  }

  async sendCounselingMessage(
    message: string,
    userId: string,
    options?: {
      userName?: string;
      sessionId?: string;
      conversationHistory?: ConversationMessage[];
    }
  ): Promise<CounselingResponse> {
    const body: CounselingRequest = {
      message,
      user_id: userId,
      user_name: options?.userName,
      session_id: options?.sessionId,
      conversation_history: options?.conversationHistory,
    };

    // LLM 生成を含み非冪等（ユーザー状態が更新される）ためリトライしない
    return this.request<CounselingResponse>(
      "/v1/counseling",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      { timeoutMs: COUNSELING_TIMEOUT_MS, retryable: false }
    );
  }

  async sendCounselingMessageStream(
    message: string,
    userId: string,
    options?: {
      userName?: string;
      sessionId?: string;
      conversationHistory?: ConversationMessage[];
      contextSummary?: string;
    }
  ): Promise<Response> {
    // context_summary は yamii 側で追加済みだが生成型が未更新のため交差型で補う
    const body: CounselingRequest & { context_summary?: string } = {
      message,
      user_id: userId,
      user_name: options?.userName,
      session_id: options?.sessionId,
      conversation_history: options?.conversationHistory,
      context_summary: options?.contextSummary,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    // 接続確立（ヘッダ受信）までのみタイムアウトを掛け、ボディの受信は制限しない
    const controller = new AbortController();
    const connectTimer = setTimeout(() => controller.abort(), this.streamConnectTimeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/counseling/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(connectTimer);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Yamii API Error: ${response.status} - ${error}`);
    }

    return response;
  }

  async generateTitle(message: string): Promise<string> {
    try {
      // 要約はステートレスなので POST でもリトライ可能
      const result = await this.request<{ title: string }>(
        "/v1/summarize-title",
        {
          method: "POST",
          body: JSON.stringify({ message }),
        },
        { retryable: true }
      );
      return result.title;
    } catch {
      // Fallback: truncate first sentence
      const firstSentence = message.match(/^[^。！？.!?\n]+[。！？.!?]?/);
      const title = firstSentence?.[0] || message;
      return title.slice(0, 50) + (title.length > 50 ? "..." : "");
    }
  }

  async summarizeContext(
    messages: ConversationMessage[],
    previousSummary?: string | null
  ): Promise<string> {
    // 要約はステートレスなので POST でもリトライ可能
    const result = await this.request<{ summary: string }>(
      "/v1/summarize-context",
      {
        method: "POST",
        body: JSON.stringify({
          previous_summary: previousSummary ?? undefined,
          messages,
        }),
      },
      { retryable: true }
    );
    return result.summary;
  }

  async healthCheck(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/v1/health");
  }

  async getUserProfile(userId: string): Promise<{
    user_id: string;
    phase: string;
    total_interactions: number;
    trust_score: number;
  }> {
    return this.request(`/v1/users/${encodeURIComponent(userId)}`);
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    return this.request(`/v1/users/${encodeURIComponent(userId)}/export`);
  }

  async deleteUserData(userId: string): Promise<{ message: string }> {
    return this.request(`/v1/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  }

  async updateUserProfile(
    userId: string,
    data: { explicit_profile?: string; display_name?: string }
  ): Promise<{ message: string; user_id: string }> {
    return this.request(`/v1/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
}

// Default client instance
export const yamiiClient = new YamiiClient();

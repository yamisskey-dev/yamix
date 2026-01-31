import type {
  CounselingRequest,
  CounselingResponse,
  ConversationMessage,
  HealthResponse,
} from "@/types/yamii-api.generated";

const YAMII_API_URL = process.env.YAMII_API_URL || "http://localhost:8000";
const YAMII_API_KEY = process.env.YAMII_API_KEY || "";

export class YamiiClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || YAMII_API_URL;
    this.apiKey = apiKey || YAMII_API_KEY || undefined;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Yamii API Error: ${response.status} - ${error}`);
    }

    return response.json();
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

    return this.request<CounselingResponse>("/v1/counseling", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async sendCounselingMessageStream(
    message: string,
    userId: string,
    options?: {
      userName?: string;
      sessionId?: string;
      conversationHistory?: ConversationMessage[];
    }
  ): Promise<Response> {
    const body: CounselingRequest = {
      message,
      user_id: userId,
      user_name: options?.userName,
      session_id: options?.sessionId,
      conversation_history: options?.conversationHistory,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}/v1/counseling/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Yamii API Error: ${response.status} - ${error}`);
    }

    return response;
  }

  async generateTitle(message: string): Promise<string> {
    try {
      const result = await this.request<{ title: string }>("/v1/summarize-title", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      return result.title;
    } catch {
      // Fallback: truncate first sentence
      const firstSentence = message.match(/^[^。！？.!?\n]+[。！？.!?]?/);
      const title = firstSentence?.[0] || message;
      return title.slice(0, 50) + (title.length > 50 ? "..." : "");
    }
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

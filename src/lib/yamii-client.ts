import type {
  YamiiCounselingRequest,
  YamiiCounselingResponse,
  ConversationMessage,
} from "@/types";

const YAMII_API_URL = process.env.YAMII_API_URL || "http://localhost:8000";

export class YamiiClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || YAMII_API_URL;
    this.apiKey = apiKey;
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
  ): Promise<YamiiCounselingResponse> {
    const body: YamiiCounselingRequest = {
      message,
      user_id: userId,
      user_name: options?.userName,
      session_id: options?.sessionId,
      conversation_history: options?.conversationHistory,
    };

    return this.request<YamiiCounselingResponse>("/v1/counseling", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async healthCheck(): Promise<{ status: string; version: string }> {
    return this.request<{ status: string; version: string }>("/v1/health");
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

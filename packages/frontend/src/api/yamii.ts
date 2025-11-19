/**
 * Yamii API Client
 * 人生相談AIサービスとの通信用クライアント
 */

const YAMII_BASE_URL = import.meta.env.VITE_YAMII_API_URL || 'http://localhost:8000'

/**
 * カウンセリングリクエスト
 */
export interface CounselingRequest {
  message: string
  user_id: string
  user_name?: string
  session_id?: string
  context?: Record<string, any>
  custom_prompt_id?: string
  prompt_id?: string
}

/**
 * 感情分析結果
 */
export interface EmotionAnalysis {
  primary_emotion: string
  intensity: number
  is_crisis: boolean
  all_emotions?: Record<string, number>
}

/**
 * カウンセリングレスポンス
 */
export interface CounselingResponse {
  response: string
  session_id: string
  timestamp: string
  emotion_analysis: EmotionAnalysis
  advice_type: string
  follow_up_questions: string[]
  is_crisis: boolean
}

/**
 * ヘルスチェックレスポンス
 */
export interface HealthCheckResponse {
  status: string
  timestamp: string
  service: string
  version: string
}

class YamiiApiClient {
  private baseUrl: string

  constructor(baseUrl: string = YAMII_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * カウンセリングメッセージを送信
   */
  async sendCounselingMessage(request: CounselingRequest): Promise<CounselingResponse> {
    const response = await fetch(`${this.baseUrl}/counseling`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'リクエストに失敗しました' }))
      throw new Error(error.error || error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'ヘルスチェックに失敗しました' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.json()
  }
}

export const yamiiApi = new YamiiApiClient()

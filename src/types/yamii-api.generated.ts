/**
 * Yamii API Types — auto-generated from OpenAPI schema
 * Yamii API v3.0.0
 *
 * DO NOT EDIT MANUALLY
 * Regenerate with: pnpm generate:yamii-types
 */

/** 会話履歴の1メッセージ */
export interface ConversationMessage {
  /** user または assistant */
  role: string;
  /** メッセージ内容 */
  content: string;
}

/** カウンセリングリクエスト */
export interface CounselingRequest {
  /** 相談メッセージ */
  message: string;
  /** ユーザーID */
  user_id: string;
  /** 表示名 */
  user_name?: string | null;
  /** セッションID */
  session_id?: string | null;
  /** セッション内の会話履歴（クライアント管理、最大10件推奨） */
  conversation_history?: ConversationMessage[] | null;
}

/** 感情分析結果 */
export interface EmotionAnalysisResponse {
  primary_emotion: string;
  intensity: number;
  stability: number;
  is_crisis: boolean;
  all_emotions: Record<string, number>;
  confidence: number;
}

/** カウンセリングレスポンス */
export interface CounselingResponse {
  response: string;
  session_id: string;
  timestamp: string;
  emotion_analysis: EmotionAnalysisResponse;
  advice_type: string;
  follow_up_questions: string[];
  is_crisis: boolean;
  /** プラットフォーム表示用整形済みレスポンス */
  formatted_response?: string | null;
  /** 危機対応リソース */
  crisis_resources?: string[] | null;
}

/** ユーザープロファイル設定リクエスト */
export interface UserProfileRequest {
  explicit_profile?: string | null;
  display_name?: string | null;
}

/** ヘルスチェックレスポンス */
export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  components: Record<string, boolean>;
}

/** タイトル生成リクエスト */
export interface SummarizeTitleRequest {
  /** タイトルを生成する元メッセージ */
  message: string;
}

/** タイトル生成レスポンス */
export interface SummarizeTitleResponse {
  /** 生成されたタイトル */
  title: string;
}

/** API情報レスポンス */
export interface APIInfoResponse {
  service: string;
  version: string;
  description: string;
  features: string[];
}

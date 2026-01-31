/**
 * Yamii API Types — auto-generated from OpenAPI schema
 * Yamii Yamii API v1.0.0
 *
 * DO NOT EDIT MANUALLY
 * Regenerate with: pnpm generate:yamii-types
 */

/** API情報レスポンス */
export interface APIInfoResponse {
  service: string;
  version: string;
  description: string;
  features: string[];
}

/** 認証コールバックリクエスト */
export interface AuthCallbackRequest {
  session_id: string;
  token: string;
}

/** 認証コールバックレスポンス */
export interface AuthCallbackResponse {
  access_token: string;
  user_id: string;
  username: string;
  instance_url: string;
  expires_at: string;
}

/** 認証開始リクエスト */
export interface AuthStartRequest {
  instance_url: string;
}

/** 認証開始レスポンス */
export interface AuthStartResponse {
  auth_url: string;
  session_id: string;
}

/** 暗号化Blobレスポンス */
export interface BlobResponse {
  encrypted_data: string;
  nonce: string;
  created_at: string;
  updated_at: string;
}

/** データ削除リクエスト */
export interface ClearDataRequest {
  /** ユーザーID */
  user_id: string;
  /** 削除を確認 */
  confirm?: boolean;
}

/** データ削除レスポンス */
export interface ClearDataResponse {
  /** レスポンスメッセージ */
  response: string;
  /** コマンド名 */
  command?: string;
  /** 削除されたか */
  deleted?: boolean;
}

/** コマンドレスポンス */
export interface CommandResponse {
  /** レスポンステキスト */
  response: string;
  /** 実行されたコマンド */
  command: string;
  /** コマンドとして処理されたか */
  is_command?: boolean;
}

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

/** 感情分析結果 */
export interface EmotionAnalysisResponse {
  primary_emotion: string;
  intensity: number;
  stability: number;
  is_crisis: boolean;
  all_emotions: Record<string, number>;
  confidence: number;
}

/** エクスポートレスポンス */
export interface ExportResponse {
  /** レスポンスメッセージ */
  response: string;
  /** コマンド名 */
  command?: string;
  /** データサマリー */
  data_summary?: Record<string, unknown> | null;
  /** 完全エクスポートURL */
  full_export_url?: string | null;
}

/** ヘルスチェックレスポンス */
export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  components: Record<string, boolean>;
}

/** メッセージ分類結果 */
export interface MessageClassification {
  /** コマンドかどうか */
  is_command: boolean;
  /** コマンドタイプ */
  command_type?: string | null;
  /** 空メッセージかどうか */
  is_empty: boolean;
  /** カウンセリングに回すべきか */
  should_counsel: boolean;
}

/** メッセージリクエスト */
export interface MessageRequest {
  /** メッセージテキスト */
  message: string;
  /** ユーザーID */
  user_id: string;
  /** プラットフォーム名 */
  platform?: string;
  /** Bot名 */
  bot_name?: string;
}

/** 暗号化Blob保存リクエスト */
export interface SaveBlobRequest {
  encrypted_data: string;
  nonce: string;
}

/** セッション情報 */
export interface SessionInfo {
  user_id: string;
  username: string;
  instance_url: string;
  expires_at: string;
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

/** ユーザープロファイル設定リクエスト */
export interface UserProfileRequest {
  explicit_profile?: string | null;
  display_name?: string | null;
}

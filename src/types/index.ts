// ============================================
// Token Economy（トークン経済）
// 詳細: docs/TOKEN_ECONOMY.md
// ============================================

/**
 * トークン経済のデフォルトパラメータ
 * EconomyConfigテーブルで上書き可能
 * 将来的にYAMI DAO投票で変更可能
 */
export const TOKEN_ECONOMY = {
  // ベーシックインカム（BI）
  DAILY_GRANT_AMOUNT: 10,        // 毎日のBI付与量

  // 減衰（Demurrage）
  DECAY_RATE_PERCENT: 20,        // 日次減衰率（%）- 均衡残高 = BI ÷ 減衰率 = 50

  // 相談コスト（相談者が支払う）
  PRIVATE_CONSULT_COST: 1,       // プライベート相談（AI専用、非公開）
  PUBLIC_CONSULT_COST: 3,        // 公開相談（誰でも回答可能、タイムライン表示）
  DIRECTED_CONSULT_COST: 3,      // 指名相談（指名ユーザーのみ回答可能）
  AI_CONSULT_COST: 1,            // AI相談コスト（安い）- 後方互換
  HUMAN_CONSULT_COST: 5,         // 人間相談コスト（高い）- 後方互換
  DISCUSSION_COST: 0,            // 一般投稿（無料）

  // 回答コストと報酬（アンチスパム + ハイブリッド設計）
  RESPONSE_COST: 2,              // 他人の公開チャットに回答する際のコスト（スパム防止）
  RESPONSE_REWARD: 5,            // 人間回答報酬（ネット +3 YAMI = 適度なインセンティブ）
  BOOST_BONUS: 3,                // チャット所有者によるブースト追加ボーナス（合計 +6 YAMI）
  DAILY_REWARD_CAP: 20,          // 1日あたりの報酬獲得上限（ブーストは別枠）

  // 残高制約
  INITIAL_BALANCE: 50,           // 新規ユーザーの初期残高（均衡残高と同じ）
  MAX_BALANCE: 100,              // 残高の上限（均衡残高の2倍）

  // リアクション（投げ銭）
  REACTION_MIN: 1,               // 最小リアクション
  REACTION_DEFAULT: 1,           // デフォルトリアクション

  // 将来用: YAMI DAO連携（Optimism）
  ETH_PER_TOKEN: "0.0001",       // 1 Token = 0.0001 ETH (Optimism)
  MIN_PURCHASE: 10,              // 最小購入数
  MIN_WITHDRAWAL: 50,            // 最小換金数
  WITHDRAWAL_FEE_PERCENT: 10,    // 換金手数料（DAO運営資金）
  NETWORK: "optimism",           // ネットワーク
  CHAIN_ID: 10,                  // Optimism Mainnet Chain ID

  // 後方互換性エイリアス
  COST_CONSULT_AI: 1,            // → AI_CONSULT_COST
  COST_CONSULT_HUMAN: 5,         // → HUMAN_CONSULT_COST
  COST_DISCUSSION: 0,            // → DISCUSSION_COST
  REWARD_RESPONSE_AI: 0,         // AIは報酬なし
  REWARD_RESPONSE_HUMAN: 3,      // → RESPONSE_REWARD
  ETH_PER_YAMI: "0.0001",        // → ETH_PER_TOKEN
  TOKEN_NAME: "YAMI",            // UI表示用
  TOKEN_SYMBOL: "YAMI",          // UI表示用
} as const;


// ============================================
// Instance types supported
// ============================================
export type InstanceType =
  | "misskey"
  | "cherrypick"
  | "iceshrimp"
  | "sharkey"
  | "mastodon"
  | "Iceshrimp.NET";

// ============================================
// Auth session types
// ============================================
export interface MiAuthSession {
  token: string;
  url: string;
}

export interface MiApiError {
  error: {
    message: string;
    code: string;
    id: string;
  };
}

// ============================================
// User profile types (Misskey authenticated)
// ============================================
export interface UserProfile {
  id: string;
  handle: string;
  account: string;
  hostName: string;
  displayName?: string;
  avatarUrl?: string;
  ethAddress?: string;
}

// ============================================
// Wallet types (1:1 with User)
// ============================================
export type WalletType = "HUMAN" | "AI_SYSTEM" | "AI_AGENT" | "DAO";

export interface Wallet {
  id: string;
  address: string;                // 公開用ウォレットアドレス（0x形式）
  balance: number;
  walletType: WalletType;
  lastDailyGrantAt: Date | null;  // 最後にBI付与を受けた日時
  lastDecayAt: Date | null;       // 最後に減衰が適用された日時
  userId: string;                 // Required (1:1 relation)
  daoAddress: string | null;      // 将来用: Optimismアドレス
  createdAt: Date;
}

export interface WalletWithRelations extends Wallet {
  displayName?: string | null;
  avatarUrl?: string | null;
  _count?: {
    posts: number;
  };
}

// ============================================
// Post types (consultation or reply)
// ============================================
export type PostType = "CONSULTATION" | "RESPONSE" | "DISCUSSION";
export type ConsultTarget = "AI" | "HUMAN" | "ANY";

export interface Post {
  id: string;
  content: string;
  walletId: string;
  parentId: string | null;
  postType: PostType;
  targetType: ConsultTarget | null;
  tokenCost: number;
  tokenReward: number;
  createdAt: Date;
}

export interface PostWithRelations extends Post {
  wallet: {
    id: string;
    address: string;
    walletType: WalletType;
  };
  _count?: {
    transactions: number;
    replies: number;
  };
  transactions?: Transaction[];
  replies?: PostWithRelations[];
  parent?: PostWithRelations | null;
}

// ============================================
// Transaction types (token transfer/reaction)
// ============================================
export type TransactionType =
  | "CONSULT_AI"       // AI相談コスト
  | "CONSULT_HUMAN"    // 人間相談コスト
  | "RESPONSE_COST"    // 回答コスト（スパム防止）
  | "RESPONSE_REWARD"  // 回答報酬
  | "BOOST_BONUS"      // ブーストボーナス
  | "DAILY_GRANT"      // 毎日のBI付与
  | "DECAY"            // 減衰（時間経過による減少）
  | "REACTION"         // リアクション（投げ銭）
  | "SYSTEM_GRANT"     // システム付与（初期配布等）
  // 将来用: DAO連携
  | "PURCHASE"         // トークン購入
  | "WITHDRAWAL"       // トークン換金
  | "DAO_DIVIDEND";    // DAO配当

export interface Transaction {
  id: string;
  postId: string | null;
  senderId: string;
  amount: number;
  txType: TransactionType;
  createdAt: Date;
}

// ============================================
// Token Purchase/Withdrawal types
// ============================================
export type PurchaseStatus = "PENDING" | "CONFIRMED" | "FAILED";
export type WithdrawalStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface YamiPurchase {
  id: string;
  walletId: string;
  amount: number;              // YAMI amount
  ethAmount: string;           // Optimism ETH amount (Wei)
  txHash: string | null;       // Optimism transaction hash
  status: PurchaseStatus;
  createdAt: Date;
  confirmedAt: Date | null;
}

export interface YamiWithdrawal {
  id: string;
  walletId: string;
  amount: number;              // YAMI amount
  ethAmount: string;           // Optimism ETH amount (Wei)
  ethAddress: string;          // Optimism wallet address
  txHash: string | null;       // Optimism transaction hash
  status: WithdrawalStatus;
  createdAt: Date;
  processedAt: Date | null;
}

// ============================================
// Paginated response types
// ============================================
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedPostsResponse {
  posts: PostWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// Yamii API types (generated from OpenAPI schema)
// Regenerate with: pnpm generate:yamii-types
// ============================================
import type {
  CounselingRequest,
  CounselingResponse,
  EmotionAnalysisResponse,
} from "./yamii-api.generated";

export type { ConversationMessage } from "./yamii-api.generated";
export type YamiiCounselingRequest = CounselingRequest;
export type YamiiCounselingResponse = CounselingResponse;
export type EmotionAnalysis = EmotionAnalysisResponse;

// Yamix-specific refinements (stricter than Yamii's generic string types)
export type EmotionType =
  | "happiness"
  | "sadness"
  | "anxiety"
  | "anger"
  | "loneliness"
  | "depression"
  | "stress"
  | "confusion"
  | "hope"
  | "neutral";

export type AdviceType =
  | "crisis_support"
  | "mental_health"
  | "relationship"
  | "career"
  | "family"
  | "friendship"
  | "education"
  | "health"
  | "general_support";

export interface CrisisResource {
  name: string;
  phone: string;
}

// Wallet types (for future yamidao integration)
export interface WalletLink {
  misskeyHandle: string;
  ethAddress: string;
  linkedAt: Date;
}

// ============================================
// User Block types (Phase 2-3: 悪用防止)
// ============================================
export interface UserBlock {
  id: string;
  blockerId: string;   // ブロックする人（相談者）
  blockedId: string;   // ブロックされる人（回答者）
  createdAt: Date;
}

// ============================================
// Chat Session types (二層構造の相談セッション)
// ============================================
export type MessageRole = "USER" | "ASSISTANT";
export type ConsultType = "PRIVATE" | "PUBLIC" | "DIRECTED";

export interface ChatSession {
  id: string;
  userId: string;
  title: string | null;
  consultType: ConsultType;       // 相談タイプ
  isAnonymous: boolean;           // 匿名投稿
  allowAnonymousResponses: boolean; // 匿名回答を許可するか
  category: string | null;        // Phase 2用: カテゴリ
  isPublic: boolean;              // DEPRECATED: consultType=PUBLIC と同義
  targetCount?: number;           // 指名相談の対象ユーザー数
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  isCrisis: boolean;
  responderId?: string | null; // 人間回答者のID
  isAnonymous: boolean;        // 匿名回答
  gasAmount: number;           // 受け取った灯（ともしび）の合計
  responder?: ResponderInfo | null; // 人間回答者の情報（includeで取得時）
  createdAt: Date;
}

// 人間回答のリクエスト
export interface HumanResponseRequest {
  sessionId: string;
  content: string;
}

// 人間回答者の情報
export interface ResponderInfo {
  id: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ChatSessionWithMessages extends ChatSession {
  user?: {
    id: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  messages: ChatMessage[];
  targets?: { userId: string; handle: string; displayName: string | null }[];
}

// サイドバー用の軽量セッション情報
export interface ChatSessionListItem {
  id: string;
  title: string | null;
  preview: string | null; // 最後のメッセージのプレビュー
  consultType: ConsultType; // 相談タイプ
  isAnonymous: boolean;     // 匿名投稿
  isPublic: boolean;        // DEPRECATED
  targetCount?: number;     // 指名相談の対象ユーザー数
  isReceived?: boolean;     // 指名相談で自分がtargetの場合true
  isCrisisPrivatized?: boolean; // モデレーションにより非公開化された場合true
  updatedAt: Date;
}

// タイムライン用の回答情報
export interface TimelineReply {
  id: string;
  content: string;
  createdAt: Date;
  responder: {
    id: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null; // nullの場合はAI回答
}

// タイムライン用の公開相談
export interface TimelineConsultation {
  id: string;
  sessionId: string;
  title: string | null;
  question: string;
  answer: string | null; // 最初のAI回答（PUBLIC相談では人間の回答待ちでnullの場合あり）
  consultType: ConsultType; // 相談タイプ
  isAnonymous: boolean; // 匿名投稿
  user: {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null; // 匿名の場合はnull
  replyCount: number; // 回答数（AI含む）
  replies: TimelineReply[]; // 回答一覧
  createdAt: Date;
  isUserResponse?: boolean; // このアイテムがユーザーの回答である場合true
  responder?: { // 回答者の情報（isUserResponse=trueの場合に使用）
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

// セッション一覧APIレスポンス
export interface ChatSessionsResponse {
  sessions: ChatSessionListItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

// タイムラインAPIレスポンス
export interface TimelineResponse {
  consultations: TimelineConsultation[];
  hasMore: boolean;
  nextCursor: string | null;
}

// ============================================
// User Stats（ユーザー統計）
// 依存度レベルと使用状況
// ============================================

export type DependencyLevel = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

export interface DependencyInfo {
  level: DependencyLevel;
  score: number; // 0-100
  label: string;
  description: string;
}

export interface PeriodStats {
  aiConsults: number;
  humanConsults: number;
  totalConsults: number;
  tokensSpent: number;
  tokensEarned: number;
  netTokens: number;
}

export interface UsageTrend {
  direction: "INCREASING" | "STABLE" | "DECREASING";
  weekOverWeekChange: number; // percentage
}

export interface UserStats {
  walletId: string;
  currentBalance: number;
  equilibriumBalance: number;
  balanceRatio: number;
  dependency: DependencyInfo;
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  trend: UsageTrend;
}

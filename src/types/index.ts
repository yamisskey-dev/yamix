// ============================================
// YAMI Token Economy - 精神資源経済
// ============================================

/**
 * YAMI トークン経済の定数
 * DAOガバナンスで変更可能（EconomyConfigテーブル）
 * ネットワーク: Optimism (YAMI DAOと共通)
 */
export const YAMI_TOKEN_ECONOMY = {
  // トークン情報
  TOKEN_NAME: "YAMI",            // トークン名
  TOKEN_SYMBOL: "YAMI",          // トークンシンボル
  NETWORK: "optimism",           // ネットワーク（YAMI DAOと共通）
  CHAIN_ID: 10,                  // Optimism Mainnet Chain ID

  // 初期配布
  INITIAL_BALANCE: 10,           // 新規ウォレット初期YAMI
  DAILY_FREE_GRANT: 3,           // 毎日の無料付与（予定）

  // 上限
  MAX_BALANCE: 1000,             // 最大保有YAMI

  // 相談コスト（相談者が支払う）
  COST_CONSULT_AI: 1,            // AI相談コスト（安い）
  COST_CONSULT_HUMAN: 5,         // 人間相談コスト（高い）
  COST_CONSULT_ANY: 3,           // どちらでも可（中間）
  COST_DISCUSSION: 0,            // 一般投稿（無料）

  // 回答報酬（回答者が受け取る）
  REWARD_RESPONSE_AI: 0,         // AI回答報酬（なし、運営コスト）
  REWARD_RESPONSE_HUMAN: 4,      // 人間回答報酬（相談コストの80%）
  REWARD_RESPONSE_SELF: 0,       // 自己返信報酬（なし）

  // リアクション（投げ銭）
  REACTION_MIN: 1,               // 最小リアクション
  REACTION_DEFAULT: 1,           // デフォルトリアクション

  // Optimism ETH換算レート（予定）
  ETH_PER_YAMI: "0.0001",        // 1 YAMI = 0.0001 ETH (Optimism)
  MIN_PURCHASE: 10,              // 最小購入YAMI数
  MIN_WITHDRAWAL: 50,            // 最小換金YAMI数
  WITHDRAWAL_FEE_PERCENT: 10,    // 換金手数料（DAO運営資金）
} as const;

// 後方互換性のためのエイリアス
export const MENTAL_RESOURCE_ECONOMY = YAMI_TOKEN_ECONOMY;

// 後方互換性のためのエイリアス
export const TOKEN_ECONOMY = YAMI_TOKEN_ECONOMY;

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
  address: string;
  balance: number;
  walletType: WalletType;
  userId: string; // Required (1:1 relation)
  createdAt: Date;
}

export interface WalletWithRelations extends Wallet {
  displayName?: string | null;
  avatarUrl?: string | null;
  _count?: {
    posts: number;
    following: number;
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
  | "CONSULT_AI"
  | "CONSULT_HUMAN"
  | "RESPONSE_REWARD"
  | "REACTION"
  | "PURCHASE"
  | "WITHDRAWAL"
  | "SYSTEM_GRANT"
  | "DAO_DIVIDEND";

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

// 後方互換性のためのエイリアス
export type TokenPurchase = YamiPurchase;
export type TokenWithdrawal = YamiWithdrawal;

// ============================================
// Follow types (silent watching)
// ============================================
export interface Follow {
  id: string;
  followerId: string;
  targetId: string;
  createdAt: Date;
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
// Yamii API types
export interface YamiiCounselingRequest {
  message: string;
  user_id: string;
  user_name?: string;
  session_id?: string;
  conversation_history?: ConversationMessage[];
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface YamiiCounselingResponse {
  response: string;
  session_id: string;
  timestamp: string;
  emotion_analysis: EmotionAnalysis;
  advice_type: AdviceType;
  follow_up_questions: string[];
  is_crisis: boolean;
  crisis_resources?: CrisisResource[];
}

export interface EmotionAnalysis {
  primary_emotion: EmotionType;
  intensity: number; // 0.0 - 1.0
  stability: number;
  is_crisis: boolean;
  all_emotions: Record<string, number>;
  confidence: number;
}

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

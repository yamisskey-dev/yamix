/**
 * プライバシーファースト: メッセージ暗号化ユーティリティ
 *
 * - AES-256-GCM による対称暗号化
 * - ユーザーごとの派生キー (PBKDF2)
 * - 全メッセージは暗号化必須
 */

import crypto from "crypto";
import { logger } from "@/lib/logger";

// 暗号化されたメッセージのプレフィックス
const ENCRYPTED_PREFIX = "$enc$";

// 暗号化アルゴリズム
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM推奨
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256ビット
let _encKeyWarned = false;
let _masterKeyCache: Buffer | null = null;
const _userKeyCache = new Map<string, Buffer>();
const USER_KEY_CACHE_MAX = 1000;

/**
 * マスターキーを取得（キャッシュ付き）
 * 環境変数から取得、なければ生成（開発用）
 */
function getMasterKey(): Buffer {
  if (_masterKeyCache) return _masterKeyCache;

  const envKey = process.env.MESSAGE_ENCRYPTION_KEY;
  if (envKey) {
    _masterKeyCache = Buffer.from(envKey, "base64");
    return _masterKeyCache;
  }

  // フォールバック: JWT_SECRETからキーを派生（既存データとの互換性のため維持）
  if (process.env.NODE_ENV === "production" && !_encKeyWarned) {
    _encKeyWarned = true;
    logger.warn("MESSAGE_ENCRYPTION_KEY not set in production. Using derived key from JWT_SECRET.");
  }
  const jwtSecret = process.env.JWT_SECRET || "development-secret";
  _masterKeyCache = crypto.pbkdf2Sync(jwtSecret, "yamix-fallback-salt", 100000, KEY_LENGTH, "sha256");
  return _masterKeyCache;
}

/**
 * ユーザーIDからメッセージ暗号化キーを派生（キャッシュ付き）
 * PBKDF2は10万回イテレーションで高コストのため、ユーザーごとにキャッシュ
 */
function deriveUserKey(userId: string, context: string = "chat_message"): Buffer {
  const cacheKey = `${userId}:${context}`;
  const cached = _userKeyCache.get(cacheKey);
  if (cached) return cached;

  const masterKey = getMasterKey();
  const salt = crypto
    .createHash("sha256")
    .update(`yamix:${userId}:${context}`)
    .digest()
    .subarray(0, SALT_LENGTH);

  const key = crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, "sha256");

  // キャッシュサイズ制限（メモリリーク防止）
  if (_userKeyCache.size >= USER_KEY_CACHE_MAX) {
    const firstKey = _userKeyCache.keys().next().value;
    if (firstKey !== undefined) _userKeyCache.delete(firstKey);
  }
  _userKeyCache.set(cacheKey, key);

  return key;
}

/**
 * メッセージを暗号化
 *
 * @param plaintext - 暗号化するメッセージ
 * @param userId - ユーザーID（キー派生に使用）
 * @returns 暗号化された文字列（プレフィックス付き）
 */
export function encryptMessage(plaintext: string, userId: string): string {
  const key = deriveUserKey(userId);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // IV + AuthTag + Ciphertext を結合してBase64エンコード
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return ENCRYPTED_PREFIX + combined.toString("base64");
}

/**
 * メッセージを復号
 *
 * @param ciphertext - 暗号化されたメッセージ（または平文）
 * @param userId - ユーザーID（キー派生に使用）
 * @returns 復号されたメッセージ
 */
export function decryptMessage(ciphertext: string, userId: string): string {
  // 後方互換性: 暗号化されていないメッセージはそのまま返す
  // マイグレーション完了後に削除可能: pnpm encrypt:check で確認
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    return ciphertext;
  }

  const key = deriveUserKey(userId);
  const data = Buffer.from(ciphertext.slice(ENCRYPTED_PREFIX.length), "base64");

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * メッセージが暗号化されているかチェック
 */
export function isEncrypted(content: string): boolean {
  return content.startsWith(ENCRYPTED_PREFIX);
}

/**
 * 複数メッセージを一括復号
 */
export function decryptMessages<T extends { content: string; userId?: string }>(
  messages: T[],
  defaultUserId: string
): T[] {
  return messages.map((msg) => ({
    ...msg,
    content: decryptMessage(msg.content, msg.userId || defaultUserId),
  }));
}

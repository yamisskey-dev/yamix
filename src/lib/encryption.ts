/**
 * プライバシーファースト: メッセージ暗号化ユーティリティ
 *
 * - AES-256-GCM による対称暗号化
 * - ランダムソルトによるPBKDF2キー派生（レインボーテーブル攻撃対策）
 * - 全メッセージは暗号化必須
 */

import crypto from "crypto";
import { logger } from "@/lib/logger";

// 暗号化されたメッセージのプレフィックス
const ENCRYPTED_PREFIX_V2 = "$enc2$"; // Random salt per message

// 暗号化アルゴリズム
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM推奨
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256ビット
const PBKDF2_ITERATIONS = 100000; // 10万回イテレーション
let _encKeyWarned = false;
let _masterKeyCache: Buffer | null = null;

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
 * ランダムソルトからメッセージ暗号化キーを派生（V2）
 * SECURITY: Each message uses a unique random salt (rainbow table attack prevention)
 */
function deriveUserKeyV2(userId: string, salt: Buffer, context: string = "chat_message"): Buffer {
  const masterKey = getMasterKey();

  // Combine master key, userId, and context for key derivation
  const derivationKey = crypto
    .createHash("sha256")
    .update(masterKey)
    .update(userId)
    .update(context)
    .digest();

  // PBKDF2 with random salt
  const key = crypto.pbkdf2Sync(derivationKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");

  return key;
}


/**
 * メッセージを暗号化（V2: ランダムソルト使用）
 *
 * @param plaintext - 暗号化するメッセージ
 * @param userId - ユーザーID（キー派生に使用）
 * @returns 暗号化された文字列（プレフィックス付き）
 *
 * Format: $enc2$ + base64(salt + iv + authTag + ciphertext)
 * - salt: 16 bytes (random, unique per message)
 * - iv: 12 bytes (random)
 * - authTag: 16 bytes (GCM authentication tag)
 * - ciphertext: variable length
 */
export function encryptMessage(plaintext: string, userId: string): string {
  // Generate random salt (SECURITY: unique per message)
  const salt = crypto.randomBytes(SALT_LENGTH);

  // Derive key from random salt
  const key = deriveUserKeyV2(userId, salt);

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Encrypt
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine: Salt + IV + AuthTag + Ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  return ENCRYPTED_PREFIX_V2 + combined.toString("base64");
}

/**
 * メッセージを復号
 *
 * @param ciphertext - 暗号化されたメッセージ
 * @param userId - ユーザーID（キー派生に使用）
 * @returns 復号されたメッセージ
 */
export function decryptMessage(ciphertext: string, userId: string): string {
  // V2 format: $enc2$ + base64(salt + iv + authTag + ciphertext)
  if (ciphertext.startsWith(ENCRYPTED_PREFIX_V2)) {
    const data = Buffer.from(ciphertext.slice(ENCRYPTED_PREFIX_V2.length), "base64");

    // Extract components
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = data.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Derive key from stored salt
    const key = deriveUserKeyV2(userId, salt);

    // Decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }

  // すべてのメッセージはV2形式であるべき
  throw new Error("Invalid encrypted message format");
}

/**
 * メッセージが暗号化されているかチェック
 */
export function isEncrypted(content: string): boolean {
  return content.startsWith(ENCRYPTED_PREFIX_V2);
}

/**
 * メッセージの暗号化バージョンを取得
 */
export function getEncryptionVersion(content: string): "v2" {
  if (content.startsWith(ENCRYPTED_PREFIX_V2)) return "v2";
  throw new Error("Invalid encrypted message format");
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

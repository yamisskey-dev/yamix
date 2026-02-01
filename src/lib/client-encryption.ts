/**
 * クライアントサイド E2EE (End-to-End Encryption) 実装
 * Web Crypto API を使用した AES-256-GCM 暗号化
 *
 * アーキテクチャ:
 * - ユーザーの Misskey トークンから鍵導出関数 (PBKDF2) でマスター鍵を生成
 * - マスター鍵はサーバーに暗号化して保存 (クロスデバイス対応)
 * - メッセージは送信前にクライアントサイドで暗号化
 * - AI メッセージは技術的制約により除外 (サーバーサイド暗号化のまま)
 */

// 暗号化されたデータの型
export interface EncryptedData {
  ciphertext: string; // Base64 エンコードされた暗号文
  iv: string; // 初期化ベクトル (Base64)
  salt: string; // ソルト (Base64)
  isEncrypted: true; // E2EE フラグ
}

// マスター鍵の型
interface MasterKey {
  key: CryptoKey;
  rawKey: ArrayBuffer; // エクスポート用
}

// ブラウザのメモリに保持されるマスター鍵 (セッション中のみ)
let cachedMasterKey: MasterKey | null = null;

/**
 * ArrayBuffer を Base64 文字列に変換
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 文字列を ArrayBuffer に変換
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * ランダムなソルトを生成
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * ランダムな初期化ベクトル (IV) を生成
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12)); // GCM mode uses 12 bytes
}

/**
 * ユーザーパスフレーズからマスター鍵を導出
 * PBKDF2 を使用して、パスフレーズから暗号化に使える鍵を生成
 *
 * 注意: JWT トークンは定期的に変わる可能性があるため、
 * ユーザー固有の識別子（handle）を使用して安定した鍵導出を実現
 */
async function deriveMasterKeyFromPassphrase(
  userHandle: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // ユーザーハンドルを鍵マテリアルに変換
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userHandle),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // PBKDF2 で AES-256 鍵を導出
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000, // OWASP 推奨値
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // extractable (エクスポート可能)
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * 新しいマスター鍵を生成 (初回ログイン時)
 */
async function generateMasterKey(): Promise<MasterKey> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  const rawKey = await crypto.subtle.exportKey('raw', key);

  return { key, rawKey };
}

/**
 * マスター鍵をユーザーハンドルで暗号化 (サーバー保存用)
 */
async function encryptMasterKey(
  masterKey: ArrayBuffer,
  userHandle: string
): Promise<{ encryptedKey: string; salt: string; iv: string }> {
  const salt = generateSalt();
  const iv = generateIV();

  // ユーザーハンドルから鍵を導出
  const derivedKey = await deriveMasterKeyFromPassphrase(userHandle, salt);

  // マスター鍵を暗号化
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    derivedKey,
    masterKey
  );

  return {
    encryptedKey: arrayBufferToBase64(encrypted),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * 暗号化されたマスター鍵を復号 (他デバイスからのログイン時)
 */
async function decryptMasterKey(
  encryptedKey: string,
  salt: string,
  iv: string,
  userHandle: string
): Promise<CryptoKey> {
  const saltBuffer = new Uint8Array(base64ToArrayBuffer(salt));
  const ivBuffer = new Uint8Array(base64ToArrayBuffer(iv));
  const encryptedBuffer = base64ToArrayBuffer(encryptedKey);

  // ユーザーハンドルから鍵を導出
  const derivedKey = await deriveMasterKeyFromPassphrase(
    userHandle,
    saltBuffer
  );

  // マスター鍵を復号
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    derivedKey,
    encryptedBuffer
  );

  // CryptoKey にインポート
  const key = await crypto.subtle.importKey(
    'raw',
    decrypted,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * マスター鍵を初期化 (アプリ起動時・ログイン時)
 * サーバーから取得するか、新規生成してサーバーに保存
 *
 * @param userHandle ユーザーハンドル (@username@instance.tld)
 */
export async function initializeMasterKey(userHandle: string): Promise<void> {
  try {
    // サーバーから暗号化されたマスター鍵を取得
    // 認証はクッキーのJWTで行われる
    const response = await fetch('/api/crypto/key');

    if (response.ok) {
      // 既存の鍵を復号
      const data = await response.json();
      const masterKey = await decryptMasterKey(
        data.encryptedKey,
        data.salt,
        data.iv,
        userHandle
      );

      const rawKey = await crypto.subtle.exportKey('raw', masterKey);
      cachedMasterKey = { key: masterKey, rawKey };
      console.log('[E2EE] Master key loaded from server');
    } else if (response.status === 404) {
      // 初回ログイン: 新しいマスター鍵を生成
      const masterKey = await generateMasterKey();
      const encrypted = await encryptMasterKey(masterKey.rawKey, userHandle);

      // サーバーに保存
      await fetch('/api/crypto/key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(encrypted),
      });

      cachedMasterKey = masterKey;
      console.log('[E2EE] New master key generated and saved');
    } else {
      throw new Error('Failed to fetch master key');
    }
  } catch (error) {
    console.error('[E2EE] Failed to initialize master key:', error);
    throw error;
  }
}

/**
 * テキストを暗号化
 * @param plaintext 平文
 * @returns 暗号化されたデータ
 */
export async function encrypt(plaintext: string): Promise<EncryptedData> {
  if (!cachedMasterKey) {
    throw new Error('Master key not initialized. Call initializeMasterKey() first.');
  }

  const iv = generateIV();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    cachedMasterKey.key,
    data
  );

  // ソルトはマスター鍵の暗号化に使用されるので、ここでは空文字列
  // (各メッセージごとに異なる IV で十分)
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: '', // 使用しない
    isEncrypted: true,
  };
}

/**
 * 暗号化されたテキストを復号
 * @param encryptedData 暗号化されたデータ
 * @returns 平文
 */
export async function decrypt(encryptedData: EncryptedData): Promise<string> {
  if (!cachedMasterKey) {
    throw new Error('Master key not initialized. Call initializeMasterKey() first.');
  }

  const ivBuffer = new Uint8Array(base64ToArrayBuffer(encryptedData.iv));
  const ciphertextBuffer = base64ToArrayBuffer(encryptedData.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    cachedMasterKey.key,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * データが暗号化されているかチェック
 */
export function isEncrypted(data: unknown): data is EncryptedData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'isEncrypted' in data &&
    data.isEncrypted === true
  );
}

/**
 * マスター鍵がキャッシュされているかチェック
 */
export function isMasterKeyInitialized(): boolean {
  return cachedMasterKey !== null;
}

/**
 * マスター鍵をクリア (ログアウト時)
 */
export function clearMasterKey(): void {
  cachedMasterKey = null;
  console.log('[E2EE] Master key cleared');
}

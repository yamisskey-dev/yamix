import { describe, it, expect } from "vitest";
import {
  encryptMessage,
  decryptMessage,
  safeDecryptMessage,
  DECRYPT_FAILED_PLACEHOLDER,
  isEncrypted,
  decryptMessages,
} from "./encryption";

const USER_ID = "test-user-123";

describe("encryptMessage / decryptMessage", () => {
  it("roundtrips correctly", () => {
    const plaintext = "Hello, world!";
    const encrypted = encryptMessage(plaintext, USER_ID);
    const decrypted = decryptMessage(encrypted, USER_ID);
    expect(decrypted).toBe(plaintext);
  });

  it("roundtrips Japanese text", () => {
    const plaintext = "こんにちは世界";
    const encrypted = encryptMessage(plaintext, USER_ID);
    expect(decryptMessage(encrypted, USER_ID)).toBe(plaintext);
  });

  it("roundtrips empty string", () => {
    const encrypted = encryptMessage("", USER_ID);
    expect(decryptMessage(encrypted, USER_ID)).toBe("");
  });

  it("produces different ciphertexts for same plaintext (random IV)", () => {
    const a = encryptMessage("test", USER_ID);
    const b = encryptMessage("test", USER_ID);
    expect(a).not.toBe(b);
  });

  it("different users produce different ciphertexts", () => {
    const a = encryptMessage("test", "user-1");
    const b = encryptMessage("test", "user-2");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with wrong user", () => {
    const encrypted = encryptMessage("secret", "user-1");
    expect(() => decryptMessage(encrypted, "user-2")).toThrow();
  });

  it("repeated decryption of the same ciphertext returns the same plaintext (key cache)", () => {
    const encrypted = encryptMessage("cached message", USER_ID);
    for (let i = 0; i < 5; i++) {
      expect(decryptMessage(encrypted, USER_ID)).toBe("cached message");
    }
  });

  it("key cache does not leak keys across users", () => {
    const encrypted = encryptMessage("secret", "user-1");
    // user-1 の復号でキーがキャッシュされた後でも、user-2 では復号できない
    expect(decryptMessage(encrypted, "user-1")).toBe("secret");
    expect(() => decryptMessage(encrypted, "user-2")).toThrow();
  });
});

describe("isEncrypted", () => {
  it("returns true for encrypted content", () => {
    const encrypted = encryptMessage("test", USER_ID);
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isEncrypted("plain text")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isEncrypted("")).toBe(false);
  });
});

describe("decryptMessage V2-only policy", () => {
  it("throws on non-V2 content", () => {
    // V1サポートとマイグレーションは削除済み(8b6a22d)。平文パススルーは許可しない
    expect(() => decryptMessage("plain text", USER_ID)).toThrow(
      "Invalid encrypted message format"
    );
  });
});

describe("safeDecryptMessage", () => {
  it("decrypts valid V2 content", () => {
    const encrypted = encryptMessage("hello", USER_ID);
    expect(safeDecryptMessage(encrypted, USER_ID)).toBe("hello");
  });

  it("returns placeholder for non-V2 content instead of throwing", () => {
    expect(safeDecryptMessage("plain text", USER_ID)).toBe(DECRYPT_FAILED_PLACEHOLDER);
  });

  it("returns placeholder when decrypting with wrong user", () => {
    const encrypted = encryptMessage("secret", "user-1");
    expect(safeDecryptMessage(encrypted, "user-2")).toBe(DECRYPT_FAILED_PLACEHOLDER);
  });

  it("returns placeholder for corrupted ciphertext", () => {
    expect(safeDecryptMessage("$enc2$not-valid-base64!!", USER_ID)).toBe(
      DECRYPT_FAILED_PLACEHOLDER
    );
  });
});

describe("decryptMessages", () => {
  it("decrypts batch of messages", () => {
    const msg1 = encryptMessage("hello", USER_ID);
    const msg2 = encryptMessage("world", USER_ID);

    const result = decryptMessages(
      [
        { content: msg1, id: "1" },
        { content: msg2, id: "2" },
      ],
      USER_ID
    );

    expect(result[0].content).toBe("hello");
    expect(result[1].content).toBe("world");
    expect(result[0].id).toBe("1");
  });

  it("throws when batch contains non-V2 content", () => {
    expect(() =>
      decryptMessages([{ content: "plain", id: "1" }], USER_ID)
    ).toThrow("Invalid encrypted message format");
  });
});

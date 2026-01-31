import { describe, it, expect } from "vitest";
import { encryptMessage, decryptMessage, isEncrypted, decryptMessages } from "./encryption";

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

describe("decryptMessage backward compatibility", () => {
  it("returns unencrypted text as-is", () => {
    expect(decryptMessage("plain text", USER_ID)).toBe("plain text");
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

  it("passes through unencrypted messages", () => {
    const result = decryptMessages(
      [{ content: "plain", id: "1" }],
      USER_ID
    );
    expect(result[0].content).toBe("plain");
  });
});

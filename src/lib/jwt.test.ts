import { describe, it, expect } from "vitest";
import { createJWT, verifyJWT, getTokenFromCookie, createTokenCookie, createLogoutCookie } from "./jwt";

const testPayload = {
  sub: "@test@misskey.io",
  userId: "user-123",
  walletId: "wallet-456",
  hostName: "misskey.io",
};

describe("createJWT / verifyJWT", () => {
  it("roundtrips correctly", async () => {
    const token = await createJWT(testPayload);
    const result = await verifyJWT(token);
    expect(result).not.toBeNull();
    expect(result!.sub).toBe(testPayload.sub);
    expect(result!.userId).toBe(testPayload.userId);
    expect(result!.walletId).toBe(testPayload.walletId);
    expect(result!.hostName).toBe(testPayload.hostName);
  });

  it("includes iat and exp", async () => {
    const token = await createJWT(testPayload);
    const result = await verifyJWT(token);
    expect(result!.iat).toBeDefined();
    expect(result!.exp).toBeDefined();
    expect(result!.exp!).toBeGreaterThan(result!.iat!);
  });

  it("returns null for invalid token", async () => {
    const result = await verifyJWT("invalid.token.here");
    expect(result).toBeNull();
  });

  it("returns null for tampered token", async () => {
    const token = await createJWT(testPayload);
    const tampered = token.slice(0, -5) + "XXXXX";
    const result = await verifyJWT(tampered);
    expect(result).toBeNull();
  });
});

describe("getTokenFromCookie", () => {
  it("extracts yamix-token", () => {
    const cookie = "yamix-token=abc123; other=xyz";
    expect(getTokenFromCookie(cookie)).toBe("abc123");
  });

  it("returns null when no yamix-token", () => {
    expect(getTokenFromCookie("other=xyz")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(getTokenFromCookie(null)).toBeNull();
  });

  it("handles single cookie", () => {
    expect(getTokenFromCookie("yamix-token=tok")).toBe("tok");
  });
});

describe("createTokenCookie", () => {
  it("includes token value", () => {
    const cookie = createTokenCookie("mytoken");
    expect(cookie).toContain("yamix-token=mytoken");
  });

  it("includes HttpOnly and Path", () => {
    const cookie = createTokenCookie("t");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
  });

  it("includes Max-Age for 7 days", () => {
    const cookie = createTokenCookie("t");
    expect(cookie).toContain(`Max-Age=${7 * 24 * 60 * 60}`);
  });
});

describe("createLogoutCookie", () => {
  it("sets Max-Age=0", () => {
    const cookie = createLogoutCookie();
    expect(cookie).toContain("Max-Age=0");
  });

  it("clears token value", () => {
    const cookie = createLogoutCookie();
    expect(cookie).toContain("yamix-token=;");
  });
});

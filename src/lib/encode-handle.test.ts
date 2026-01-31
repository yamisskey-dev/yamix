import { describe, it, expect } from "vitest";
import { encodeHandle } from "./encode-handle";

describe("encodeHandle", () => {
  it("preserves @ in Misskey handles", () => {
    expect(encodeHandle("@user@misskey.io")).toBe("@user@misskey.io");
  });

  it("encodes spaces", () => {
    expect(encodeHandle("@user name@misskey.io")).toBe("@user%20name@misskey.io");
  });

  it("handles without @ prefix", () => {
    expect(encodeHandle("user@misskey.io")).toBe("user@misskey.io");
  });

  it("encodes unicode characters", () => {
    const result = encodeHandle("@テスト@misskey.io");
    expect(result).toContain("@");
    expect(result).toContain("misskey.io");
    expect(result).not.toContain("テスト");
  });

  it("handles empty string", () => {
    expect(encodeHandle("")).toBe("");
  });
});

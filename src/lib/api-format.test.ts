import { describe, it, expect } from "vitest";
import { toPublicUserRef, paginate } from "./api-format";

describe("toPublicUserRef", () => {
  it("profile ありのユーザーを表示用の形に射影する", () => {
    const user = {
      handle: "alice@example.social",
      profile: { displayName: "Alice", avatarUrl: "https://example.com/a.png" },
    };
    expect(toPublicUserRef(user)).toEqual({
      handle: "alice@example.social",
      displayName: "Alice",
      avatarUrl: "https://example.com/a.png",
    });
  });

  it("profile が null なら displayName/avatarUrl を null にする", () => {
    expect(toPublicUserRef({ handle: "bob@example.social", profile: null })).toEqual({
      handle: "bob@example.social",
      displayName: null,
      avatarUrl: null,
    });
  });

  it("profile の各フィールドが null の場合も null を返す", () => {
    const user = {
      handle: "carol@example.social",
      profile: { displayName: null, avatarUrl: null },
    };
    expect(toPublicUserRef(user)).toEqual({
      handle: "carol@example.social",
      displayName: null,
      avatarUrl: null,
    });
  });
});

describe("paginate", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}` }));

  it("limit を超える行があれば hasMore と nextCursor を返す", () => {
    const result = paginate(rows(4), 3);
    expect(result.items).toHaveLength(3);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("id-2");
  });

  it("limit ちょうどなら hasMore は false で nextCursor は null", () => {
    const result = paginate(rows(3), 3);
    expect(result.items).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("空配列を安全に扱う", () => {
    const result = paginate([], 10);
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});

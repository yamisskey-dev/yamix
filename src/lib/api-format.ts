/**
 * API レスポンス整形の共通ヘルパー
 *
 * タイムライン系ルートで繰り返されていたユーザー射影と
 * カーソルページネーションを一箇所に集約する。
 */

export interface PublicUserRef {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface UserWithProfile {
  handle: string;
  profile?: { displayName: string | null; avatarUrl: string | null } | null;
}

/**
 * User + Profile を公開表示用の形に射影する
 * id が必要な場合は呼び出し側で { id: u.id, ...toPublicUserRef(u) } とする
 */
export function toPublicUserRef(user: UserWithProfile): PublicUserRef {
  return {
    handle: user.handle,
    displayName: user.profile?.displayName || null,
    avatarUrl: user.profile?.avatarUrl || null,
  };
}

/**
 * take: limit + 1 で取得した行をカーソルページネーションの形に整形する
 */
export function paginate<T extends { id: string }>(
  rows: T[],
  limit: number
): { items: T[]; hasMore: boolean; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return {
    items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

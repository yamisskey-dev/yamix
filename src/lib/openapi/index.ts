import type { OpenAPIV3 } from "openapi-types";
import { components } from "./schemas";
import { authPaths } from "./auth";
import { chatPaths } from "./chat";
import { timelinePaths } from "./timeline";
import { tokensPaths } from "./tokens";
import { usersPaths } from "./users";

export const getApiDocs = async (): Promise<OpenAPIV3.Document> => {
  return {
    openapi: "3.0.0",
    info: {
      title: "Yamix API",
      version: "1.0.0",
      description: `
# Yamix API Documentation

YAMI トークン経済プラットフォームのREST API仕様です。

## 認証

全てのエンドポイント（認証系を除く）はHTTP Only Cookieによる認証が必要です。

### ログインフロー

1. \`GET /api/auth/misskey-login?instance={instance}\` - MiAuthセッション開始
2. Misskeyで認証
3. \`GET /api/auth/callback\` - コールバック処理
4. JWTトークンがCookieに設定されます

## レート制限

- チャット作成: 10回/分
- メッセージ送信: 30回/分
- AI相談: 20回/分

## エラーレスポンス

全てのエラーは以下の形式で返されます:

\`\`\`json
{
  "error": "エラーメッセージ"
}
\`\`\`

HTTPステータスコード:
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 認可エラー
- 404: リソースが見つからない
- 429: レート制限超過
- 500: サーバーエラー

## FastAPI（Yamii）との統合

このAPIはOpenAPI 3.0標準に準拠しており、FastAPIで実装されたYamii APIと統一的に扱えます。
      `,
      contact: {
        name: "Yamix Development Team",
        url: "https://github.com/yamisskey-dev/yamix",
      },
      license: {
        name: "AGPL-3.0",
        url: "https://www.gnu.org/licenses/agpl-3.0.html",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "開発環境",
      },
      {
        url: "https://yamix.example.com",
        description: "本番環境",
      },
    ],
    tags: [
      {
        name: "Authentication",
        description: "認証関連API - Misskey MiAuth + JWT",
      },
      {
        name: "Sessions",
        description: "相談セッション管理 - AI/人間相談の二層構造",
      },
      {
        name: "Messages",
        description: "メッセージ・回答管理",
      },
      {
        name: "Users",
        description: "ユーザー管理・ブロック機能",
      },
      {
        name: "Notifications",
        description: "通知管理（アプリ内通知）",
      },
      {
        name: "Bookmarks",
        description: "ブックマーク管理",
      },
      {
        name: "Timeline",
        description: "公開タイムライン",
      },
      {
        name: "Yamii",
        description: "AI相談プロキシ（Yamii API連携）",
      },
      {
        name: "System",
        description: "システム情報・ヘルスチェック",
      },
    ],
    paths: {
      ...authPaths,
      ...chatPaths,
      ...usersPaths,
      ...timelinePaths,
      ...tokensPaths,
    },
    components,
  };
};

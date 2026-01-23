import type { OpenAPIV3 } from "openapi-types";

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

全てのエンドポイントはHTTP Only Cookieによる認証が必要です。

### ログインフロー

1. \`GET /api/auth/misskey-login\` - MiAuthセッション開始
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
        description: "認証関連API",
      },
      {
        name: "Sessions",
        description: "相談セッション管理",
      },
      {
        name: "Messages",
        description: "メッセージ・回答管理",
      },
      {
        name: "Users",
        description: "ユーザー管理",
      },
      {
        name: "Notifications",
        description: "通知管理",
      },
      {
        name: "Bookmarks",
        description: "ブックマーク管理",
      },
      {
        name: "Yamii",
        description: "AI相談プロキシ",
      },
    ],
    paths: {
      "/api/chat/sessions": {
        get: {
          tags: ["Sessions"],
          summary: "相談セッション一覧を取得",
          description: "ユーザーの相談セッション一覧を取得します（ページネーション対応）",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", default: 20 },
              description: "取得件数",
            },
            {
              in: "query",
              name: "cursor",
              schema: { type: "string" },
              description: "カーソル（次ページ取得用）",
            },
          ],
          responses: {
            "200": {
              description: "セッション一覧",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      sessions: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ChatSession" },
                      },
                      hasMore: { type: "boolean" },
                      nextCursor: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
            "401": {
              description: "認証エラー",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
        post: {
          tags: ["Sessions"],
          summary: "新しい相談セッションを作成",
          description: "新しい相談セッションを作成します",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    consultType: {
                      type: "string",
                      enum: ["PRIVATE", "PUBLIC"],
                      default: "PRIVATE",
                      description: "PRIVATE: AI専用/非公開（1 YAMI）, PUBLIC: 公開/人間も回答可能（3 YAMI）",
                    },
                    isAnonymous: {
                      type: "boolean",
                      default: false,
                      description: "匿名投稿",
                    },
                    allowAnonymousResponses: {
                      type: "boolean",
                      default: true,
                      description: "匿名回答を許可",
                    },
                    category: {
                      type: "string",
                      nullable: true,
                      description: "カテゴリ（恋愛/仕事/メンタル等）",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "セッション作成成功",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ChatSession" },
                },
              },
            },
            "401": {
              description: "認証エラー",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "429": {
              description: "レート制限超過",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
        delete: {
          tags: ["Sessions"],
          summary: "相談セッションを一括削除",
          description: "ユーザーの相談セッションを一括削除します（物理削除）",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "query",
              name: "type",
              schema: { type: "string", enum: ["private", "all"] },
              description: "private: プライベート相談のみ削除, all: 全ての相談を削除",
            },
          ],
          responses: {
            "200": {
              description: "削除成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      deletedCount: { type: "integer" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "認証エラー",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "auth-token",
          description: "JWT認証トークン（HTTP Only Cookie）",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "エラーメッセージ",
            },
          },
          required: ["error"],
        },
        ChatSession: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "セッションID",
            },
            userId: {
              type: "string",
              description: "ユーザーID",
            },
            title: {
              type: "string",
              nullable: true,
              description: "セッションタイトル",
            },
            consultType: {
              type: "string",
              enum: ["PRIVATE", "PUBLIC"],
              description: "相談タイプ (PRIVATE: AI専用/非公開, PUBLIC: 公開/人間も回答可能)",
            },
            isAnonymous: {
              type: "boolean",
              description: "匿名投稿",
            },
            allowAnonymousResponses: {
              type: "boolean",
              description: "匿名回答を許可",
            },
            category: {
              type: "string",
              nullable: true,
              description: "カテゴリ（恋愛/仕事/メンタル等）",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "作成日時",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "更新日時",
            },
          },
        },
        ChatMessage: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "メッセージID",
            },
            sessionId: {
              type: "string",
              description: "セッションID",
            },
            role: {
              type: "string",
              enum: ["USER", "ASSISTANT"],
              description: "送信者ロール",
            },
            content: {
              type: "string",
              description: "メッセージ内容",
            },
            isCrisis: {
              type: "boolean",
              description: "危機検出フラグ",
            },
            responderId: {
              type: "string",
              nullable: true,
              description: "回答者ID（人間が回答した場合）",
            },
            isAnonymous: {
              type: "boolean",
              description: "匿名回答",
            },
            gasAmount: {
              type: "integer",
              description: "受け取った灯（ともしび）の合計",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "作成日時",
            },
          },
        },
      },
    },
  };
};

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
      // ============================================
      // Authentication
      // ============================================
      "/api/auth/misskey-login": {
        get: {
          tags: ["Authentication"],
          summary: "MiAuthセッション開始",
          description: "Misskey MiAuthによる認証フローを開始します",
          parameters: [
            {
              in: "query",
              name: "instance",
              required: true,
              schema: { type: "string" },
              description: "MisskeyインスタンスのURL",
            },
          ],
          responses: {
            "302": {
              description: "MiAuth認証ページにリダイレクト",
            },
            "400": {
              description: "パラメータエラー",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/api/auth/callback": {
        get: {
          tags: ["Authentication"],
          summary: "MiAuthコールバック処理",
          description: "Misskey認証後のコールバックを処理し、JWTトークンを発行します",
          parameters: [
            {
              in: "query",
              name: "session",
              required: true,
              schema: { type: "string" },
              description: "MiAuthセッションID",
            },
          ],
          responses: {
            "302": {
              description: "ログイン成功、メインページにリダイレクト",
            },
            "401": {
              description: "認証失敗",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Authentication"],
          summary: "現在のユーザー情報を取得",
          description: "認証済みユーザーの情報を取得します",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "ユーザー情報",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/User" },
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
      "/api/auth/logout": {
        post: {
          tags: ["Authentication"],
          summary: "ログアウト",
          description: "JWTトークンを削除してログアウトします",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "ログアウト成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ============================================
      // Chat Sessions
      // ============================================
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
                        items: { $ref: "#/components/schemas/ChatSessionListItem" },
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
      "/api/chat/sessions/{id}": {
        get: {
          tags: ["Sessions"],
          summary: "セッション詳細を取得",
          description: "セッションの詳細情報とメッセージ一覧を取得します",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
              description: "セッションID",
            },
          ],
          responses: {
            "200": {
              description: "セッション詳細",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ChatSessionDetail" },
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
            "403": {
              description: "認可エラー（プライベート相談は所有者のみ閲覧可能）",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "404": {
              description: "セッションが見つかりません",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
        patch: {
          tags: ["Sessions"],
          summary: "セッションを更新",
          description: "セッションのタイトルや公開設定を更新します",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
              description: "セッションID",
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "セッションタイトル",
                    },
                    consultType: {
                      type: "string",
                      enum: ["PRIVATE", "PUBLIC"],
                      description: "相談タイプ",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "更新成功",
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
            "403": {
              description: "認可エラー（所有者のみ更新可能）",
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
          summary: "セッションを削除",
          description: "セッションとそのメッセージを完全に削除します（物理削除）",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
              description: "セッションID",
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
            "403": {
              description: "認可エラー（所有者のみ削除可能）",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/api/chat/sessions/{id}/messages": {
        post: {
          tags: ["Messages"],
          summary: "メッセージを送信",
          description: "セッションにメッセージを送信します（AI相談または人間への質問）",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
              description: "セッションID",
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["content"],
                  properties: {
                    content: {
                      type: "string",
                      description: "メッセージ内容",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "メッセージ送信成功（AI応答を含む）",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      userMessage: { $ref: "#/components/schemas/ChatMessage" },
                      aiMessage: { $ref: "#/components/schemas/ChatMessage" },
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
            "403": {
              description: "認可エラー",
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
      },
      "/api/chat/sessions/{id}/respond": {
        post: {
          tags: ["Messages"],
          summary: "人間が回答",
          description: "公開相談に人間として回答します",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
              description: "セッションID",
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["content"],
                  properties: {
                    content: {
                      type: "string",
                      description: "回答内容",
                    },
                    isAnonymous: {
                      type: "boolean",
                      default: false,
                      description: "匿名回答",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "回答成功",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ChatMessage" },
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
            "403": {
              description: "認可エラー（公開相談のみ回答可能、ブロックされている等）",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },

      // ============================================
      // Messages
      // ============================================
      "/api/messages/{id}/gas": {
        post: {
          tags: ["Messages"],
          summary: "💜（ガス）を送る",
          description: "回答に対して💜（感謝の追加報酬）を送ります",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
              description: "メッセージID",
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    amount: {
                      type: "integer",
                      default: 1,
                      description: "送るガスの量",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "ガス送信成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      gasAmount: { type: "integer" },
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
            "403": {
              description: "認可エラー（自分の回答には送れない等）",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },

      // ============================================
      // Users
      // ============================================
      "/api/users/block": {
        get: {
          tags: ["Users"],
          summary: "ブロックリストを取得",
          description: "ブロックしているユーザーの一覧を取得します",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "ブロックリスト",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        blockedId: { type: "string" },
                        blockedUser: { $ref: "#/components/schemas/User" },
                        createdAt: { type: "string", format: "date-time" },
                      },
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
      "/api/users/block/{userId}": {
        post: {
          tags: ["Users"],
          summary: "ユーザーをブロック",
          description: "特定のユーザーをブロックします（そのユーザーは回答できなくなります）",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "userId",
              required: true,
              schema: { type: "string" },
              description: "ブロックするユーザーのID",
            },
          ],
          responses: {
            "201": {
              description: "ブロック成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
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
            "400": {
              description: "自分自身はブロックできません",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
        delete: {
          tags: ["Users"],
          summary: "ブロックを解除",
          description: "ユーザーのブロックを解除します",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "userId",
              required: true,
              schema: { type: "string" },
              description: "ブロック解除するユーザーのID",
            },
          ],
          responses: {
            "200": {
              description: "ブロック解除成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
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

      // ============================================
      // Notifications
      // ============================================
      "/api/notifications": {
        get: {
          tags: ["Notifications"],
          summary: "通知一覧を取得",
          description: "ユーザーの通知一覧を取得します",
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
              name: "unreadOnly",
              schema: { type: "boolean", default: false },
              description: "未読のみ",
            },
          ],
          responses: {
            "200": {
              description: "通知一覧",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Notification" },
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
        patch: {
          tags: ["Notifications"],
          summary: "通知を既読にする",
          description: "全ての通知または特定の通知を既読にします",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    notificationIds: {
                      type: "array",
                      items: { type: "string" },
                      description: "既読にする通知IDの配列（未指定の場合は全て既読）",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "既読成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      count: { type: "integer" },
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

      // ============================================
      // Bookmarks
      // ============================================
      "/api/bookmarks": {
        get: {
          tags: ["Bookmarks"],
          summary: "ブックマーク一覧を取得",
          description: "ユーザーのブックマーク済みセッション一覧を取得します",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", default: 20 },
              description: "取得件数",
            },
          ],
          responses: {
            "200": {
              description: "ブックマーク一覧",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        sessionId: { type: "string" },
                        session: { $ref: "#/components/schemas/ChatSessionListItem" },
                        createdAt: { type: "string", format: "date-time" },
                      },
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
          tags: ["Bookmarks"],
          summary: "ブックマークを追加",
          description: "セッションをブックマークに追加します",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["sessionId"],
                  properties: {
                    sessionId: {
                      type: "string",
                      description: "ブックマークするセッションID",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "ブックマーク追加成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
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
        delete: {
          tags: ["Bookmarks"],
          summary: "ブックマークを削除",
          description: "セッションのブックマークを削除します",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["sessionId"],
                  properties: {
                    sessionId: {
                      type: "string",
                      description: "ブックマーク削除するセッションID",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "ブックマーク削除成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
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

      // ============================================
      // Timeline
      // ============================================
      "/api/timeline": {
        get: {
          tags: ["Timeline"],
          summary: "公開タイムラインを取得",
          description: "全ての公開相談のタイムラインを取得します",
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
              description: "タイムライン",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      sessions: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ChatSessionListItem" },
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
      },
      "/api/timeline/user/{handle}": {
        get: {
          tags: ["Timeline"],
          summary: "ユーザーの公開相談を取得",
          description: "特定ユーザーの公開相談一覧を取得します",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "handle",
              required: true,
              schema: { type: "string" },
              description: "ユーザーハンドル（@username@instance）",
            },
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", default: 20 },
              description: "取得件数",
            },
          ],
          responses: {
            "200": {
              description: "ユーザーの公開相談",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ChatSessionListItem" },
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
            "404": {
              description: "ユーザーが見つかりません",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/api/timeline/user/{handle}/responses": {
        get: {
          tags: ["Timeline"],
          summary: "ユーザーの回答を取得",
          description: "特定ユーザーが回答した相談一覧を取得します",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "handle",
              required: true,
              schema: { type: "string" },
              description: "ユーザーハンドル（@username@instance）",
            },
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", default: 20 },
              description: "取得件数",
            },
          ],
          responses: {
            "200": {
              description: "ユーザーの回答",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ChatSessionListItem" },
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
      "/api/explore": {
        get: {
          tags: ["Timeline"],
          summary: "相談を検索",
          description: "カテゴリやキーワードで公開相談を検索します",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              in: "query",
              name: "category",
              schema: { type: "string" },
              description: "カテゴリフィルタ",
            },
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", default: 20 },
              description: "取得件数",
            },
          ],
          responses: {
            "200": {
              description: "検索結果",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ChatSessionListItem" },
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

      // ============================================
      // Yamii (AI Proxy)
      // ============================================
      "/api/yamii/user": {
        get: {
          tags: ["Yamii"],
          summary: "Yamiiユーザープロフィールを取得",
          description: "Yamii APIのユーザープロフィール情報を取得します",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Yamiiプロフィール",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user_id: { type: "string" },
                      phase: { type: "string" },
                      total_interactions: { type: "integer" },
                      trust_score: { type: "number" },
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
        patch: {
          tags: ["Yamii"],
          summary: "Yamiiプロフィールを更新",
          description: "Yamii APIのプロフィール設定を更新します",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    explicit_profile: {
                      type: "string",
                      description: "明示的なプロフィール情報",
                    },
                    display_name: {
                      type: "string",
                      description: "表示名",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "更新成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
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
        delete: {
          tags: ["Yamii"],
          summary: "Yamii学習データを削除",
          description: "Yamii APIに保存されているAI学習データを削除します（Yamix本体のデータは削除されません）",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "削除成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
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

      // ============================================
      // System
      // ============================================
      "/api/health": {
        get: {
          tags: ["System"],
          summary: "ヘルスチェック",
          description: "APIサーバーの稼働状態を確認します",
          responses: {
            "200": {
              description: "正常稼働中",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
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
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            handle: { type: "string", description: "@username@instance" },
            account: { type: "string" },
            hostName: { type: "string" },
            profile: {
              type: "object",
              nullable: true,
              properties: {
                displayName: { type: "string", nullable: true },
                avatarUrl: { type: "string", nullable: true },
              },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ChatSession: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            title: { type: "string", nullable: true },
            consultType: {
              type: "string",
              enum: ["PRIVATE", "PUBLIC"],
              description: "PRIVATE: AI専用/非公開, PUBLIC: 公開/人間も回答可能",
            },
            isAnonymous: { type: "boolean" },
            allowAnonymousResponses: { type: "boolean" },
            category: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ChatSessionListItem: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string", nullable: true },
            preview: { type: "string", nullable: true, description: "最初のメッセージのプレビュー" },
            consultType: { type: "string", enum: ["PRIVATE", "PUBLIC"] },
            isAnonymous: { type: "boolean" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ChatSessionDetail: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            title: { type: "string", nullable: true },
            consultType: { type: "string", enum: ["PRIVATE", "PUBLIC"] },
            isAnonymous: { type: "boolean" },
            allowAnonymousResponses: { type: "boolean" },
            category: { type: "string", nullable: true },
            user: { $ref: "#/components/schemas/User" },
            messages: {
              type: "array",
              items: { $ref: "#/components/schemas/ChatMessage" },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ChatMessage: {
          type: "object",
          properties: {
            id: { type: "string" },
            sessionId: { type: "string" },
            role: { type: "string", enum: ["USER", "ASSISTANT"] },
            content: { type: "string" },
            isCrisis: { type: "boolean", description: "危機検出フラグ" },
            responderId: { type: "string", nullable: true, description: "人間回答者のID" },
            isAnonymous: { type: "boolean" },
            gasAmount: { type: "integer", description: "受け取った💜の合計" },
            responder: {
              nullable: true,
              allOf: [{ $ref: "#/components/schemas/User" }],
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Notification: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            type: {
              type: "string",
              enum: ["RESPONSE", "MENTION", "GAS_RECEIVED", "SYSTEM"],
            },
            title: { type: "string" },
            message: { type: "string" },
            linkUrl: { type: "string", nullable: true },
            isRead: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  };
};

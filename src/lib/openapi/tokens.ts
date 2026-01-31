import type { OpenAPIV3 } from "openapi-types";

export const tokensPaths: OpenAPIV3.PathsObject = {
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
};

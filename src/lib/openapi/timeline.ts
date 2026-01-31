import type { OpenAPIV3 } from "openapi-types";

export const timelinePaths: OpenAPIV3.PathsObject = {
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
};

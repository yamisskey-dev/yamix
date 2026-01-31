import type { OpenAPIV3 } from "openapi-types";

export const authPaths: OpenAPIV3.PathsObject = {
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
};

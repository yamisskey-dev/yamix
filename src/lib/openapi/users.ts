import type { OpenAPIV3 } from "openapi-types";

export const usersPaths: OpenAPIV3.PathsObject = {
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
};

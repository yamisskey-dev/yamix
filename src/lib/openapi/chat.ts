import type { OpenAPIV3 } from "openapi-types";

export const chatPaths: OpenAPIV3.PathsObject = {
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
};

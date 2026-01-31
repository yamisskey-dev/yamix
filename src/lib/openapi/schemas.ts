import type { OpenAPIV3 } from "openapi-types";

export const components: OpenAPIV3.ComponentsObject = {
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
};

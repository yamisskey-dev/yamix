import { describe, it, expect } from "vitest";
import { zodRequestSchema } from "./zod-schema";
import {
  createChatSessionSchema,
  sendMessageSchema,
  sendGasSchema,
} from "@/lib/validation";
import type { OpenAPIV3 } from "openapi-types";

describe("zodRequestSchema", () => {
  it("sendMessageSchema から実際のフィールド名（message）と制約を導出する", () => {
    const schema = zodRequestSchema(sendMessageSchema);
    const props = schema.properties as Record<string, OpenAPIV3.SchemaObject>;
    expect(schema.required).toContain("message");
    expect(props.message.type).toBe("string");
    expect(props.message.maxLength).toBe(10000);
  });

  it("createChatSessionSchema の enum に DIRECTED が含まれる（手書き時代のドリフト再発防止）", () => {
    const schema = zodRequestSchema(createChatSessionSchema);
    const props = schema.properties as Record<string, OpenAPIV3.SchemaObject>;
    expect(props.consultType.enum).toEqual(["PRIVATE", "PUBLIC", "DIRECTED"]);
    expect(props.targetUserHandles).toBeDefined();
  });

  it("sendGasSchema のデフォルト値が実装と一致する", () => {
    const schema = zodRequestSchema(sendGasSchema);
    const props = schema.properties as Record<string, OpenAPIV3.SchemaObject>;
    expect(props.amount.default).toBe(3);
    expect(props.amount.maximum).toBe(100);
  });

  it("transform を含むスキーマでも入力形の JSON Schema を生成できる", () => {
    // safeStringSchema は transform + refine を含む
    expect(() => zodRequestSchema(sendMessageSchema)).not.toThrow();
  });
});

describe("openapi spec", () => {
  it("spec 全体が例外なく構築できる", async () => {
    const { getApiDocs } = await import("./index");
    const spec = await getApiDocs();
    expect(spec.paths).toBeDefined();
  });
});

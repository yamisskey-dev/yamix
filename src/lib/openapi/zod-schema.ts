import { z } from "zod";
import type { OpenAPIV3 } from "openapi-types";

/**
 * Zod スキーマから OpenAPI 3.0 の requestBody スキーマを導出する
 *
 * validation.ts のスキーマを単一ソースとし、ドキュメントと実際の
 * バリデーションのドリフトを防ぐ。io: "input" で transform 適用前の
 * 入力形を出力する。
 */
export function zodRequestSchema(schema: z.ZodType): OpenAPIV3.SchemaObject {
  return z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io: "input",
  }) as OpenAPIV3.SchemaObject;
}

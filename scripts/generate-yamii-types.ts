#!/usr/bin/env npx tsx
/**
 * Yamii API 型自動生成スクリプト
 *
 * Yamii (FastAPI) の OpenAPI スキーマから TypeScript 型を生成する。
 * FastAPI は Pydantic モデルから自動で OpenAPI スキーマを公開するため、
 * このスクリプトで常に最新の型定義を取得できる。
 *
 * 使い方:
 *   pnpm generate:yamii-types          # Yamii が localhost:8000 で起動中
 *   YAMII_URL=http://yamii:8000 pnpm generate:yamii-types
 *
 * 生成先: src/types/yamii-api.generated.ts
 */

const YAMII_URL = process.env.YAMII_URL || process.env.YAMII_API_URL || "http://localhost:8000";
const OUTPUT_PATH = "src/types/yamii-api.generated.ts";

interface OpenAPISchema {
  openapi: string;
  info: { title: string; version: string };
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, PropertyObject>;
  required?: string[];
  items?: PropertyObject;
  enum?: string[];
  allOf?: PropertyObject[];
  anyOf?: PropertyObject[];
  description?: string;
  title?: string;
  default?: unknown;
}

interface PropertyObject {
  type?: string;
  format?: string;
  items?: PropertyObject;
  $ref?: string;
  anyOf?: PropertyObject[];
  description?: string;
  enum?: string[];
  default?: unknown;
  additionalProperties?: PropertyObject | boolean;
  maxLength?: number;
  minLength?: number;
}

function refToName(ref: string): string {
  return ref.split("/").pop()!;
}

function resolveType(prop: PropertyObject, nullable = false): string {
  if (prop.$ref) {
    const name = refToName(prop.$ref);
    return nullable ? `${name} | null` : name;
  }

  // Handle anyOf (often used for nullable types in OpenAPI 3.1)
  if (prop.anyOf) {
    const nonNull = prop.anyOf.filter((s) => s.type !== "null");
    const hasNull = prop.anyOf.some((s) => s.type === "null");
    if (nonNull.length === 1) {
      return resolveType(nonNull[0], hasNull);
    }
    const types = nonNull.map((s) => resolveType(s));
    if (hasNull) types.push("null");
    return types.join(" | ");
  }

  if (prop.enum) {
    return prop.enum.map((v) => `"${v}"`).join(" | ");
  }

  switch (prop.type) {
    case "string":
      if (prop.format === "date-time") return nullable ? "string | null" : "string";
      return nullable ? "string | null" : "string";
    case "integer":
    case "number":
      return nullable ? "number | null" : "number";
    case "boolean":
      return nullable ? "boolean | null" : "boolean";
    case "array":
      if (prop.items) {
        const inner = resolveType(prop.items);
        return nullable ? `${inner}[] | null` : `${inner}[]`;
      }
      return nullable ? "unknown[] | null" : "unknown[]";
    case "object":
      if (prop.additionalProperties) {
        if (typeof prop.additionalProperties === "boolean") {
          return nullable ? "Record<string, unknown> | null" : "Record<string, unknown>";
        }
        const valType = resolveType(prop.additionalProperties);
        return nullable ? `Record<string, ${valType}> | null` : `Record<string, ${valType}>`;
      }
      return nullable ? "Record<string, unknown> | null" : "Record<string, unknown>";
    case "null":
      return "null";
    default:
      return "unknown";
  }
}

function generateInterface(name: string, schema: SchemaObject): string {
  const lines: string[] = [];
  const required = new Set(schema.required || []);

  if (schema.description) {
    lines.push(`/** ${schema.description} */`);
  }

  lines.push(`export interface ${name} {`);

  if (schema.properties) {
    for (const [propName, prop] of Object.entries(schema.properties)) {
      const isRequired = required.has(propName);
      const tsType = resolveType(prop);
      const opt = isRequired ? "" : "?";
      if (prop.description) {
        lines.push(`  /** ${prop.description} */`);
      }
      lines.push(`  ${propName}${opt}: ${tsType};`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}

async function main() {
  const fs = await import("fs");
  const path = await import("path");

  console.log(`Fetching OpenAPI schema from ${YAMII_URL}/openapi.json ...`);

  let schema: OpenAPISchema;
  try {
    const response = await fetch(`${YAMII_URL}/openapi.json`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    schema = await response.json() as OpenAPISchema;
  } catch (err) {
    console.error(`Failed to fetch OpenAPI schema from Yamii at ${YAMII_URL}`);
    console.error(`Make sure Yamii is running. Error: ${err}`);
    process.exit(1);
  }

  console.log(`Yamii API: ${schema.info.title} v${schema.info.version}`);

  const schemas = schema.components?.schemas;
  if (!schemas) {
    console.error("No schemas found in OpenAPI spec");
    process.exit(1);
  }

  const interfaces: string[] = [];

  for (const [name, schemaDef] of Object.entries(schemas)) {
    // Skip validation error schemas (FastAPI internal)
    if (name === "HTTPValidationError" || name === "ValidationError") continue;
    interfaces.push(generateInterface(name, schemaDef));
  }

  const output = [
    "/**",
    ` * Yamii API Types — auto-generated from OpenAPI schema`,
    ` * Yamii ${schema.info.title} v${schema.info.version}`,
    ` *`,
    ` * DO NOT EDIT MANUALLY`,
    ` * Regenerate with: pnpm generate:yamii-types`,
    ` */`,
    "",
    ...interfaces.map((i) => i + "\n"),
  ].join("\n");

  const outputPath = path.resolve(process.cwd(), OUTPUT_PATH);
  fs.writeFileSync(outputPath, output, "utf-8");
  console.log(`Generated ${interfaces.length} types -> ${OUTPUT_PATH}`);
}

main();

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  parseLimit,
  parsePage,
  validateBody,
  validateQuery,
  createChatSessionSchema,
  sendMessageSchema,
  sendGasSchema,
} from "./validation";

describe("parseLimit", () => {
  it("returns parsed number", () => {
    expect(parseLimit("50")).toBe(50);
  });

  it("returns default for null", () => {
    expect(parseLimit(null)).toBe(20);
  });

  it("returns default for NaN", () => {
    expect(parseLimit("abc")).toBe(20);
  });

  it("returns default for zero", () => {
    expect(parseLimit("0")).toBe(20);
  });

  it("returns default for negative", () => {
    expect(parseLimit("-5")).toBe(20);
  });

  it("caps at maxLimit", () => {
    expect(parseLimit("200")).toBe(100);
  });

  it("respects custom defaults", () => {
    expect(parseLimit(null, 10, 50)).toBe(10);
  });

  it("respects custom maxLimit", () => {
    expect(parseLimit("100", 20, 50)).toBe(50);
  });
});

describe("parsePage", () => {
  it("returns parsed number", () => {
    expect(parsePage("3")).toBe(3);
  });

  it("returns default for null", () => {
    expect(parsePage(null)).toBe(1);
  });

  it("returns default for NaN", () => {
    expect(parsePage("abc")).toBe(1);
  });

  it("returns default for zero", () => {
    expect(parsePage("0")).toBe(1);
  });

  it("returns default for negative", () => {
    expect(parsePage("-1")).toBe(1);
  });

  it("respects custom default", () => {
    expect(parsePage(null, 5)).toBe(5);
  });
});

describe("validateBody", () => {
  const schema = z.object({ name: z.string().min(1) });

  it("returns data on success", () => {
    const result = validateBody(schema, { name: "test" });
    expect(result).toEqual({ success: true, data: { name: "test" } });
  });

  it("returns error on invalid input", () => {
    const result = validateBody(schema, { name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("name");
    }
  });

  it("returns error for missing fields", () => {
    const result = validateBody(schema, {});
    expect(result.success).toBe(false);
  });

  it("returns generic error for non-Zod errors", () => {
    const badSchema = z.any().transform(() => {
      throw new Error("custom");
    });
    const result = validateBody(badSchema, "anything");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Validation failed");
    }
  });
});

describe("validateQuery", () => {
  const schema = z.object({ page: z.string() });

  it("parses URLSearchParams", () => {
    const params = new URLSearchParams("page=1");
    const result = validateQuery(schema, params);
    expect(result).toEqual({ success: true, data: { page: "1" } });
  });

  it("returns error for missing params", () => {
    const params = new URLSearchParams("");
    const result = validateQuery(schema, params);
    expect(result.success).toBe(false);
  });
});

describe("Zod schemas", () => {
  describe("createChatSessionSchema", () => {
    it("accepts valid PRIVATE session", () => {
      const result = createChatSessionSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts DIRECTED with targets", () => {
      const result = createChatSessionSchema.safeParse({
        consultType: "DIRECTED",
        targetUserHandles: ["@user@host"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects DIRECTED without targets", () => {
      const result = createChatSessionSchema.safeParse({
        consultType: "DIRECTED",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("sendMessageSchema", () => {
    it("accepts valid message", () => {
      expect(sendMessageSchema.safeParse({ message: "hello" }).success).toBe(true);
    });

    it("rejects empty message", () => {
      expect(sendMessageSchema.safeParse({ message: "" }).success).toBe(false);
    });
  });

  describe("sendGasSchema", () => {
    it("defaults amount to 3", () => {
      const result = sendGasSchema.parse({});
      expect(result.amount).toBe(3);
    });

    it("rejects amount over 100", () => {
      expect(sendGasSchema.safeParse({ amount: 101 }).success).toBe(false);
    });
  });
});

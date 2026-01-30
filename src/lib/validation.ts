import { z } from "zod";

/**
 * Validation schemas for API endpoints
 */

// Chat session schemas
export const createChatSessionSchema = z.object({
  consultType: z.enum(["PRIVATE", "PUBLIC", "DIRECTED"]).default("PRIVATE"),
  isAnonymous: z.boolean().default(false),
  allowAnonymousResponses: z.boolean().default(true),
  category: z.string().max(50).nullable().optional(),
  targetUserHandles: z.array(z.string().min(1).max(100)).max(20).optional(),
}).refine(
  (data) => data.consultType !== "DIRECTED" || (data.targetUserHandles && data.targetUserHandles.length > 0),
  { message: "指名相談には1人以上の指名先が必要です", path: ["targetUserHandles"] }
);

export const updateChatSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

// Message schemas
export const sendMessageSchema = z.object({
  message: z.string().min(1).max(10000),
});

export const respondToSessionSchema = z.object({
  content: z.string().min(1).max(10000),
  isAnonymous: z.boolean().default(false),
});

// Gas tipping schema
export const sendGasSchema = z.object({
  amount: z.number().int().min(1).max(100).optional().default(3),
});

// Token schemas
export const purchaseTokenSchema = z.object({
  amount: z.number().int().min(1).max(1000000),
  paymentMethod: z.string().max(50).optional(),
});

export const withdrawalSchema = z.object({
  amount: z.number().int().min(1).max(1000000),
  address: z.string().min(1).max(200),
});

// Block user schema
export const blockUserSchema = z.object({
  userId: z.string().cuid(),
});

// Post schemas
export const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  visibility: z.enum(["PUBLIC", "FOLLOWERS", "PRIVATE"]).default("PUBLIC"),
});

// Query parameter schemas
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const userHandleSchema = z.object({
  handle: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
});

/**
 * Helper to validate request body
 */
export function validateBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
      return { success: false, error: messages.join(", ") };
    }
    return { success: false, error: "Validation failed" };
  }
}

/**
 * Helper to validate query parameters
 */
export function validateQuery<T extends z.ZodType>(
  schema: T,
  searchParams: URLSearchParams
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const params = Object.fromEntries(searchParams.entries());
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
      return { success: false, error: messages.join(", ") };
    }
    return { success: false, error: "Validation failed" };
  }
}

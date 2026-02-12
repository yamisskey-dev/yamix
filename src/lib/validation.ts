import { z } from "zod";

/**
 * Validation schemas for API endpoints
 *
 * SECURITY: Enterprise-grade input validation
 * - XSS prevention
 * - SQL injection prevention (defense in depth)
 * - Type-safe validation
 */

// ============================================
// Security-focused validators
// ============================================

/**
 * Check if string contains potential XSS patterns
 * SECURITY: Detect and block XSS attempts
 */
export function containsXSSPatterns(input: string): boolean {
  const xssPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<iframe[\s\S]*?>/gi,
    /<object[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi,
    /javascript:/gi,
    /on\w+\s*=\s*["']?[^"']*["']?/gi, // Event handlers like onclick, onerror
    /<img[^>]+src\s*=\s*["']?javascript:/gi,
    /data:text\/html/gi,
    /<svg[\s\S]*?onload/gi,
  ];

  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Check if string contains potential SQL injection patterns
 * SECURITY: Defense in depth (Prisma already prevents SQL injection)
 */
export function containsSQLInjectionPatterns(input: string): boolean {
  const sqlPatterns = [
    /(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)/i,
    /\b(drop|delete|insert|update|create|alter|exec|execute)\b.*\b(table|database|schema)\b/i,
    /--|\#|\/\*|\*\//,
    /\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
    /\band\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize string for safe usage
 * SECURITY: Remove dangerous patterns while preserving content
 */
export function sanitizeString(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, "");

  // Remove control characters (keep newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Safe string schema with XSS and injection detection
 * SECURITY: Comprehensive string validation
 */
export const safeStringSchema = z
  .string()
  .min(1)
  .max(10000)
  .transform(sanitizeString)
  .refine(
    (val) => !containsXSSPatterns(val),
    { message: "Input contains potentially dangerous XSS patterns" }
  )
  .refine(
    (val) => !containsSQLInjectionPatterns(val),
    { message: "Input contains potentially dangerous SQL patterns" }
  );

// Chat session schemas
export const createChatSessionSchema = z.object({
  consultType: z.enum(["PRIVATE", "PUBLIC", "DIRECTED"]).default("PRIVATE"),
  isAnonymous: z.boolean().default(false),
  allowAnonymousResponses: z.boolean().default(true),
  category: z.string().max(50).nullable().optional(),
  targetUserHandles: z.array(z.string().min(1).max(100)).max(20).optional(),
  initialMessage: safeStringSchema.optional(),
});
// Note: DIRECTED with no targets = self-only post (Misskey-style "裏技")

export const updateChatSessionSchema = z.object({
  title: z.string().min(1).max(200).transform(sanitizeString).optional(),
});

// Message schemas
export const sendMessageSchema = z.object({
  message: safeStringSchema,
});

export const respondToSessionSchema = z.object({
  content: safeStringSchema,
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
export const userHandleSchema = z.object({
  handle: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
});

/**
 * Parse pagination limit from query params (NaN-safe, capped)
 */
export function parseLimit(value: string | null, defaultLimit = 20, maxLimit = 100): number {
  const parsed = parseInt(value || String(defaultLimit), 10);
  if (isNaN(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, maxLimit);
}

/**
 * Parse page number from query params (NaN-safe)
 */
export function parsePage(value: string | null, defaultPage = 1): number {
  const parsed = parseInt(value || String(defaultPage), 10);
  if (isNaN(parsed) || parsed < 1) return defaultPage;
  return parsed;
}

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

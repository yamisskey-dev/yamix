/**
 * Error Handling Utilities
 *
 * SECURITY: Safe error handling that prevents information leakage
 * - Production: Generic error messages for clients
 * - Development: Detailed error messages for debugging
 * - Always log full errors server-side
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  timestamp: string;
}

/**
 * Error codes for client-facing errors
 */
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",

  // Validation
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",

  // Resource
  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",

  // Business Logic
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  OPERATION_NOT_ALLOWED = "OPERATION_NOT_ALLOWED",

  // Security
  CSRF_TOKEN_INVALID = "CSRF_TOKEN_INVALID",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",

  // System
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
}

/**
 * Check if error should be exposed to client
 * SECURITY: Only expose safe errors, hide sensitive details
 */
// Helper function to check if error is safe - available for future use
// function isSafeError(error: unknown): boolean {
//   if (error instanceof AppError) {
//     return true; // Our own errors are safe to expose
//   }
//   if (error instanceof ZodError) {
//     return true; // Validation errors are safe
//   }
//   return false;
// }

/**
 * Get safe error message for client
 * SECURITY: Never leak sensitive information in production
 */
function getSafeErrorMessage(error: unknown): string {
  const isProduction = process.env.NODE_ENV === "production";

  // In development, show detailed errors
  if (!isProduction) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  // In production, only show safe errors
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof ZodError) {
    return "Validation failed: " + error.issues.map(e => e.message).join(", ");
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Don't expose database structure
    switch (error.code) {
      case "P2002":
        return "Resource already exists";
      case "P2025":
        return "Resource not found";
      default:
        return "Database operation failed";
    }
  }

  // Generic error for everything else in production
  return "An unexpected error occurred";
}

/**
 * Custom application error class
 * SECURITY: Controlled error messages that are safe to expose
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError(message, 401, ErrorCode.UNAUTHORIZED);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(message, 403, ErrorCode.FORBIDDEN);
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError(message, 404, ErrorCode.NOT_FOUND);
  }

  static validationError(message: string, details?: unknown): AppError {
    return new AppError(message, 400, ErrorCode.VALIDATION_ERROR, details);
  }

  static rateLimitExceeded(message = "Rate limit exceeded"): AppError {
    return new AppError(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED);
  }

  static insufficientBalance(message = "Insufficient balance"): AppError {
    return new AppError(message, 400, ErrorCode.INSUFFICIENT_BALANCE);
  }

  static csrfTokenInvalid(message = "CSRF token validation failed"): AppError {
    return new AppError(message, 403, ErrorCode.CSRF_TOKEN_INVALID);
  }

  static suspiciousActivity(message = "Suspicious activity detected"): AppError {
    return new AppError(message, 403, ErrorCode.SUSPICIOUS_ACTIVITY);
  }

  static internalError(message = "Internal server error"): AppError {
    return new AppError(message, 500, ErrorCode.INTERNAL_ERROR);
  }
}

/**
 * Handle errors and return appropriate response
 * SECURITY: Always log errors, but only expose safe information to clients
 */
export function handleError(
  error: unknown,
  context?: Record<string, unknown>
): NextResponse<ErrorResponse> {
  // Log full error server-side
  logger.error("Error handled", context, error);

  // Determine status code
  let statusCode = 500;
  let errorCode = ErrorCode.INTERNAL_ERROR;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    errorCode = ErrorCode.VALIDATION_ERROR;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400;
    errorCode = ErrorCode.DATABASE_ERROR;
  }

  // Get safe error message
  const message = getSafeErrorMessage(error);

  // Prepare response
  const response: ErrorResponse = {
    error: message,
    code: errorCode,
    timestamp: new Date().toISOString(),
  };

  // Include details only if safe and in development
  if (process.env.NODE_ENV !== "production" && error instanceof AppError && error.details) {
    response.details = error.details;
  }

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Async error wrapper for API route handlers
 * SECURITY: Ensures all errors are properly handled
 */
export function asyncHandler<T extends (...args: unknown[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  }) as T;
}

/**
 * Validate required environment variables
 * SECURITY: Fail fast if critical config is missing
 */
export function validateEnvVars(requiredVars: string[]): void {
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      "Please check your .env file and ensure all required variables are set."
    );
  }
}

/**
 * Assert condition or throw error
 * SECURITY: Clear assertions for security-critical checks
 */
export function assert(
  condition: boolean,
  message: string,
  statusCode = 500,
  errorCode = ErrorCode.INTERNAL_ERROR
): asserts condition {
  if (!condition) {
    throw new AppError(message, statusCode, errorCode);
  }
}

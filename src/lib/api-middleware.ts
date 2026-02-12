/**
 * API Middleware Helpers
 *
 * SECURITY: Unified middleware functions for API routes
 * - Authentication check
 * - CSRF protection
 * - Rate limiting
 * - Audit logging
 * - Error handling
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";
import { csrfProtection } from "@/lib/csrf";
import { checkRateLimitRedis, RateLimits } from "@/lib/rate-limit-redis";
import {
  logAuditEvent,
  logAuthEvent,
  logSecurityEvent,
  AuditEventType,
  AuditRiskLevel,
} from "@/lib/audit-log";
import { handleError, AppError } from "@/lib/error-handler";

type RateLimitType = keyof typeof RateLimits;

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Get user agent from request
 */
function getUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown";
}

/**
 * Middleware: Verify JWT and extract user
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ userId: string; handle: string } | NextResponse> {
  try {
    const token = request.cookies.get("yamix-token")?.value;

    if (!token) {
      await logAuthEvent(
        AuditEventType.AUTH_SESSION_EXPIRED,
        undefined,
        getClientIP(request),
        getUserAgent(request),
        "FAILURE"
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      await logAuthEvent(
        AuditEventType.AUTHZ_ACCESS_DENIED,
        undefined,
        getClientIP(request),
        getUserAgent(request),
        "FAILURE",
        { reason: "Invalid token" }
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return { userId: payload.userId, handle: payload.sub };
  } catch (error) {
    await logAuthEvent(
      AuditEventType.AUTHZ_ACCESS_DENIED,
      undefined,
      getClientIP(request),
      getUserAgent(request),
      "FAILURE",
      { error: String(error) }
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * Middleware: CSRF protection for state-changing operations
 */
export async function requireCSRF(request: NextRequest): Promise<boolean | NextResponse> {
  const result = csrfProtection(request);

  if (!result.valid) {
    await logSecurityEvent(
      AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY,
      undefined,
      getClientIP(request),
      AuditRiskLevel.HIGH,
      {
        reason: "CSRF token validation failed",
        path: request.nextUrl.pathname,
        method: request.method,
      }
    );

    return NextResponse.json(
      { error: "CSRF token validation failed" },
      { status: 403 }
    );
  }

  return true;
}

/**
 * Middleware: Rate limiting
 */
export async function requireRateLimit(
  request: NextRequest,
  userId: string,
  type: RateLimitType
): Promise<boolean | NextResponse> {
  const ip = getClientIP(request);
  const key = `${type}:${userId}:${ip}`;

  const result = await checkRateLimitRedis(key, RateLimits[type]);

  if (!result.success) {
    await logSecurityEvent(
      AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED,
      userId,
      ip,
      AuditRiskLevel.MEDIUM,
      {
        type,
        limit: result.limit,
        path: request.nextUrl.pathname,
      }
    );

    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        limit: result.limit,
        reset: result.reset,
      },
      { status: 429 }
    );
  }

  return true;
}

/**
 * Unified API handler with security middleware
 *
 * Example usage:
 * ```ts
 * export async function POST(request: NextRequest) {
 *   return withApiSecurity(request, {
 *     requireAuth: true,
 *     requireCSRF: true,
 *     rateLimit: RateLimitType.MESSAGE_SEND,
 *   }, async (req, context) => {
 *     // Your handler logic here
 *     const { userId } = context;
 *     // ...
 *     return NextResponse.json({ success: true });
 *   });
 * }
 * ```
 */
export async function withApiSecurity<T>(
  request: NextRequest,
  options: {
    requireAuth?: boolean;
    requireCSRF?: boolean;
    rateLimit?: RateLimitType;
  },
  handler: (
    request: NextRequest,
    context: { userId?: string; handle?: string }
  ) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const context: { userId?: string; handle?: string } = {};

    // 1. Authentication
    if (options.requireAuth) {
      const authResult = await requireAuth(request);
      if (authResult instanceof NextResponse) {
        return authResult; // Auth failed, return error response
      }
      context.userId = authResult.userId;
      context.handle = authResult.handle;
    }

    // 2. CSRF Protection
    if (options.requireCSRF) {
      const csrfResult = await requireCSRF(request);
      if (csrfResult instanceof NextResponse) {
        return csrfResult; // CSRF failed, return error response
      }
    }

    // 3. Rate Limiting
    if (options.rateLimit && context.userId) {
      const rateLimitResult = await requireRateLimit(
        request,
        context.userId,
        options.rateLimit
      );
      if (rateLimitResult instanceof NextResponse) {
        return rateLimitResult; // Rate limit exceeded, return error response
      }
    }

    // 4. Execute handler
    return await handler(request, context);
  } catch (error) {
    // 5. Error handling with audit logging
    const userId = context.userId;
    await logAuditEvent({
      eventType: AuditEventType.SYSTEM_ERROR,
      riskLevel: AuditRiskLevel.HIGH,
      userId,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      resource: request.nextUrl.pathname,
      action: request.method,
      result: "FAILURE",
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return handleError(error, {
      path: request.nextUrl.pathname,
      userId,
    });
  }
}

/**
 * Log successful API operation
 */
export async function logApiSuccess(
  eventType: AuditEventType,
  request: NextRequest,
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    eventType,
    riskLevel: AuditRiskLevel.LOW,
    userId,
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request),
    resource: request.nextUrl.pathname,
    action: request.method,
    result: "SUCCESS",
    metadata,
  });
}

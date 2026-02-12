/**
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * SECURITY: Double-submit cookie pattern + SameSite cookies
 * - Generates CSRF tokens for state-changing operations
 * - Validates tokens on POST/PUT/DELETE/PATCH requests
 * - Uses cryptographically secure random tokens
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a cryptographically secure CSRF token
 * SECURITY: Uses crypto.randomBytes for unpredictable tokens
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("base64url");
}

/**
 * Set CSRF token as a cookie
 * SECURITY: SameSite=Lax prevents CSRF attacks
 */
export function setCSRFCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript to include in request headers
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });
}

/**
 * Get CSRF token from cookie
 */
export function getCSRFTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value || null;
}

/**
 * Get CSRF token from request header
 */
export function getCSRFTokenFromHeader(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME);
}

/**
 * Validate CSRF token
 * SECURITY: Double-submit cookie pattern
 */
export function validateCSRFToken(request: NextRequest): boolean {
  const cookieToken = getCSRFTokenFromCookie(request);
  const headerToken = getCSRFTokenFromHeader(request);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}

/**
 * Middleware to validate CSRF tokens on state-changing requests
 * SECURITY: Protect POST/PUT/DELETE/PATCH endpoints
 */
export function csrfProtection(request: NextRequest): {
  valid: boolean;
  error?: string;
} {
  const method = request.method;

  // CSRF protection only for state-changing methods
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return { valid: true };
  }

  // Skip CSRF for certain paths (like auth callback)
  const pathname = request.nextUrl.pathname;
  const csrfExemptPaths = [
    "/api/auth/callback", // OAuth callback doesn't have CSRF token
    "/api/webhooks/", // Webhooks are verified differently
  ];

  if (csrfExemptPaths.some(path => pathname.startsWith(path))) {
    return { valid: true };
  }

  // Validate CSRF token
  const isValid = validateCSRFToken(request);

  if (!isValid) {
    logger.warn("CSRF validation failed", {
      method,
      pathname,
      hasHeaderToken: !!getCSRFTokenFromHeader(request),
      hasCookieToken: !!getCSRFTokenFromCookie(request),
    });

    return {
      valid: false,
      error: "CSRF token validation failed",
    };
  }

  return { valid: true };
}

/**
 * API helper: Get or create CSRF token
 * Use in GET endpoints to provide token to client
 */
export function getOrCreateCSRFToken(request: NextRequest): string {
  const existingToken = getCSRFTokenFromCookie(request);
  if (existingToken) {
    return existingToken;
  }
  return generateCSRFToken();
}

/**
 * API response helper: Return CSRF token
 */
export function createCSRFResponse(token: string): NextResponse {
  const response = NextResponse.json({ csrfToken: token });
  setCSRFCookie(response, token);
  return response;
}

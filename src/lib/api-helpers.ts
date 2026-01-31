import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, getTokenFromCookie, type JWTPayload } from "@/lib/jwt";

/**
 * Authenticate request and return user payload
 * Returns NextResponse with error if authentication fails
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<{ payload: JWTPayload } | { error: NextResponse }> {
  const token = getTokenFromCookie(req.headers.get("cookie"));

  if (!token) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return {
      error: NextResponse.json({ error: "Invalid token" }, { status: 401 }),
    };
  }

  return { payload };
}

/**
 * Parse JSON body with error handling
 */
export async function parseJsonBody<T = unknown>(
  req: NextRequest
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    const data = await req.json();
    return { data };
  } catch {
    return {
      error: NextResponse.json({ error: "Invalid request body" }, { status: 400 }),
    };
  }
}

/**
 * Standard error responses
 */
export const ErrorResponses = {
  notAuthenticated: () =>
    NextResponse.json({ error: "Not authenticated" }, { status: 401 }),

  invalidToken: () =>
    NextResponse.json({ error: "Invalid token" }, { status: 401 }),

  forbidden: (message = "Not authorized") =>
    NextResponse.json({ error: message }, { status: 403 }),

  notFound: (resource = "Resource") =>
    NextResponse.json({ error: `${resource} not found` }, { status: 404 }),

  badRequest: (message = "Invalid request") =>
    NextResponse.json({ error: message }, { status: 400 }),

  rateLimitExceeded: () =>
    NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    ),

  databaseUnavailable: () =>
    NextResponse.json({ error: "Database not available" }, { status: 503 }),

  internalError: (message = "Internal server error") =>
    NextResponse.json({ error: message }, { status: 500 }),
} as const;

/**
 * Optional authentication — returns payload or null (no error)
 * Use for public endpoints that show extra data for logged-in users
 */
export async function optionalAuth(
  req: NextRequest
): Promise<JWTPayload | null> {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return null;
  return verifyJWT(token);
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for adding security headers
 *
 * SECURITY IMPROVEMENTS:
 * - Stricter CSP (with unsafe-inline for now)
 * - HSTS header for production
 * - Comprehensive security headers
 *
 * NOTE: Edge Runtime compatible (no Node.js crypto module)
 * TODO: Implement CSP nonce via custom _document for full nonce-based CSP
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Note: Nonce generation requires Node.js crypto, not available in Edge Runtime
  // For full nonce-based CSP, implement via custom _document
  // const nonce = crypto.randomBytes(16).toString("base64");

  // Security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // HSTS (HTTP Strict Transport Security) for production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Content Security Policy with nonce
  // TODO: Full nonce implementation requires injecting nonce into HTML
  // For now, use strict policy with minimal inline allowances
  const isDev = process.env.NODE_ENV !== "production";

  const scriptSrc = isDev
    ? "'self' 'unsafe-eval' 'unsafe-inline'" // Development needs eval for HMR
    : "'self' 'unsafe-inline'"; // TODO: Replace with nonce-${nonce} after HTML injection

  const styleSrc = "'self' 'unsafe-inline'"; // TODO: Replace with nonce for styles

  response.headers.set(
    "Content-Security-Policy",
    [
      `default-src 'self'`,
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      `img-src 'self' data: https:`,
      `font-src 'self' data:`,
      `connect-src 'self' https://mix.yami.ski https://down.yami.ski`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `upgrade-insecure-requests`, // Upgrade HTTP to HTTPS
    ].join("; ")
  );

  // Permissions Policy (more restrictive)
  response.headers.set(
    "Permissions-Policy",
    [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()", // Block FLoC
      "payment=()",
      "usb=()",
    ].join(", ")
  );

  // Store nonce for use in HTML (Next.js would need custom document for this)
  // response.headers.set("X-CSP-Nonce", nonce);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js).*)",
  ],
};

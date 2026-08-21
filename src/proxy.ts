import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware for adding security headers
 *
 * - Nonce-based CSP (本番): script-src から unsafe-inline を排除
 *   Next.js はリクエストヘッダの CSP から nonce を検出し、自身の script タグに付与する
 * - HSTS header for production
 * - Comprehensive security headers
 *
 * NOTE: Edge Runtime compatible (Web Crypto を使用)
 */
export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";

  // Web Crypto はEdge Runtimeで利用可能
  const nonce = btoa(crypto.randomUUID());

  const scriptSrc = isDev
    ? "'self' 'unsafe-eval' 'unsafe-inline'" // Development needs eval/inline for HMR
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  // style属性・styled-jsx のため unsafe-inline を維持（script と異なり実害は限定的）
  const styleSrc = "'self' 'unsafe-inline'";

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src 'self' data: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' https://mix.yami.ski https://down.yami.ski`,
    `worker-src 'self'`, // Service Worker（strict-dynamic の script-src フォールバックを回避）
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`, // Upgrade HTTP to HTTPS
  ].join("; ");

  // Next.js に nonce を伝えるため、リクエストヘッダにも CSP を載せる
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", csp);

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
     * Also skip prefetch requests (nonce 付き CSP は動的レンダリングを強制するため)
     */
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

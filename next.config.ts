import type { NextConfig } from "next";
import withPWA from "next-pwa";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_YAMIX_VERSION: packageJson.version,
  },
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Aggressive caching for offline-first experience (like Linear)
  runtimeCaching: [
    // App pages: Cache-first for instant offline access
    {
      urlPattern: ({ request, url }: { request: Request; url: URL }) => {
        const isSameOrigin = self.origin === url.origin;
        const isAppPage = url.pathname.startsWith('/main/');
        const isNavigationRequest = request.mode === 'navigate';
        return isSameOrigin && (isAppPage || isNavigationRequest);
      },
      handler: "CacheFirst",
      options: {
        cacheName: "app-pages",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    // API requests: Network-first with cache fallback
    {
      urlPattern: ({ url }: { url: URL }) => {
        const isSameOrigin = self.origin === url.origin;
        const isApi = url.pathname.startsWith('/api/');
        const isNotAuth = !url.pathname.startsWith('/api/auth/');
        return isSameOrigin && isApi && isNotAuth;
      },
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
      },
    },
    // Message sending: Background sync for offline queue
    {
      urlPattern: /^https:\/\/.*\/api\/chat\/sessions\/.*\/messages$/,
      handler: "NetworkOnly",
      options: {
        backgroundSync: {
          name: "message-queue",
          options: {
            maxRetentionTime: 24 * 60, // Retry for max of 24 Hours (in minutes)
          },
        },
      },
    },
    // Static assets from CDN: Cache-first
    {
      urlPattern: /^https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.)\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "external-resources",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
  ],
})(nextConfig);

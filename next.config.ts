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
  // Background Sync for offline message queue
  runtimeCaching: [
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
  ],
})(nextConfig);

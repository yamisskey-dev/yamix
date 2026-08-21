import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_YAMIX_VERSION: packageJson.version,
  },
  output: "standalone",
  // Next 16.3 (Turbopack) の standalone トレースが @swc/helpers の esm/ を
  // コピーし損ねて起動時に MODULE_NOT_FOUND になるため、明示的に含める
  outputFileTracingIncludes: {
    "*": ["node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**"],
  },
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

export default withSerwist(nextConfig);

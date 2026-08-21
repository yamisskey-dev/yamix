import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// precache のリビジョン。git が使えない環境（Docker ビルド等）ではランダム値
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [{ url: "/offline.html", revision }],
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
  });

import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      // Next.js generated files
      ".next/",
      "next-env.d.ts",
      "out/",
      // PWA generated files
      "public/sw.js",
      "public/workbox-*.js",
      // Build output
      "dist/",
      "build/",
      "node_modules/",
      // Test output
      "coverage/",
      "playwright-report/",
      "test-results/",
      // Python submodule (ruff で lint される)
      "yamii/",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "@next/next/no-img-element": "off",
      // eslint-config-next 16 同梱の react-hooks v6 で追加された新ルール。
      // 既存コード14箇所が該当するため一旦無効化。修正後に有効化すること
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
    },
  },
];

export default eslintConfig;

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
      // Python submodule (ruff で lint される)
      "yamii/",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;

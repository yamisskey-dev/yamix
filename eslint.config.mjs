import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

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
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;

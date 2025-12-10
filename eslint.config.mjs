import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    // Dependencies
    "node_modules/**",
    // Prisma generated files
    "src/generated/**",
    // Node.js scripts
    "scripts/**",
    // Environment files
    ".env*",
    // Logs
    "*.log",
    // OS files
    ".DS_Store",
  ]),
]);

export default eslintConfig;

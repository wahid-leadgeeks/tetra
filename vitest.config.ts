import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "file:.data/tetra-pglite",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "test-secret-0123456789abcdef",
      DEFAULT_TIMEZONE: "Asia/Jakarta",
      ALLOW_DEV_LOGIN: "true",
    },
  },
});

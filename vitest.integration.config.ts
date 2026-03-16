/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.integration.test.{ts,tsx}"],
    testTimeout: 15_000,
  },
});

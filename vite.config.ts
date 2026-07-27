/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { alphaTab } from "@coderline/alphatab-vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss(), alphaTab()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@tests": path.resolve(__dirname, "tests"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/**/*.integration.test.{ts,tsx}"],
    setupFiles: ["tests/unit/setup.ts"],
  },
});

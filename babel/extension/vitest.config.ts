import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@babel-app": path.resolve(import.meta.dirname, "../src") } },
  define: { __APP_URL__: JSON.stringify("http://localhost:3000"), __VERSION__: JSON.stringify("test") },
  test: { environment: "happy-dom", include: ["tests/**/*.test.ts"] },
});

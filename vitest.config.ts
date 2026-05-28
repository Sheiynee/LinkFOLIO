import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(
        __dirname,
        "./src/__tests__/__mocks__/server-only.ts"
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/**/*.test.ts"],
  },
});

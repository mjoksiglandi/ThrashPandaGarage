import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.postgres.integration.test.ts"],
    setupFiles: ["./vitest.integration.setup.ts"],
    fileParallelism: false,
  },
});

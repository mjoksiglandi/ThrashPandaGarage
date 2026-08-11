import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      ...configDefaults.exclude,
      "**/.next/**",
      "**/*.postgres.integration.test.ts",
    ],
  },
});

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Bun + vitest resolve zod's CJS build to an undefined default; inlining it
    // lets Vite transform the module instead of the runtime.
    server: { deps: { inline: ["zod"] } },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

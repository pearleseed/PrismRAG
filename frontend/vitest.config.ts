import { mergeConfig } from "vite";
import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default defineConfig(async (configEnv) => {
  const base = typeof viteConfig === "function" ? await viteConfig(configEnv) : viteConfig;
  return mergeConfig(base, {
    test: {
      environment: "jsdom",
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
    },
  });
});

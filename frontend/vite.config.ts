import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget =
    env.VITE_DEV_PROXY_TARGET || process.env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:8080";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-i18next", "i18next"],
      force: true,
    },
    build: {
      rollupOptions: {
        output: {
          codeSplitting: true,
        },
      },
    },
    server: {
      host: true,
      port: 5174,
      strictPort: false,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        "/static": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});

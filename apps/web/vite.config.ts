import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  // 本地联调 GCP：在 .env.development 中设置；改回 http://127.0.0.1:8000 即连本机 API
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://34.177.94.143:8080";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
        "/uploads": { target: apiTarget, changeOrigin: true },
        "/health": { target: apiTarget, changeOrigin: true },
      },
    },
  };
});

import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vite.dev/config/
export default defineConfig({
  envDir: "../",
  plugins: [vue(), vueJsx(), vueDevTools()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    allowedHosts: [".purpld.dev"],
    proxy: {
      "/api": {
        target: "http://localhost:3001/",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  optimizeDeps: { include: ["@larpardy/shared*"] },
});

import { defineConfig } from "vite";
import { contentPlugin } from "./scripts/content-api.mjs";
import { cmsPlugin } from "./scripts/cms-api.mjs";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/")) return "vendor";
          if (id.endsWith("/src/content.json")) return "catalogue";
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), cmsPlugin(), contentPlugin()],
});

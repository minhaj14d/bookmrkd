import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.json";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  worker: {
    format: "es",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        report: "src/report/report.html",
        privacy: "src/privacy/privacy.html",
      },
    },
  },
  publicDir: "public",
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.json";

export default defineConfig({
  // Load VITE_* from repo root `.env` (see ../.env.example).
  envDir: "..",
  envPrefix: "VITE_",
  plugins: [react(), crx({ manifest, browser: "chrome" })],
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

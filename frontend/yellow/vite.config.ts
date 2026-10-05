import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/yellow-next/",
  // This directory contained an old generated bundle, not source public assets.
  // Do not copy that stale app recursively into each production release.
  publicDir: false,
  plugins: [react()],
  worker: { format: "es" },
  build: {
    outDir: "../../public/yellow-next",
    emptyOutDir: true,
    target: "es2022",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-runtime",
              test: /node_modules[\\/](?:react|react-dom)[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
});

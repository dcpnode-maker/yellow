import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/client/locanda-next/",
  plugins: [react()],
  build: {
    outDir: "../../public/locanda-next",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
  },
});

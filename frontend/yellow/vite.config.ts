import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/yellow-next/",
  plugins: [react()],
  build: {
    outDir: "../../public/yellow-next",
    emptyOutDir: true,
    target: "es2022",
    rolldownOptions: {
      preserveEntrySignatures: "allow-extension",
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [
            {
              name: "yellow-app",
              test: /frontend[\\/]yellow[\\/]src[\\/]App\.tsx$/,
              priority: 30,
              includeDependenciesRecursively: false,
            },
            {
              name: "react-runtime",
              test: /node_modules[\\/](?:react|react-dom)[\\/]/,
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});

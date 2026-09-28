import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: ".",
  // O bundle iife de producao nao passa pela transformacao de app HTML do Vite,
  // entao process.env.NODE_ENV (usado pelo React/ReactDOM internamente) nao e
  // substituido automaticamente - precisa ser definido explicitamente aqui.
  // No dev server (harness), mantem "development" pros avisos normais do React.
  define: {
    "process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development")
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    open: "/src/dev/index.html"
  },
  build: {
    outDir: "react",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: "src/dashboard/entry.tsx",
      name: "GestorReactDashboard",
      formats: ["iife"],
      fileName: () => "dashboard.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "dashboard.[ext]"
      }
    }
  }
}));

import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Espelha vite.billing.config.ts (bundle da tela de Resumo por cliente) -
// mesmo motivo de config separado e mesmo emptyOutDir:false.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: ".",
  define: {
    "process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development")
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    outDir: "react",
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: "src/financeSummary/entry.tsx",
      name: "GestorReactFinanceSummary",
      formats: ["iife"],
      fileName: () => "financeSummary.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "financeSummary.[ext]"
      }
    }
  }
}));

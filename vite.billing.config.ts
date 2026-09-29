import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Espelha vite.payments.config.ts (bundle da tela de Cobrancas) - mesmo motivo
// de config separado (Rollup nao aceita multiplas entradas em build iife) e
// mesmo emptyOutDir:false (nao apaga os bundles de dashboard/payments ja
// gerados na mesma pasta "react/").
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
      entry: "src/billing/entry.tsx",
      name: "GestorReactBilling",
      formats: ["iife"],
      fileName: () => "billing.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "billing.[ext]"
      }
    }
  }
}));
